'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  validateNov17SiteRelease, readNov17SiteReleaseAuthorization,
  validateSiteRelease, validateNov4SiteRelease, validateNov6SiteRelease,
  publicationContentHash: hash, NOV17_SITE_RELEASE_PATH, NOV17_SITE_RELEASE_BASELINE
} = require('../scripts/check-publication.cjs');
const { POLICY_VERSION } = require('../scripts/check-course-content.cjs');
const MANIFEST = 'course-content/review-status.json', CATALOG = 'course-content/source-catalog.json';
const EXISTING = 'docs/existing.html', SHARED = 'docs/course-registry.js';
const ADDED = 'docs/courses/advanced-algorithms/exam-prep.json', VENDOR = 'docs/vendor/font.woff2';

function refresh(f) {
  f.manifestBytes = Buffer.from(JSON.stringify(f.manifest));
  f.catalogBytes = Buffer.from(JSON.stringify(f.catalog));
  f.authorization.reviewManifestHash = hash(MANIFEST, f.manifestBytes);
  f.authorization.sourceCatalogHash = hash(CATALOG, f.catalogBytes);
  f.authorization.files = [...f.files].map(([name, bytes]) => ({ path: name, sha256: hash(name, bytes) }));
}

function fixture() {
  const files = new Map([
    [EXISTING, Buffer.from('Unchanged synthetic legacy lesson\n')],
    [SHARED, Buffer.from('Synthetic shared configuration\n')],
    [ADDED, Buffer.from('{"kind":"synthetic-unreviewed-backlog"}\n')],
    [VENDOR, Buffer.from([0, 255, 13, 10])]
  ]);
  const baselineFiles = new Map([...files].filter(([name]) => ![SHARED, ADDED].includes(name)));
  const manifest = {
    schemaVersion: 1, policyVersion: POLICY_VERSION,
    files: [...files].filter(([name]) => name !== VENDOR).map(([name, bytes]) => ({
      path: name, sha256: hash(name, bytes), status: name === EXISTING ? 'blocked' : 'needs-review', reason: 'Synthetic pending review'
    }))
  };
  const catalog = { schemaVersion: 1, sources: [] };
  const authorization = {
    schemaVersion: 1, kind: 'user-requested-site-release', policyVersion: POLICY_VERSION,
    requestQuote: 'publish', requestDate: '2026-11-17', scope: 'Synthetic multi-course setup release',
    baselineCommit: NOV17_SITE_RELEASE_BASELINE, contentReviewPerformed: false,
    technicalReview: 'Independent synthetic technical verification only; no new academic approval',
    changedPaths: [SHARED, ADDED], deletedPaths: []
  };
  const f = { authorization, files, baselineFiles, manifest, catalog, remoteBase: NOV17_SITE_RELEASE_BASELINE };
  refresh(f);
  return f;
}

function rejected(f, pattern) {
  const result = validateNov17SiteRelease(f);
  assert.equal(result.ok, false);
  if (pattern) assert.match(result.errors.join('\n'), pattern);
}

test('17-Nov exact setup snapshot preserves legacy content and pending academic review', () => {
  const f = fixture(), before = JSON.stringify(f.manifest);
  const result = validateNov17SiteRelease(f);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.mode, 'authorized-site-release-2026-11-17');
  assert.equal(result.contentReviewPerformed, false);
  assert.equal(result.legacyApprovalGranted, false);
  assert.equal(JSON.stringify(f.manifest), before);
  for (const earlierValidator of [validateSiteRelease, validateNov4SiteRelease, validateNov6SiteRelease]) {
    assert.equal(earlierValidator(f).ok, false, 'Earlier dated authorizations cannot approve this request');
  }
});

test('17-Nov request rejects changed quote, date, baseline, scope and claimed academic review', () => {
  for (const mutate of [
    a => { a.requestQuote = 'publish it'; },
    a => { a.requestDate = '2026-11-04'; },
    a => { a.requestDate = '2026-11-18'; },
    a => { a.baselineCommit = 'a'.repeat(40); },
    a => { a.kind = 'user-requested-sidebar-release'; },
    a => { a.scope = ' '; },
    a => { a.contentReviewPerformed = true; },
    a => { a.technicalReview = ''; }
  ]) {
    const f = fixture(); mutate(f.authorization); rejected(f);
  }
  const moved = fixture(); moved.remoteBase = 'b'.repeat(40);
  rejected(moved, /branch has moved/);
});

test('17-Nov changes to either course, shared assets or vendor bytes invalidate the snapshot', () => {
  for (const name of [EXISTING, SHARED, ADDED, VENDOR]) {
    const f = fixture(); f.files.set(name, Buffer.concat([f.files.get(name), Buffer.from('changed')]));
    rejected(f, /differs from the authorized snapshot/);
  }
});

test('17-Nov complete inventory rejects missing, duplicate, unsafe and newly added paths', () => {
  const missing = fixture(); missing.authorization.files.pop(); rejected(missing, /inventory differs/);
  const duplicate = fixture(); duplicate.authorization.files.push(duplicate.authorization.files[0]); rejected(duplicate, /Invalid or duplicate/);
  const scope = fixture(); scope.authorization.changedPaths.push(SHARED); rejected(scope, /Changed files differ/);
  for (const unsafe of ['docs/../private', 'docs/file:stream', 'docs\\file.html']) {
    const f = fixture(); f.authorization.files[0].path = unsafe; rejected(f, /Invalid or duplicate/);
  }
  const added = fixture(); added.files.set('docs/unlisted.html', Buffer.from('Unrequested synthetic page'));
  rejected(added, /inventory differs/);
  added.manifest.files.push({ path: 'docs/unlisted.html', sha256: hash('docs/unlisted.html', added.files.get('docs/unlisted.html')), status: 'needs-review' });
  refresh(added); rejected(added, /Changed files differ/);
});

test('17-Nov authorization cannot delete existing public files by refreshing its inventory', () => {
  const f = fixture(); f.files.delete(EXISTING);
  f.manifest.files = f.manifest.files.filter(row => row.path !== EXISTING);
  f.authorization.deletedPaths = [EXISTING]; refresh(f);
  rejected(f, /does not authorize deleting/);
});

test('17-Nov source catalog and review manifest remain exact and structurally checked', () => {
  for (const field of ['manifestBytes', 'catalogBytes']) {
    const f = fixture(); f[field] = Buffer.concat([f[field], Buffer.from(' ')]);
    rejected(f, /changed after authorization/);
  }
  const stale = fixture(); stale.manifest.files[0].sha256 = 'a'.repeat(64); refresh(stale); rejected(stale, /sha256 differs/);
  const missing = fixture(); missing.manifest.files.pop(); refresh(missing); rejected(missing, /missing from the review manifest/);
  const approval = fixture(); approval.manifest.files[0].status = 'approved'; refresh(approval); rejected(approval, /review/);
  const catalog = fixture(); catalog.catalog.schemaVersion = 99; refresh(catalog); rejected(catalog, /source-catalog/);
});

test('17-Nov snapshot normalizes text line endings without normalizing binary data', () => {
  const f = fixture();
  for (const name of [EXISTING, SHARED, ADDED]) f.files.set(name, Buffer.from(f.files.get(name).toString().replace(/\n/g, '\r\n')));
  assert.equal(validateNov17SiteRelease(f).ok, true);
  f.files.set(VENDOR, Buffer.from([0, 255, 10])); rejected(f, /differs from the authorized snapshot/);
});

test('17-Nov arbitrary authorization bytes never substitute for the separately pinned record', () => {
  const f = fixture();
  assert.throws(() => readNov17SiteReleaseAuthorization(Buffer.from(JSON.stringify(f.authorization))), /differs from the exact user-requested snapshot/);
});

test('17-Nov recorded authorization has its final pin and rejects any tampering', () => {
  // This is intentionally mandatory, not skipped when the release record or
  // its final hash is missing. Release preparation must complete both first.
  const original = fs.readFileSync(path.join(__dirname, '..', NOV17_SITE_RELEASE_PATH));
  const a = readNov17SiteReleaseAuthorization(original);
  assert.equal(a.requestQuote, 'publish');
  assert.equal(a.requestDate, '2026-11-17');
  assert.equal(a.baselineCommit, NOV17_SITE_RELEASE_BASELINE);
  assert.equal(a.contentReviewPerformed, false);
  for (const mutate of [
    changed => { changed.files[0].sha256 = 'a'.repeat(64); },
    changed => { changed.reviewManifestHash = 'b'.repeat(64); },
    changed => { changed.sourceCatalogHash = 'c'.repeat(64); },
    changed => { changed.requestQuote = 'publish tomorrow'; }
  ]) {
    const changed = JSON.parse(original); mutate(changed);
    assert.throws(() => readNov17SiteReleaseAuthorization(Buffer.from(JSON.stringify(changed))), /differs from the exact user-requested snapshot/);
  }
  assert.throws(() => readNov17SiteReleaseAuthorization(Buffer.concat([original, Buffer.from(' ')])), /differs from the exact user-requested snapshot/);
});
