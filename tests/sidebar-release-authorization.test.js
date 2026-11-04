'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {validateSidebarRelease, readSidebarReleaseAuthorization, publicationContentHash:hash, SIDEBAR_RELEASE_PATH, SIDEBAR_RELEASE_BASELINE, SIDEBAR_RELEASE_PATHS:UI} = require('../scripts/check-publication.cjs');
const {POLICY_VERSION} = require('../scripts/check-course-content.cjs');
const MANIFEST = 'course-content/review-status.json', CATALOG = 'course-content/source-catalog.json';
const LEGACY = 'docs/legacy.html', VENDOR = 'docs/vendor/font.woff2';

function refresh(f) {
  f.manifestBytes = Buffer.from(JSON.stringify(f.manifest));
  f.catalogBytes = Buffer.from(JSON.stringify(f.catalog));
  f.authorization.reviewManifestHash = hash(MANIFEST, f.manifestBytes);
  f.authorization.sourceCatalogHash = hash(CATALOG, f.catalogBytes);
  f.authorization.files = [...f.files].map(([name, bytes]) => ({path:name, sha256:hash(name, bytes)}));
}

function fixture() {
  const baselineFiles = new Map([...UI.map(name => [name, Buffer.from('Previous synthetic UI\n')]), [LEGACY, Buffer.from('Unchanged synthetic content\n')], [VENDOR, Buffer.from([0,255,13,10])]]);
  const files = new Map(baselineFiles);
  for (const name of UI) files.set(name, Buffer.from('Changed synthetic UI\n'));
  const baselineManifest = {schemaVersion:1, policyVersion:POLICY_VERSION, files:[...baselineFiles].filter(([name]) => name !== VENDOR).map(([name, bytes]) => ({path:name, sha256:hash(name,bytes), status:name === LEGACY ? 'blocked' : 'needs-review', reason:'Synthetic pending review'}))};
  const manifest = structuredClone(baselineManifest);
  for (const row of manifest.files) if (UI.includes(row.path)) row.sha256 = hash(row.path, files.get(row.path));
  const catalog = {schemaVersion:1, sources:[]};
  const authorization = {
    schemaVersion:1, kind:'user-requested-sidebar-release', policyVersion:POLICY_VERSION,
    requestQuote:'publish', requestDate:'2026-11-04', scope:'Synthetic sidebar-only release',
    baselineCommit:SIDEBAR_RELEASE_BASELINE, contentReviewPerformed:false,
    technicalReview:{author:'Synthetic author', reviewer:'Synthetic reviewer', note:'Independent synthetic technical check'},
    changedPaths:[...UI], deletedPaths:[]
  };
  const f = {authorization, files, baselineFiles, manifest, catalog, baselineManifestBytes:Buffer.from(JSON.stringify(baselineManifest)), baselineCatalogBytes:Buffer.from(JSON.stringify(catalog)), remoteBase:SIDEBAR_RELEASE_BASELINE};
  refresh(f);
  return f;
}

function rejected(f, pattern) {
  const result = validateSidebarRelease(f);
  assert.equal(result.ok, false);
  if (pattern) assert.match(result.errors.join('\n'), pattern);
}

test('sidebar release accepts only its exact UI snapshot while retaining pending content status', () => {
  const f = fixture(), before = JSON.stringify(f.manifest);
  const result = validateSidebarRelease(f);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.mode, 'authorized-sidebar-release');
  assert.equal(result.contentReviewPerformed, false);
  assert.equal(result.legacyApprovalGranted, false);
  assert.equal(JSON.stringify(f.manifest), before);
});

test('any later UI, educational or vendor byte invalidates the pinned snapshot', () => {
  for (const name of [...UI, LEGACY, VENDOR]) {
    const f = fixture();
    f.files.set(name, Buffer.concat([f.files.get(name), Buffer.from('change')]));
    rejected(f, /differs from the authorized snapshot/);
  }
});

test('extra content changes cannot join the sidebar scope even after refreshing inventories', () => {
  for (const name of [LEGACY, VENDOR]) {
    const f = fixture();
    f.files.set(name, Buffer.from('Unauthorized change'));
    if (name === LEGACY) f.manifest.files.find(row => row.path === name).sha256 = hash(name, f.files.get(name));
    f.authorization.changedPaths.push(name);
    refresh(f);
    rejected(f, /exactly the three authorized sidebar UI files/);
  }
  const missing = fixture();
  missing.files.set(UI[0], missing.baselineFiles.get(UI[0]));
  missing.manifest.files[0].sha256 = hash(UI[0], missing.files.get(UI[0]));
  refresh(missing);
  rejected(missing, /exactly the three authorized sidebar UI files/);
});

test('sidebar publication never permits added or deleted files', () => {
  const added = fixture();
  added.files.set('docs/additional.html', Buffer.from('Synthetic addition'));
  added.manifest.files.push({path:'docs/additional.html',sha256:hash('docs/additional.html', added.files.get('docs/additional.html')),status:'needs-review',reason:'Synthetic'});
  refresh(added);
  rejected(added, /does not permit adding or deleting/);
  const deleted = fixture();
  deleted.files.delete(LEGACY);
  deleted.manifest.files = deleted.manifest.files.filter(row => row.path !== LEGACY);
  deleted.authorization.deletedPaths = [LEGACY];
  refresh(deleted);
  rejected(deleted, /does not permit adding or deleting/);
});

test('source catalog and all review evidence stay identical to the published baseline', () => {
  const catalog = fixture();
  catalog.catalog.note = 'Unrequested metadata';
  refresh(catalog);
  rejected(catalog, /cannot change the source catalog/);
  for (const mutate of [
    f => {f.manifest.files[0].status = 'blocked';},
    f => {f.manifest.files[0].reason = 'Changed review reason';},
    f => {f.manifest.files.find(row => row.path === LEGACY).sha256 = 'a'.repeat(64);},
    f => {f.manifest.note = 'Unrequested review metadata';}
  ]) {
    const f = fixture(); mutate(f); refresh(f);
    rejected(f, /only the three UI hashes/);
  }
  for (const key of ['manifestBytes', 'catalogBytes']) {
    const f = fixture(); f[key] = Buffer.concat([f[key],Buffer.from(' ')]);
    rejected(f, /changed after authorization/);
  }
});

test('stale hashes and missing registrations cannot hide behind pending status', () => {
  const stale = fixture(); stale.manifest.files[0].sha256 = 'a'.repeat(64); refresh(stale);
  rejected(stale, /sha256 differs/);
  const missing = fixture(); missing.manifest.files.shift(); refresh(missing);
  rejected(missing, /missing from the review manifest/);
});

test('moved remote, altered request and fabricated independent review fail closed', () => {
  const moved = fixture(); moved.remoteBase = 'a'.repeat(40);
  rejected(moved, /branch has moved/);
  for (const mutate of [
    a => {a.requestDate = '2026-11-05';},
    a => {a.requestQuote = 'publish everything';},
    a => {a.baselineCommit = 'b'.repeat(40);},
    a => {a.contentReviewPerformed = true;},
    a => {a.scope = '';},
    a => {a.technicalReview.reviewer = ' SYNTHETIC  AUTHOR ';},
    a => {a.technicalReview.note = '';},
    a => {a.technicalReview = 'Unstructured review';}
  ]) {
    const f = fixture(); mutate(f.authorization); rejected(f);
  }
});

test('invalid, duplicated and unlisted inventory or scope entries are rejected', () => {
  const duplicate = fixture(); duplicate.authorization.files.push(duplicate.authorization.files[0]);
  rejected(duplicate, /Invalid or duplicate/);
  const scope = fixture(); scope.authorization.changedPaths.push(UI[0]);
  rejected(scope, /exactly the three/);
  const missing = fixture(); missing.authorization.files.pop();
  rejected(missing, /inventory differs/);
  for (const unsafe of ['docs/../hidden','docs/file:stream','docs\\file.html']) {
    const f = fixture(); f.authorization.files[0].path = unsafe;
    rejected(f, /Invalid or duplicate/);
  }
});

test('CRLF text normalization remains portable and binary bytes remain exact', () => {
  const f = fixture();
  for (const name of [...UI,LEGACY]) f.files.set(name, Buffer.from(f.files.get(name).toString().replace(/\n/g,'\r\n')));
  assert.equal(validateSidebarRelease(f).ok, true);
  f.files.set(VENDOR, Buffer.from([0,255,10]));
  rejected(f, /differs from the authorized snapshot/);
});

test('the new authorization is pinned independently of the October authorizations', () => {
  const original = fs.readFileSync(path.join(__dirname, '..', SIDEBAR_RELEASE_PATH));
  const authorization = readSidebarReleaseAuthorization(original);
  assert.equal(authorization.requestQuote, 'publish');
  assert.deepEqual(authorization.changedPaths, UI);
  const changed = JSON.parse(original); changed.files[0].sha256 = 'a'.repeat(64);
  assert.throws(() => readSidebarReleaseAuthorization(Buffer.from(JSON.stringify(changed))), /differs from the exact user-requested snapshot/);
  assert.throws(() => readSidebarReleaseAuthorization(Buffer.concat([original,Buffer.from(' ')])), /differs from the exact user-requested snapshot/);
});
