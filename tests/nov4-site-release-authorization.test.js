'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  validateNov4SiteRelease, readNov4SiteReleaseAuthorization,
  validateSiteRelease, publicationContentHash:hash,
  NOV4_SITE_RELEASE_PATH, NOV4_SITE_RELEASE_BASELINE
} = require('../scripts/check-publication.cjs');
const {POLICY_VERSION} = require('../scripts/check-course-content.cjs');
const MANIFEST = 'course-content/review-status.json', CATALOG = 'course-content/source-catalog.json';
const EXISTING = 'docs/existing.html', ADDED = 'docs/new.html';
const SIDEBAR = 'docs/sidebar.css', VENDOR = 'docs/vendor/font.woff2';

function refresh(f) {
  f.manifestBytes = Buffer.from(JSON.stringify(f.manifest));
  f.catalogBytes = Buffer.from(JSON.stringify(f.catalog));
  f.authorization.reviewManifestHash = hash(MANIFEST, f.manifestBytes);
  f.authorization.sourceCatalogHash = hash(CATALOG, f.catalogBytes);
  f.authorization.files = [...f.files].map(([name, bytes]) => ({path:name, sha256:hash(name, bytes)}));
}

function fixture() {
  const files = new Map([
    [EXISTING, Buffer.from('Updated synthetic lesson\n')],
    [ADDED, Buffer.from('New synthetic lesson\n')],
    [SIDEBAR, Buffer.from('Previously published sidebar\n')],
    [VENDOR, Buffer.from([0,255,13,10])]
  ]);
  const baselineFiles = new Map([...files].filter(([name]) => name !== ADDED));
  baselineFiles.set(EXISTING, Buffer.from('Previous synthetic lesson\n'));
  const manifest = {
    schemaVersion:1, policyVersion:POLICY_VERSION,
    files:[...files].filter(([name]) => name !== VENDOR).map(([name, bytes]) => ({
      path:name, sha256:hash(name, bytes), status:name === EXISTING ? 'blocked' : 'needs-review', reason:'Synthetic pending review'
    }))
  };
  const catalog = {schemaVersion:1, sources:[]};
  const authorization = {
    schemaVersion:1, kind:'user-requested-site-release', policyVersion:POLICY_VERSION,
    requestQuote:'publish it', requestDate:'2026-11-04', scope:'Synthetic current-site release',
    baselineCommit:NOV4_SITE_RELEASE_BASELINE, contentReviewPerformed:false,
    technicalReview:'Independent synthetic technical check; no course-content review',
    changedPaths:[EXISTING, ADDED], deletedPaths:[]
  };
  const f = {authorization, files, baselineFiles, manifest, catalog, remoteBase:NOV4_SITE_RELEASE_BASELINE};
  refresh(f);
  return f;
}

function rejected(f, pattern) {
  const result = validateNov4SiteRelease(f);
  assert.equal(result.ok, false);
  if (pattern) assert.match(result.errors.join('\n'), pattern);
}

test('4-Nov site release permits its exact additions and retains existing sidebar and pending review status', () => {
  const f = fixture(), before = JSON.stringify(f.manifest);
  const result = validateNov4SiteRelease(f);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.mode, 'authorized-site-release-2026-11-04');
  assert.equal(result.contentReviewPerformed, false);
  assert.equal(result.legacyApprovalGranted, false);
  assert.equal(JSON.stringify(f.manifest), before);
  assert.equal(validateSiteRelease(f).ok, false, 'The October authorization cannot authorize this new request');
});

test('4-Nov current-site request cannot be replaced with the earlier sidebar or October request', () => {
  for (const mutate of [
    a => {a.requestQuote = 'publish';},
    a => {a.requestQuote = 'push the current site'; a.requestDate = '2026-10-26';},
    a => {a.requestDate = '2026-11-05';},
    a => {a.baselineCommit = '83be09beb46e5fb7f6d829c335f1e17a8482b4d3';},
    a => {a.kind = 'user-requested-sidebar-release';},
    a => {a.scope = ' ';},
    a => {a.contentReviewPerformed = true;},
    a => {a.technicalReview = '';}
  ]) {
    const f = fixture(); mutate(f.authorization); rejected(f);
  }
  const moved = fixture(); moved.remoteBase = 'a'.repeat(40);
  rejected(moved, /branch has moved/);
});

test('later lesson, sidebar and binary vendor changes all invalidate the exact 4-Nov snapshot', () => {
  for (const name of [EXISTING, ADDED, SIDEBAR, VENDOR]) {
    const f = fixture(); f.files.set(name, Buffer.concat([f.files.get(name), Buffer.from('changed')]));
    rejected(f, /differs from the authorized snapshot/);
  }
});

test('4-Nov scope rejects unlisted additions and any deletion even with refreshed inventory', () => {
  const added = fixture();
  added.files.set('docs/extra.html', Buffer.from('Unrequested synthetic page'));
  added.manifest.files.push({path:'docs/extra.html', sha256:hash('docs/extra.html', added.files.get('docs/extra.html')), status:'needs-review'});
  refresh(added); rejected(added, /Changed files differ/);
  const deleted = fixture(); deleted.files.delete(SIDEBAR);
  deleted.manifest.files = deleted.manifest.files.filter(row => row.path !== SIDEBAR);
  deleted.authorization.deletedPaths = [SIDEBAR];
  refresh(deleted); rejected(deleted, /does not authorize deleting/);
});

test('4-Nov authorization requires the complete unique inventory and exact changed paths', () => {
  const missing = fixture(); missing.authorization.files.pop(); rejected(missing, /inventory differs/);
  const duplicate = fixture(); duplicate.authorization.files.push(duplicate.authorization.files[0]); rejected(duplicate, /Invalid or duplicate/);
  const scope = fixture(); scope.authorization.changedPaths.push(EXISTING); rejected(scope, /Changed files differ/);
  for (const unsafe of ['docs/../hidden', 'docs/file:stream', 'docs\\file.html']) {
    const f = fixture(); f.authorization.files[0].path = unsafe; rejected(f, /Invalid or duplicate/);
  }
});

test('4-Nov release preserves structural checks for source catalog, review records and existing approvals', () => {
  const stale = fixture(); stale.manifest.files[0].sha256 = 'a'.repeat(64); refresh(stale); rejected(stale, /sha256 differs/);
  const missing = fixture(); missing.manifest.files.pop(); refresh(missing); rejected(missing, /missing from the review manifest/);
  const approval = fixture(); approval.manifest.files[0].status = 'approved'; refresh(approval); rejected(approval, /review/);
  const catalog = fixture(); catalog.catalog.schemaVersion = 99; refresh(catalog); rejected(catalog, /source-catalog/);
  for (const field of ['manifestBytes', 'catalogBytes']) {
    const f = fixture(); f[field] = Buffer.concat([f[field], Buffer.from(' ')]);
    rejected(f, /changed after authorization/);
  }
});

test('4-Nov snapshot permits canonical text line endings but preserves exact binary data', () => {
  const f = fixture();
  for (const name of [EXISTING, ADDED, SIDEBAR]) f.files.set(name, Buffer.from(f.files.get(name).toString().replace(/\n/g, '\r\n')));
  assert.equal(validateNov4SiteRelease(f).ok, true);
  f.files.set(VENDOR, Buffer.from([0,255,10])); rejected(f, /differs from the authorized snapshot/);
});

test('4-Nov site authorization bytes are pinned independently and cannot be refreshed for future edits', () => {
  const original = fs.readFileSync(path.join(__dirname, '..', NOV4_SITE_RELEASE_PATH));
  const a = readNov4SiteReleaseAuthorization(original);
  assert.equal(a.requestQuote, 'publish it');
  assert.equal(a.requestDate, '2026-11-04');
  assert.equal(a.baselineCommit, NOV4_SITE_RELEASE_BASELINE);
  assert.equal(a.contentReviewPerformed, false);
  const changed = JSON.parse(original); changed.files[0].sha256 = 'a'.repeat(64);
  assert.throws(() => readNov4SiteReleaseAuthorization(Buffer.from(JSON.stringify(changed))), /differs from the exact user-requested snapshot/);
  assert.throws(() => readNov4SiteReleaseAuthorization(Buffer.concat([original, Buffer.from(' ')])), /differs from the exact user-requested snapshot/);
});
