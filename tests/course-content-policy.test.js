'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { POLICY_VERSION, MANIFEST_PATH, CATALOG_PATH, canonicalContentHash, validateManifest, checkRepository } = require('../scripts/check-course-content.cjs');

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const copy = object => JSON.parse(JSON.stringify(object));
const evidence = () => ({ sourceId: 'guide-5', pdfPage: 16, sourceLocator: 'Paragraph defining the uniform vector', evidenceNote: 'Synthetic fixture: the cited passage supplies the definition.', sourceExcerpt: 'Synthetic fixture quote defining the term.' });
const sourceItem = () => ({ locator: '#definition', kind: 'source', evidence: [evidence()] });
function fixture() {
  const bytes = Buffer.from('<p>A synthetic course definition.</p>\n');
  const review = {
    policyVersion: POLICY_VERSION, author: 'Fixture author', reviewer: 'Independent fixture reviewer', reviewedAt: '2026-10-24T10:00:00Z',
    checks: { sourceFidelity: true, courseTerminology: true, mathematicalCorrectness: true, clarity: true },
    coverage: {
      terms: { items: [sourceItem()] }, definitions: { items: [sourceItem()] },
      claims: { items: [{ locator: '#claim', kind: 'course-derivation', evidence: [evidence()], derivationNote: 'The synthetic claim follows from the recorded course definition.' }] },
      proofs: { items: [], notApplicableReason: 'This fixture contains no proof.' },
      exercises: { items: [], notApplicableReason: 'This fixture contains no exercise.' }
    },
    unresolved: [], lectureAlignment: { status: 'verified', evidenceNote: 'Synthetic fixture alignment record.', evidence: [{ ...evidence(), sourceId: 'lecture-4', pdfPage: 5 }] }
  };
  return {
    files: new Map([['docs/lesson.html', bytes]]),
    catalog: { schemaVersion: 1, sources: [{ id: 'guide-5', sourceType: 'guide', document: 'Course Guide - Chapter 5.pdf', sha256: 'a'.repeat(64) }, { id: 'lecture-4', sourceType: 'lecture', document: 'Lecture 4.pdf', sha256: 'b'.repeat(64) }] },
    manifest: { schemaVersion: 1, policyVersion: POLICY_VERSION, files: [{ path: 'docs/lesson.html', sha256: canonicalContentHash('docs/lesson.html', bytes), status: 'approved', review }] }
  };
}
const validate = f => validateManifest(f.manifest, f.files, f.catalog);
const rejects = (f, pattern) => { const result = validate(f); assert.equal(result.ok, false); assert.match(result.errors.join('\n'), pattern); };

test('a complete, independently reviewed record binds all required coverage to exact bytes and course sources', () => {
  const f = fixture();
  assert.equal(validate(f).ok, true);
  f.manifest.files[0].review.reviewedAt = '2026-10-24';
  assert.equal(validate(f).ok, true, 'ISO calendar dates are supported as well as timestamps');
  f.manifest.files[0].review.coverage.definitions.items[0].evidence[0].document = f.catalog.sources[0].document;
  f.manifest.files[0].review.coverage.definitions.items[0].evidence[0].sourceType = 'guide';
  assert.equal(validate(f).ok, true, 'optional redundant source fields must agree');
});

test('new CSS, image and ignored-extension files cannot bypass the manifest', () => {
  for (const name of ['docs/new.css', 'docs/assets/diagram.png', 'docs/hidden.pdf', 'docs/.hidden']) {
    const f = fixture(); f.files.set(name, Buffer.from([0, 1, 255]));
    rejects(f, /missing from the review manifest/);
  }
  const f = fixture(); f.files.set('docs/vendor/library.js', 'vendored dependency');
  assert.equal(validate(f).ok, true, 'only the explicit vendor subtree is excluded');
  f.files.set('docs/vendor-copy/library.js', 'authored code');
  rejects(f, /missing from the review manifest/);
});

test('changed bytes, missing files, duplicate rows and obsolete manifest entries fail', () => {
  const changed = fixture(); changed.files.set('docs/lesson.html', '<p>Changed claim.</p>'); rejects(changed, /sha256 differs/);
  const missing = fixture(); missing.manifest.files = []; rejects(missing, /missing from the review manifest/);
  const duplicate = fixture(); duplicate.manifest.files.push(copy(duplicate.manifest.files[0])); rejects(duplicate, /duplicate manifest path/);
  const obsolete = fixture(); obsolete.manifest.files.push({ ...copy(obsolete.manifest.files[0]), path: 'docs/deleted.html' }); rejects(obsolete, /no corresponding protected file/);
  const invalidHash = fixture(); invalidHash.manifest.files[0].sha256 = 'not-a-hash'; rejects(invalidHash, /64 hexadecimal/);
});

test('only CRLF in known text formats is normalized; meaningful changes and binary bytes remain bound', () => {
  const lf = Buffer.from('<p>Claim.</p>\n');
  const crlf = Buffer.from('<p>Claim.</p>\r\n');
  for (const ext of ['js', 'cjs', 'mjs', 'json', 'html', 'css', 'svg', 'md', 'txt', 'yml', 'yaml', 'csv']) {
    assert.equal(canonicalContentHash(`docs/file.${ext}`, crlf), digest(lf));
  }
  const name = 'docs/lesson.html';
  assert.notEqual(canonicalContentHash(name, lf), canonicalContentHash(name, '<p>Changed claim.</p>\n'));
  assert.notEqual(canonicalContentHash(name, lf), canonicalContentHash(name, '<p>Claim.</p> \n'));
  assert.notEqual(canonicalContentHash(name, lf), canonicalContentHash(name, Buffer.concat([Buffer.from([239, 187, 191]), lf])));
  assert.notEqual(canonicalContentHash(name, lf), canonicalContentHash(name, '<p>Claim.</p>\r'));
  assert.equal(canonicalContentHash('docs/diagram.png', crlf), digest(crlf));
  assert.notEqual(canonicalContentHash('docs/diagram.png', crlf), canonicalContentHash('docs/diagram.png', lf));
  assert.equal(canonicalContentHash('docs/unknown.bin', crlf), digest(crlf));
  const f = fixture(); f.files.set(name, Buffer.from(f.files.get(name).toString().replace(/\n/g, '\r\n')));
  assert.equal(validate(f).ok, true, 'Windows line ending conversion alone does not invalidate review');
});

test('unsafe paths, vendor approval rows and case collisions fail closed', () => {
  for (const file of ['docs/../lesson.html', '/docs/lesson.html', 'docs\\lesson.html', 'docs//lesson.html', 'docs/./lesson.html', 'docs/lesson.html.', 'docs/file:stream', 'docs/vendor/lesson.html']) {
    const f = fixture(); f.manifest.files[0].path = file; rejects(f, /path must be canonical and protected/);
  }
  const f = fixture(); f.files.set('docs/Lesson.html', f.files.get('docs/lesson.html'));
  rejects(f, /case-insensitive path collision/);
});

test('needs-review, blocked and fabricated status names never become approval', () => {
  for (const status of ['needs-review', 'blocked', 'passed', true, null]) {
    const f = fixture(); f.manifest.files[0].status = status;
    rejects(f, /prevents publication|unknown review status/);
  }
  const absent = fixture(); delete absent.manifest.files[0].review; rejects(absent, /requires a review object/);
  for (const checks of [{}, { sourceFidelity: 'true', courseTerminology: true, mathematicalCorrectness: true, clarity: true }, { sourceFidelity: true, courseTerminology: true, mathematicalCorrectness: false, clarity: true }]) {
    const f = fixture(); f.manifest.files[0].review.checks = checks; rejects(f, /must be true/);
  }
});

test('approval requires a different reviewer, valid date, current policy and no unresolved issues', () => {
  for (const mutate of [
    r => { r.author = ''; }, r => { r.reviewer = ''; }, r => { r.reviewer = '  FIXTURE   AUTHOR  '; },
    r => { r.reviewedAt = '2026-02-30'; }, r => { r.reviewedAt = 'next Tuesday'; },
    r => { r.policyVersion = 'old'; }, r => { r.unresolved = ['source not read']; }, r => { delete r.unresolved; }
  ]) {
    const f = fixture(); mutate(f.manifest.files[0].review); assert.equal(validate(f).ok, false);
  }
  const f = fixture(); f.manifest.policyVersion = 'old'; rejects(f, /policyVersion/);
});

test('every coverage category needs specific items or a recorded not-applicable reason', () => {
  const missing = fixture(); delete missing.manifest.files[0].review.coverage.proofs; rejects(missing, /coverage.proofs/);
  const empty = fixture(); empty.manifest.files[0].review.coverage.terms = { items: [] }; rejects(empty, /empty coverage requires/);
  const vague = fixture(); vague.manifest.files[0].review.coverage.proofs.notApplicableReason = ' '; rejects(vague, /empty coverage requires/);
  const contradictory = fixture(); contradictory.manifest.files[0].review.coverage.terms.notApplicableReason = 'No terminology'; rejects(contradictory, /cannot also be marked not applicable/);
  const noLocator = fixture(); delete noLocator.manifest.files[0].review.coverage.terms.items[0].locator; rejects(noLocator, /locator is required/);
  const allEmpty = fixture();
  for (const key of Object.keys(allEmpty.manifest.files[0].review.coverage)) allEmpty.manifest.files[0].review.coverage[key] = { items: [], notApplicableReason: 'No content of this kind.' };
  rejects(allEmpty, /approved content requires at least one item/);
});

test('terms and definitions cannot use an original derivation as a substitute for course-source wording', () => {
  for (const category of ['terms', 'definitions']) {
    const f = fixture(); f.manifest.files[0].review.coverage[category].items[0] = { ...sourceItem(), kind: 'course-derivation', derivationNote: 'We invented a name.' };
    rejects(f, /terms and definitions require kind source/);
  }
  const f = fixture(); delete f.manifest.files[0].review.coverage.claims.items[0].derivationNote;
  rejects(f, /course-derivation requires derivationNote/);
  for (const category of ['terms', 'definitions']) {
    for (const excerpt of [undefined, '', ' ']) {
      const missingQuote = fixture(); missingQuote.manifest.files[0].review.coverage[category].items[0].evidence[0].sourceExcerpt = excerpt;
      rejects(missingQuote, /require a nonempty sourceExcerpt/);
    }
  }
});

test('evidence requires an approved catalog source, a page, a precise locator and a note', () => {
  for (const mutate of [
    e => { e.sourceId = 'external-book-not-in-this-course'; }, e => { delete e.sourceId; },
    e => { e.sourceType = 'book'; }, e => { e.document = 'An unrelated textbook.pdf'; },
    e => { e.pdfPage = 0; }, e => { e.pdfPage = 1.5; }, e => { e.pdfPage = '16'; },
    e => { e.sourceLocator = ' '; }, e => { e.evidenceNote = ''; }
  ]) {
    const f = fixture(); mutate(f.manifest.files[0].review.coverage.definitions.items[0].evidence[0]); assert.equal(validate(f).ok, false);
  }
  const empty = fixture(); empty.manifest.files[0].review.coverage.definitions.items[0].evidence = []; rejects(empty, /nonempty evidence/);
  const unknown = fixture(); unknown.catalog.sources = []; rejects(unknown, /sourceId must identify/);
  const duplicate = fixture(); duplicate.catalog.sources.push(copy(duplicate.catalog.sources[0])); rejects(duplicate, /duplicate source id/);
  const lecturer = fixture(); lecturer.catalog.sources[0].sourceType = 'official-lecturer-material'; assert.equal(validate(lecturer).ok, true);
  const invalid = fixture(); invalid.catalog.sources[0].sourceType = 'web'; rejects(invalid, /unsupported sourceType/);
  assert.equal(validateManifest(fixture().manifest, fixture().files).ok, false, 'a missing catalog cannot silently fall back to global sources');
});

test('material not taught in lectures needs explicit scope authorization', () => {
  const f = fixture(); f.manifest.files[0].review.lectureAlignment.status = 'not-taught'; rejects(f, /requires scopeAuthorization/);
  f.manifest.files[0].review.lectureAlignment.scopeAuthorization = 'The learner explicitly requested this extension in the fixture.';
  assert.equal(validate(f).ok, true);
  delete f.manifest.files[0].review.lectureAlignment.evidenceNote; rejects(f, /evidenceNote is required/);
});

test('verified lecture alignment needs actual lecture evidence, not only a note or a textbook citation', () => {
  const noteOnly = fixture(); delete noteOnly.manifest.files[0].review.lectureAlignment.evidence; rejects(noteOnly, /nonempty evidence array/);
  const guideOnly = fixture(); guideOnly.manifest.files[0].review.lectureAlignment.evidence = [evidence()]; rejects(guideOnly, /verified requires lecture/);
  const spoofed = fixture(); spoofed.manifest.files[0].review.lectureAlignment.evidence = [{ ...evidence(), sourceType: 'lecture' }]; rejects(spoofed, /sourceType differs/);
  const imprecise = fixture(); delete imprecise.manifest.files[0].review.lectureAlignment.evidence[0].sourceLocator; rejects(imprecise, /sourceLocator is required/);
  const lecturerMaterial = fixture(); lecturerMaterial.catalog.sources[1].sourceType = 'official-lecturer-material';
  assert.equal(validate(lecturerMaterial).ok, true);
});

test('non-instructional classification has its own accountable review instead of automatic exemption', () => {
  const f = fixture(); const row = f.manifest.files[0]; row.status = 'non-instructional'; delete row.review;
  rejects(f, /requires classificationReview/);
  row.classificationReview = { reviewer: 'Classifier', reviewedAt: '2026-10-24', reason: 'Synthetic navigation-only fixture.' };
  assert.equal(validate(f).ok, true);
  for (const key of ['reviewer', 'reviewedAt', 'reason']) {
    const broken = { ...f, manifest: copy(f.manifest) }; delete broken.manifest.files[0].classificationReview[key]; assert.equal(validate(broken).ok, false);
  }
});

function temporaryRepository(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'courses-policy-test-'));
  t.after(() => {
    const target = path.resolve(root);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert.ok(path.basename(target).startsWith('courses-policy-test-'));
    fs.rmSync(target, { recursive: true, force: true });
  });
  const git = (args, input) => execFileSync('git', ['-c', 'core.autocrlf=false', '-c', `core.hooksPath=${path.join(root, 'no-hooks')}`, '-c', 'user.name=Policy fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd: root, input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }).trim();
  git(['init', '-q']);
  const write = (file, bytes) => { const full = path.join(root, ...file.split('/')); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, bytes); };
  const save = f => { for (const [file, bytes] of f.files) write(file, bytes); write(MANIFEST_PATH, JSON.stringify(f.manifest)); write(CATALOG_PATH, JSON.stringify(f.catalog)); };
  const commit = () => { git(['add', '--all']); git(['commit', '-qm', 'Synthetic policy fixture']); return git(['rev-parse', 'HEAD']); };
  return { root, git, write, save, commit };
}

test('checkout sees untracked and ignored protected files, not just git tracked files', t => {
  const repo = temporaryRepository(t); repo.save(fixture()); repo.write('.gitignore', '*.pdf\n'); repo.commit();
  assert.equal(checkRepository({ root: repo.root }).ok, true);
  repo.write('docs/vendor/vendor.js', 'not course content');
  assert.equal(checkRepository({ root: repo.root }).ok, true);
  repo.write('docs/untracked.pdf', Buffer.from([0, 255, 1]));
  const result = checkRepository({ root: repo.root }); assert.equal(result.ok, false); assert.match(result.errors.join('\n'), /untracked.pdf.*missing/);
});

test('the vendor directory exemption does not exempt a regular file named vendor', t => {
  const repo = temporaryRepository(t); repo.save(fixture()); repo.write('docs/vendor', 'Unreviewed authored material.');
  const result = checkRepository({ root: repo.root });
  assert.equal(result.ok, false); assert.match(result.errors.join('\n'), /docs\/vendor: protected file is missing/);
});

test('revision checks commit blobs and commit metadata even when the working tree disagrees', t => {
  const repo = temporaryRepository(t); const f = fixture(); repo.save(f); const good = repo.commit();
  repo.write('docs/lesson.html', '<p>Unreviewed working change.</p>'); repo.write(CATALOG_PATH, '{invalid working JSON');
  assert.equal(checkRepository({ root: repo.root }).ok, false);
  assert.equal(checkRepository({ root: repo.root, revision: good }).ok, true, 'an old reviewed commit must not read dirty working files or catalog');
  repo.write(CATALOG_PATH, JSON.stringify(f.catalog)); const bad = repo.commit();
  repo.save(f);
  assert.equal(checkRepository({ root: repo.root }).ok, true, 'working directory is now repaired');
  const result = checkRepository({ root: repo.root, revision: bad });
  assert.equal(result.ok, false); assert.match(result.errors.join('\n'), /sha256 differs/, 'a bad pushed commit must not borrow the repaired working files');
  assert.equal(checkRepository({ root: repo.root, revision: 'HEAD' }).ok, false, 'revision CLI requires a full immutable hash');
});

test('a catalog absent or changed in a commit cannot be replaced by the working catalog', t => {
  const repo = temporaryRepository(t); const f = fixture(); repo.save(f); repo.commit();
  repo.git(['rm', CATALOG_PATH]); repo.git(['commit', '-qm', 'Remove catalog']); const missing = repo.git(['rev-parse', 'HEAD']);
  repo.save(f);
  assert.equal(checkRepository({ root: repo.root }).ok, true);
  const missingResult = checkRepository({ root: repo.root, revision: missing }); assert.equal(missingResult.ok, false); assert.match(missingResult.errors.join('\n'), /source-catalog.json: missing from revision/);
  f.catalog.sources[0].id = 'different-source'; repo.save(f); const changed = repo.commit();
  repo.save(fixture());
  const changedResult = checkRepository({ root: repo.root, revision: changed }); assert.equal(changedResult.ok, false); assert.match(changedResult.errors.join('\n'), /sourceId must identify/);
});

test('git symlinks cannot smuggle unreviewed content into the protected tree', t => {
  const repo = temporaryRepository(t); repo.save(fixture()); repo.commit();
  const blob = repo.git(['hash-object', '-w', '--stdin'], '../outside-content');
  repo.git(['update-index', '--add', '--cacheinfo', `120000,${blob},docs/link.html`]);
  repo.git(['commit', '-qm', 'Synthetic symlink entry']);
  const result = checkRepository({ root: repo.root, revision: repo.git(['rev-parse', 'HEAD']) });
  assert.equal(result.ok, false); assert.match(result.errors.join('\n'), /regular file blobs/);
});

test('malformed manifest and unreadable metadata fail rather than approve an empty result', t => {
  for (const manifest of [null, [], {}, { schemaVersion: 1, policyVersion: POLICY_VERSION, files: null }]) {
    assert.equal(validateManifest(manifest, fixture().files, fixture().catalog).ok, false);
  }
  const repo = temporaryRepository(t); repo.save(fixture()); repo.write(MANIFEST_PATH, '{bad JSON');
  const result = checkRepository({ root: repo.root }); assert.equal(result.ok, false); assert.match(result.errors.join('\n'), /Cannot verify course content/);
});
