'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {validateSiteRelease, readSiteReleaseAuthorization, publicationContentHash:hash, SITE_RELEASE_PATH, SITE_RELEASE_BASELINE} = require('../scripts/check-publication.cjs');
const {POLICY_VERSION} = require('../scripts/check-course-content.cjs');
const MANIFEST = 'course-content/review-status.json';
const CATALOG = 'course-content/source-catalog.json';
const OLD = 'docs/existing.html', NEW = 'docs/new.html', LEGACY = 'docs/legacy.html', VENDOR = 'docs/vendor/font.woff2';

function refresh(f) {
  f.manifestBytes = Buffer.from(JSON.stringify(f.manifest));
  f.catalogBytes = Buffer.from(JSON.stringify(f.catalog));
  f.authorization.reviewManifestHash = hash(MANIFEST, f.manifestBytes);
  f.authorization.sourceCatalogHash = hash(CATALOG, f.catalogBytes);
  f.authorization.files = [...f.files].map(([name, bytes]) => ({path:name, sha256:hash(name, bytes)}));
}

function fixture() {
  const files = new Map([[OLD, Buffer.from('Changed synthetic page\n')], [NEW, Buffer.from('New synthetic page\n')], [LEGACY, Buffer.from('Unchanged synthetic page\n')], [VENDOR, Buffer.from([0, 255, 13, 10])]]);
  const baselineFiles = new Map([...files].filter(([name]) => name !== NEW));
  baselineFiles.set(OLD, Buffer.from('Previous synthetic page\n'));
  const manifest = {schemaVersion:1, policyVersion:POLICY_VERSION, files:[...files].filter(([name]) => name !== VENDOR).map(([name, bytes]) => ({path:name, sha256:hash(name, bytes), status:name === LEGACY ? 'blocked' : 'needs-review', reason:'Synthetic unreviewed fixture'}))};
  const catalog = {schemaVersion:1, sources:[]};
  const authorization = {
    schemaVersion:1, kind:'user-requested-site-release', policyVersion:POLICY_VERSION,
    requestQuote:'push the current site', requestDate:'2026-10-26', scope:'Synthetic release fixture',
    baselineCommit:SITE_RELEASE_BASELINE, contentReviewPerformed:false, technicalReview:'Synthetic technical check only',
    changedPaths:[OLD,NEW], deletedPaths:[]
  };
  const f = {authorization, files, baselineFiles, manifest, catalog, remoteBase:SITE_RELEASE_BASELINE};
  refresh(f);
  return f;
}

function rejected(f, pattern) {
  const result = validateSiteRelease(f);
  assert.equal(result.ok, false);
  if (pattern) assert.match(result.errors.join('\n'), pattern);
}

test('exact release permits the authorized added page but preserves all pending review statuses', () => {
  const f = fixture(), before = JSON.stringify(f.manifest);
  const result = validateSiteRelease(f);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.mode, 'authorized-site-release');
  assert.equal(result.contentReviewPerformed, false);
  assert.equal(result.legacyApprovalGranted, false);
  assert.equal(JSON.stringify(f.manifest), before);
});

test('any changed page or vendor byte invalidates the pinned inventory', () => {
  for (const file of [OLD, NEW, LEGACY, VENDOR]) {
    const f = fixture(); f.files.set(file, Buffer.concat([f.files.get(file), Buffer.from('changed')]));
    rejected(f, /differs from the authorized snapshot/);
  }
});

test('unlisted additions and deletions fail even with a refreshed inventory', () => {
  const added = fixture();
  added.files.set('docs/unrequested.html', Buffer.from('Synthetic extra'));
  added.manifest.files.push({path:'docs/unrequested.html', sha256:hash('docs/unrequested.html', added.files.get('docs/unrequested.html')), status:'needs-review'});
  refresh(added); rejected(added, /Changed files differ/);
  const deleted = fixture(); deleted.files.delete(LEGACY); deleted.manifest.files = deleted.manifest.files.filter(row => row.path !== LEGACY); refresh(deleted);
  deleted.authorization.deletedPaths = [LEGACY]; rejected(deleted, /does not authorize deleting/);
});

test('stale hashes, missing registrations and malformed approval cannot hide behind pending status', () => {
  const stale = fixture(); stale.manifest.files[0].sha256 = 'a'.repeat(64); refresh(stale); rejected(stale, /sha256 differs/);
  const missing = fixture(); missing.manifest.files.pop(); refresh(missing); rejected(missing, /missing from the review manifest/);
  const approval = fixture(); approval.manifest.files[0].status = 'approved'; refresh(approval); rejected(approval, /review/);
  const catalog = fixture(); catalog.catalog.schemaVersion = 99; refresh(catalog); rejected(catalog, /source-catalog/);
});

test('source catalog and manifest remain bound to authorization bytes', () => {
  for (const field of ['manifestBytes', 'catalogBytes']) {
    const f = fixture(); f[field] = Buffer.concat([f[field], Buffer.from(' ')]);
    rejected(f, /changed after authorization/);
  }
});

test('remote branch movement, fabricated content approval and altered request metadata are rejected', () => {
  const moved = fixture(); moved.remoteBase = 'b'.repeat(40); rejected(moved, /branch has moved/);
  for (const mutate of [a => {a.requestDate = '2026-10-27';}, a => {a.requestQuote = 'something else';}, a => {a.baselineCommit = 'c'.repeat(40);}, a => {a.contentReviewPerformed = true;}, a => {a.technicalReview = '';}, a => {a.scope = ' ';}]) {
    const f = fixture(); mutate(f.authorization); rejected(f);
  }
});

test('duplicate or unsafe inventory and change-scope paths fail closed', () => {
  const duplicate = fixture(); duplicate.authorization.files.push(duplicate.authorization.files[0]); rejected(duplicate, /Invalid or duplicate/);
  const scope = fixture(); scope.authorization.changedPaths.push(OLD); rejected(scope, /Changed files differ/);
  for (const unsafe of ['docs/../hidden','docs/file:stream','docs\\file.html']) {
    const f = fixture(); f.authorization.files[0].path = unsafe; rejected(f, /Invalid or duplicate/);
  }
});

test('canonical text CRLF is portable while meaningful text and binary edits are not', () => {
  const f = fixture();
  for (const name of [OLD, NEW, LEGACY]) f.files.set(name, Buffer.from(f.files.get(name).toString().replace(/\n/g,'\r\n')));
  assert.equal(validateSiteRelease(f).ok, true);
  f.files.set(VENDOR, Buffer.from([0,255,10])); rejected(f, /differs from the authorized snapshot/);
});

test('the dated authorization itself is pinned and cannot be refreshed to authorize future content', () => {
  const original = fs.readFileSync(path.join(__dirname, '..', SITE_RELEASE_PATH));
  const parsed = readSiteReleaseAuthorization(original);
  assert.equal(parsed.requestQuote, 'push the current site');
  const changed = JSON.parse(original);
  changed.files[0].sha256 = 'a'.repeat(64);
  assert.throws(() => readSiteReleaseAuthorization(Buffer.from(JSON.stringify(changed))), /differs from the exact user-requested snapshot/);
  assert.throws(() => readSiteReleaseAuthorization(Buffer.concat([original, Buffer.from(' ')])), /differs from the exact user-requested snapshot/);
});
