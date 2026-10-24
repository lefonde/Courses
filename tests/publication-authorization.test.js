'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {validateAuthorization, APPROVED, INTEGRATION, BASELINE, REQUEST} = require('../scripts/check-publication.cjs');
const {canonicalContentHash, POLICY_VERSION} = require('../scripts/check-course-content.cjs');
const copy = value => JSON.parse(JSON.stringify(value));
const MANIFEST = 'course-content/review-status.json';
const CATALOG = 'course-content/source-catalog.json';
const LEGACY = 'docs/data/unchanged-legacy.json';
const VENDOR = 'docs/vendor/library.js';

function review() {
  const evidence = {sourceId:'fixture-lecture', pdfPage:1, sourceLocator:'Synthetic definition paragraph', evidenceNote:'Synthetic fixture only; this is not course evidence.', sourceExcerpt:'Synthetic definition quotation.'};
  const item = {locator:'#synthetic-definition', kind:'source', evidence:[evidence]};
  return {
    policyVersion:POLICY_VERSION, author:'Synthetic author', reviewer:'Independent synthetic reviewer', reviewedAt:'2026-10-24',
    checks:{sourceFidelity:true, courseTerminology:true, mathematicalCorrectness:true, clarity:true}, unresolved:[],
    lectureAlignment:{status:'verified', evidenceNote:'Synthetic fixture alignment.', evidence:[evidence]},
    coverage:{
      terms:{items:[copy(item)]}, definitions:{items:[copy(item)]},
      claims:{items:[],notApplicableReason:'No claim in the synthetic definition fixture.'},
      proofs:{items:[],notApplicableReason:'No proof in the synthetic definition fixture.'},
      exercises:{items:[],notApplicableReason:'No exercise in the synthetic definition fixture.'}
    }
  };
}

function refreshMetadata(f) {
  f.manifestBytes = Buffer.from(JSON.stringify(f.manifest));
  f.catalogBytes = Buffer.from(JSON.stringify(f.catalog));
  f.authorization.reviewManifestHash = canonicalContentHash(MANIFEST, f.manifestBytes);
  f.authorization.sourceCatalogHash = canonicalContentHash(CATALOG, f.catalogBytes);
}

function refreshInventory(f) {
  f.authorization.files = [...f.files].map(([name, bytes]) => ({path:name, sha256:canonicalContentHash(name, bytes)}));
}

function fixture() {
  const changed = [...APPROVED, ...INTEGRATION];
  const files = new Map(changed.map(name => [name, Buffer.from('Synthetic changed file: ' + name + '\n')]));
  // The dated authorization pins the independently reviewed integration hashes.
  // Read those eight files without modifying them; all course reviews, legacy
  // content, the baseline and all mutations below remain isolated fixtures.
  for (const name of INTEGRATION) files.set(name, fs.readFileSync(path.join(__dirname, '..', name)));
  files.set(LEGACY, Buffer.from('Synthetic unchanged legacy text.\n'));
  files.set(VENDOR, Buffer.from('Synthetic unchanged vendor bytes.\n'));
  const baselineFiles = new Map([...files].map(([name, bytes]) => [name, changed.includes(name) ? Buffer.from('Synthetic old file: ' + name + '\n') : Buffer.from(bytes)]));
  const manifest = {
    schemaVersion:1, policyVersion:POLICY_VERSION,
    files:[...files].filter(([name]) => name !== VENDOR).map(([name, bytes]) => ({
      path:name, sha256:canonicalContentHash(name, bytes), status:APPROVED.includes(name) ? 'approved' : 'needs-review',
      ...(APPROVED.includes(name) ? {review:review()} : {reason:'Not course-reviewed; online review does not approve it.'})
    }))
  };
  const catalog = {schemaVersion:1, sources:[{id:'fixture-lecture', sourceType:'lecture', document:'Synthetic fixture lecture.pdf', sha256:'a'.repeat(64)}]};
  const authorization = {
    schemaVersion:1, kind:'user-requested-online-review', policyVersion:POLICY_VERSION,
    requestQuote:REQUEST, requestDate:'2026-10-24', scope:'Synthetic fixture representing the explicitly bounded online review.',
    baselineCommit:BASELINE, approvedContentPaths:[...APPROVED],
    integrationReview:{reviewer:'Independent integration fixture reviewer', note:'Synthetic integration delta review, not full course approval.', paths:[...INTEGRATION]}
  };
  const f = {authorization, files, baselineFiles, manifest, catalog, remoteBase:BASELINE};
  refreshMetadata(f); refreshInventory(f);
  return f;
}

function rejected(f, pattern) {
  const result = validateAuthorization(f);
  assert.equal(result.ok, false);
  if (pattern) assert.match(result.errors.join('\n'), pattern);
}

test('the exact online-review snapshot passes without changing pending legacy or integration statuses', () => {
  const f = fixture(), before = copy(f.manifest);
  const result = validateAuthorization(f);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.mode, 'authorized-online-review');
  assert.equal(result.reviewedContentFiles, 6);
  assert.equal(result.legacyApprovalGranted, false);
  assert.deepEqual(f.manifest, before, 'validation must not approve or rewrite the review manifest');
  assert.equal(f.manifest.files.filter(row => row.status === 'needs-review').length, INTEGRATION.length + 1);
});

test('any changed content, integration, legacy or vendor byte invalidates the authorized snapshot', () => {
  for (const file of [APPROVED[0], INTEGRATION[0], LEGACY, VENDOR]) {
    const f = fixture(); f.files.set(file, Buffer.concat([f.files.get(file), Buffer.from('changed')]));
    rejected(f, /differs from the authorized snapshot/);
  }
});

test('refreshing inventory alone cannot authorize changes to legacy or vendor files', () => {
  for (const file of [LEGACY, VENDOR]) {
    const f = fixture(); f.files.set(file, Buffer.from('Unreviewed added behavior.')); refreshInventory(f);
    rejected(f, /Changed files differ from the reviewed content and integration scope/);
  }
});

test('published additions and deletions fail even if someone refreshes the snapshot inventory', () => {
  for (const name of ['docs/new.html', 'docs/vendor/added.js']) {
    const f = fixture(); f.files.set(name, Buffer.from('New file.')); refreshInventory(f);
    rejected(f, /does not permit adding or deleting/);
  }
  for (const name of [APPROVED[0], INTEGRATION[0], LEGACY, VENDOR]) {
    const f = fixture(); f.files.delete(name); refreshInventory(f);
    rejected(f, /does not permit adding or deleting/);
  }
});

test('invalid or fabricated required content reviews are not excused by online-review permission', () => {
  for (const mutate of [
    row => {delete row.review;},
    row => {row.review.reviewer = row.review.author;},
    row => {row.review.checks.courseTerminology = false;},
    row => {row.review.unresolved = ['Source not read.'];},
    row => {row.review.coverage.terms.items[0].evidence[0].sourceId = 'outside-course';},
    row => {row.review.coverage.definitions.items[0].evidence[0].sourceExcerpt = '';},
    row => {row.review.lectureAlignment.evidence = [];},
    row => {row.status = 'needs-review';},
    row => {row.status = 'non-instructional'; delete row.review;}
  ]) {
    const f = fixture(); mutate(f.manifest.files.find(row => row.path === APPROVED[0])); refreshMetadata(f);
    rejected(f);
  }
});

test('required approval hashes still bind content if snapshot inventory is refreshed', () => {
  const f = fixture(); f.files.set(APPROVED[0], Buffer.from('A different claim.')); refreshInventory(f);
  rejected(f, /sha256 differs from the reviewed content/);
});

test('rewriting snapshot metadata cannot extend the independent integration review', () => {
  const f = fixture(), name = INTEGRATION[0];
  f.files.set(name, Buffer.concat([f.files.get(name), Buffer.from('\nUnreviewed curriculum change.')]));
  f.manifest.files.find(row => row.path === name).sha256 = canonicalContentHash(name, f.files.get(name));
  refreshInventory(f); refreshMetadata(f);
  rejected(f, /differs from the independently reviewed integration changes/);
});

test('pending status does not excuse stale hashes or extra review-manifest rows', () => {
  const stale = fixture(); stale.manifest.files.find(row => row.path === LEGACY).sha256 = 'c'.repeat(64); refreshMetadata(stale);
  rejected(stale, /sha256 differs from the reviewed content/);
  const extra = fixture(); extra.manifest.files.push({path:'docs/absent.html', sha256:'d'.repeat(64), status:'needs-review'}); refreshMetadata(extra);
  rejected(extra, /no corresponding protected file/);
});

test('manifest and source-catalog bytes remain bound to the authorization', () => {
  for (const field of ['manifestBytes','catalogBytes']) {
    const f = fixture(); f[field] = Buffer.concat([f[field], Buffer.from(' ')]);
    rejected(f, /Review records or source catalog changed/);
  }
  const invalidCatalog = fixture(); invalidCatalog.catalog.sources[0].sourceType = 'external'; refreshMetadata(invalidCatalog);
  rejected(invalidCatalog, /unsupported sourceType/);
});

test('legacy and integration files must retain pending status, including known blocked content', () => {
  const blocked = fixture(); blocked.manifest.files.find(row => row.path === LEGACY).status = 'blocked'; refreshMetadata(blocked);
  assert.equal(validateAuthorization(blocked).ok, true);
  for (const name of [LEGACY, INTEGRATION[0]]) for (const status of ['approved','non-instructional','waived']) {
    const f = fixture(); f.manifest.files.find(row => row.path === name).status = status; refreshMetadata(f);
    rejected(f, /must retain its pending review status/);
  }
});

test('a different baseline or moved remote publishing branch requires a new decision', () => {
  const changedBaseline = fixture(); changedBaseline.authorization.baselineCommit = 'b'.repeat(40);
  rejected(changedBaseline, /previously published baseline/);
  const movedRemote = fixture(); movedRemote.remoteBase = 'c'.repeat(40);
  rejected(movedRemote, /publishing branch has moved/);
  const branchCreation = fixture(); branchCreation.remoteBase = '0'.repeat(40);
  rejected(branchCreation, /publishing branch has moved/);
});

test('the precise request and approved-content/integration scope cannot be widened or omitted', () => {
  for (const mutate of [
    a => {a.requestQuote = 'Please publish everything.';},
    a => {a.requestDate = '2026-10-25';},
    a => {a.scope = '';},
    a => {a.approvedContentPaths.pop();},
    a => {a.approvedContentPaths.push(LEGACY);},
    a => {a.integrationReview.paths.pop();},
    a => {a.integrationReview.paths.push(LEGACY);},
    a => {delete a.integrationReview;},
    a => {a.integrationReview.reviewer = '';},
    a => {a.integrationReview.reviewer = '   ';},
    a => {a.integrationReview.note = '   ';}
  ]) {
    const f = fixture(); mutate(f.authorization); rejected(f);
  }
});

test('duplicate, unsafe and omitted authorization entries fail closed', () => {
  const duplicate = fixture(); duplicate.authorization.files.push(copy(duplicate.authorization.files[0]));
  rejected(duplicate, /Invalid or duplicate/);
  for (const unsafe of ['docs/../hidden.html','docs/file:stream','docs/./file.html','docs\\file.html','docs/file.html.']) {
    const f = fixture(); f.authorization.files[0].path = unsafe; rejected(f, /Invalid or duplicate/);
  }
  const missing = fixture(); missing.authorization.files.pop(); rejected(missing, /inventory differs/);
});

test('authorization tolerates only canonical CRLF conversion, not meaningful text changes', () => {
  const lineEndings = fixture();
  for (const [name, bytes] of lineEndings.files) lineEndings.files.set(name, Buffer.from(bytes.toString().replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')));
  assert.equal(validateAuthorization(lineEndings).ok, true);
  const whitespace = fixture(); whitespace.files.set(APPROVED[0], Buffer.concat([whitespace.files.get(APPROVED[0]), Buffer.from(' ')]));
  rejected(whitespace, /differs from the authorized snapshot/);
});

test('explicit vendor LICENSE names allow checkout CRLF conversion but preserve license text and lone CR', () => {
  for (const name of ['docs/vendor/example/LICENSE', 'docs/vendor/example/LICENSE_MIT', 'docs/vendor/example/LICENSE_APACHE_2']) {
    const f = fixture(), lf = Buffer.from('Synthetic license line one.\nSynthetic license line two.\n');
    f.files.set(name, lf); f.baselineFiles.set(name, lf); refreshInventory(f);
    f.files.set(name, Buffer.from(lf.toString().replace(/\n/g, '\r\n')));
    const result = validateAuthorization(f);
    assert.equal(result.ok, true, result.errors.join('\n'));
    f.files.set(name, Buffer.from('Different license terms.\r\n'));
    rejected(f, /differs from the authorized snapshot/);
    f.files.set(name, Buffer.from(lf.toString().replace(/\n/g, '\r')));
    rejected(f, /differs from the authorized snapshot/);
  }
});

test('license portability does not normalize other extensionless files or binary vendor data', () => {
  for (const name of ['docs/vendor/example/README', 'docs/vendor/example/LICENSE_lowercase', 'docs/vendor/example/LICENSE.bin', 'docs/vendor/example/font.woff2']) {
    const f = fixture(), bytes = Buffer.from([0, 255, 13, 10, 1, 2]);
    f.files.set(name, bytes); f.baselineFiles.set(name, bytes); refreshInventory(f);
    assert.equal(validateAuthorization(f).ok, true);
    f.files.set(name, Buffer.from([0, 255, 10, 1, 2]));
    rejected(f, /differs from the authorized snapshot/);
  }
});
