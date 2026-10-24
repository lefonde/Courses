'use strict';

// This verifies recorded review evidence and content identity, not the truth of a review.
// Known text formats normalize CRLF to LF for Git's Windows checkout conversion.
// Every other byte (including spaces, BOMs and lone CRs) remains significant;
// binary and unknown formats are hashed without any normalization.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const POLICY_VERSION = '2026-10-24.1';
const MANIFEST_PATH = 'course-content/review-status.json';
const CATALOG_PATH = 'course-content/source-catalog.json';
const COVERAGE_KEYS = ['terms', 'definitions', 'claims', 'proofs', 'exercises'];
const CHECK_KEYS = ['sourceFidelity', 'courseTerminology', 'mathematicalCorrectness', 'clarity'];
const SOURCE_TYPES = new Set(['lecture', 'guide', 'book', 'official-exam', 'official-homework', 'official-solution', 'official-lecturer-material']);
const STATUSES = new Set(['needs-review', 'blocked', 'approved', 'non-instructional']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const TEXT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.json', '.html', '.css', '.svg', '.md', '.txt', '.yml', '.yaml', '.csv']);

function canonicalContentHash(filePath, bytes) {
  let content = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (TEXT_EXTENSIONS.has(path.posix.extname(filePath).toLowerCase()) && content.includes('\r\n')) {
    const normalized = Buffer.allocUnsafe(content.length);
    let length = 0;
    for (let index = 0; index < content.length; index++) {
      if (content[index] === 13 && content[index + 1] === 10) continue;
      normalized[length++] = content[index];
    }
    content = normalized.subarray(0, length);
  }
  return sha256(content);
}

function canonicalPath(value) {
  if (!isText(value) || value.includes('\\') || /[:\x00-\x1f\x7f]/.test(value)) return false;
  return value.split('/').every(part => part && part !== '.' && part !== '..' && !/[. ]$/.test(part));
}

function isProtectedPath(value) {
  return canonicalPath(value) && value.startsWith('docs/') && !value.startsWith('docs/vendor/');
}

function isIsoDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const date = new Date(value.slice(0, 10) + 'T00:00:00Z');
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]);
}

function validateCatalog(catalog, errors) {
  const sources = new Map();
  if (!isObject(catalog) || catalog.schemaVersion !== 1 || !Array.isArray(catalog.sources)) {
    errors.push(`${CATALOG_PATH}: expected schemaVersion 1 and a sources array`);
    return sources;
  }
  for (const [index, source] of catalog.sources.entries()) {
    const where = `${CATALOG_PATH}: sources[${index}]`;
    if (!isObject(source)) { errors.push(`${where}: expected an object`); continue; }
    if (!isText(source.id) || source.id !== source.id.trim()) errors.push(`${where}: source id must be nonempty and have no surrounding whitespace`);
    if (sources.has(source.id)) errors.push(`${where}: duplicate source id ${source.id}`);
    if (!SOURCE_TYPES.has(source.sourceType)) errors.push(`${where}: unsupported sourceType`);
    if (!isText(source.document)) errors.push(`${where}: document is required`);
    if (!isHash(source.sha256)) errors.push(`${where}: sha256 must contain 64 hexadecimal digits`);
    if (isText(source.id)) sources.set(source.id, source);
  }
  return sources;
}

function validateEvidence(evidence, where, sources, errors) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    errors.push(`${where}: nonempty evidence array is required`);
    return;
  }
  for (const [index, entry] of evidence.entries()) {
    const location = `${where}.evidence[${index}]`;
    if (!isObject(entry)) { errors.push(`${location}: expected an object`); continue; }
    const source = sources.get(entry.sourceId);
    if (!isText(entry.sourceId) || !source) errors.push(`${location}: sourceId must identify a source in ${CATALOG_PATH}`);
    if (source && Object.hasOwn(entry, 'sourceType') && entry.sourceType !== source.sourceType) errors.push(`${location}: sourceType differs from the source catalog`);
    if (source && Object.hasOwn(entry, 'document') && entry.document !== source.document) errors.push(`${location}: document differs from the source catalog`);
    if (!Number.isSafeInteger(entry.pdfPage) || entry.pdfPage < 1) errors.push(`${location}: pdfPage must be a positive integer`);
    if (!isText(entry.sourceLocator)) errors.push(`${location}: sourceLocator is required`);
    if (!isText(entry.evidenceNote)) errors.push(`${location}: evidenceNote is required`);
  }
}

function validateReview(review, where, sources, errors) {
  if (!isObject(review)) { errors.push(`${where}: approved content requires a review object`); return; }
  if (review.policyVersion !== POLICY_VERSION) errors.push(`${where}.review: policyVersion must be ${POLICY_VERSION}`);
  if (!isText(review.author)) errors.push(`${where}.review: author is required`);
  if (!isText(review.reviewer)) errors.push(`${where}.review: reviewer is required`);
  const identity = text => text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  if (isText(review.author) && isText(review.reviewer) && identity(review.author) === identity(review.reviewer)) errors.push(`${where}.review: reviewer must differ from author`);
  if (!isIsoDate(review.reviewedAt)) errors.push(`${where}.review: reviewedAt must be a valid ISO date or timestamp`);
  for (const key of CHECK_KEYS) {
    if (!isObject(review.checks) || review.checks[key] !== true) errors.push(`${where}.review.checks.${key}: must be true`);
  }
  if (!Array.isArray(review.unresolved) || review.unresolved.length !== 0) errors.push(`${where}.review.unresolved: must be an empty array`);
  const alignment = review.lectureAlignment;
  if (!isObject(alignment) || !['verified', 'not-taught'].includes(alignment.status)) errors.push(`${where}.review.lectureAlignment: status must be verified or not-taught`);
  if (!isObject(alignment) || !isText(alignment.evidenceNote)) errors.push(`${where}.review.lectureAlignment: evidenceNote is required`);
  if (isObject(alignment) && alignment.status === 'verified') {
    validateEvidence(alignment.evidence, `${where}.review.lectureAlignment`, sources, errors);
    if (!Array.isArray(alignment.evidence) || !alignment.evidence.some(entry => isObject(entry) && ['lecture', 'official-lecturer-material'].includes(sources.get(entry.sourceId)?.sourceType))) {
      errors.push(`${where}.review.lectureAlignment: verified requires lecture or official-lecturer-material evidence from the source catalog`);
    }
  }
  if (isObject(alignment) && alignment.status === 'not-taught' && !isText(alignment.scopeAuthorization)) errors.push(`${where}.review.lectureAlignment: not-taught requires scopeAuthorization`);
  if (!isObject(review.coverage)) { errors.push(`${where}.review.coverage: an object is required`); return; }
  let itemCount = 0;
  for (const category of COVERAGE_KEYS) {
    const coverage = review.coverage[category];
    const location = `${where}.review.coverage.${category}`;
    if (!isObject(coverage) || !Array.isArray(coverage.items)) { errors.push(`${location}: an object with an items array is required`); continue; }
    if (coverage.items.length === 0) {
      if (!isText(coverage.notApplicableReason)) errors.push(`${location}: empty coverage requires notApplicableReason`);
      continue;
    }
    if (isText(coverage.notApplicableReason)) errors.push(`${location}: populated items cannot also be marked not applicable`);
    itemCount += coverage.items.length;
    for (const [index, item] of coverage.items.entries()) {
      const itemLocation = `${location}.items[${index}]`;
      if (!isObject(item)) { errors.push(`${itemLocation}: expected an object`); continue; }
      if (!isText(item.locator)) errors.push(`${itemLocation}: locator is required`);
      if (!['source', 'course-derivation'].includes(item.kind)) errors.push(`${itemLocation}: kind must be source or course-derivation`);
      if (['terms', 'definitions'].includes(category) && item.kind !== 'source') errors.push(`${itemLocation}: terms and definitions require kind source`);
      if (['terms', 'definitions'].includes(category) && (!Array.isArray(item.evidence) || !item.evidence.some(entry => isObject(entry) && isText(entry.sourceExcerpt)))) errors.push(`${itemLocation}: terms and definitions require a nonempty sourceExcerpt in at least one evidence entry`);
      if (item.kind === 'course-derivation' && !isText(item.derivationNote)) errors.push(`${itemLocation}: course-derivation requires derivationNote`);
      validateEvidence(item.evidence, itemLocation, sources, errors);
    }
  }
  if (itemCount === 0) errors.push(`${where}.review.coverage: approved content requires at least one item with course-source evidence; use reviewed non-instructional classification for files without instructional content`);
}

// files is a Map (or object) from repository-relative paths to exact file bytes.
// Supply the catalog explicitly: fixtures cannot accidentally use repository sources.
function validateManifest(manifest, files, catalog) {
  const errors = [];
  const sources = validateCatalog(catalog, errors);
  const snapshot = new Map();
  const foldedPaths = new Set();
  let entries;
  if (files instanceof Map) entries = files.entries();
  else if (isObject(files)) entries = Object.entries(files);
  else { errors.push('files: expected a Map or object containing file bytes'); entries = []; }
  for (const [file, bytes] of entries) {
    if (!canonicalPath(file)) { errors.push(`files: unsafe or noncanonical path ${JSON.stringify(file)}`); continue; }
    if (!isProtectedPath(file)) continue;
    if (foldedPaths.has(file.toLowerCase())) errors.push(`${file}: case-insensitive path collision`);
    foldedPaths.add(file.toLowerCase());
    if (!Buffer.isBuffer(bytes) && typeof bytes !== 'string' && !(bytes instanceof Uint8Array)) { errors.push(`${file}: file bytes are required`); continue; }
    snapshot.set(file, canonicalContentHash(file, bytes));
  }
  if (!isObject(manifest) || manifest.schemaVersion !== 1 || manifest.policyVersion !== POLICY_VERSION || !Array.isArray(manifest.files)) {
    errors.push(`${MANIFEST_PATH}: expected schemaVersion 1, policyVersion ${POLICY_VERSION}, and a files array`);
    return { ok: false, errors, checkedFiles: snapshot.size, approvedFiles: 0, nonInstructionalFiles: 0 };
  }
  const registered = new Set();
  const foldedRows = new Set();
  let approvedFiles = 0;
  let nonInstructionalFiles = 0;
  for (const [index, row] of manifest.files.entries()) {
    const where = isObject(row) && isText(row.path) ? row.path : `${MANIFEST_PATH}: files[${index}]`;
    if (!isObject(row)) { errors.push(`${where}: expected an object`); continue; }
    if (!isProtectedPath(row.path)) { errors.push(`${where}: path must be canonical and protected under docs/, excluding docs/vendor/`); continue; }
    if (registered.has(row.path) || foldedRows.has(row.path.toLowerCase())) errors.push(`${where}: duplicate manifest path`);
    registered.add(row.path);
    foldedRows.add(row.path.toLowerCase());
    if (!snapshot.has(row.path)) errors.push(`${where}: manifest entry has no corresponding protected file`);
    if (!isHash(row.sha256)) errors.push(`${where}: sha256 must contain 64 hexadecimal digits`);
    else if (snapshot.has(row.path) && row.sha256.toLowerCase() !== snapshot.get(row.path)) errors.push(`${where}: sha256 differs from the reviewed content (only recognized text CRLF is normalized)`);
    if (!STATUSES.has(row.status)) errors.push(`${where}: unknown review status`);
    else if (row.status === 'needs-review' || row.status === 'blocked') errors.push(`${where}: status ${row.status} prevents publication`);
    else if (row.status === 'approved') { approvedFiles++; validateReview(row.review, where, sources, errors); }
    else {
      nonInstructionalFiles++;
      const classification = row.classificationReview;
      if (!isObject(classification)) { errors.push(`${where}: non-instructional requires classificationReview`); continue; }
      if (!isText(classification.reviewer)) errors.push(`${where}.classificationReview: reviewer is required`);
      if (!isIsoDate(classification.reviewedAt)) errors.push(`${where}.classificationReview: reviewedAt must be a valid ISO date or timestamp`);
      if (!isText(classification.reason)) errors.push(`${where}.classificationReview: reason is required`);
    }
  }
  for (const file of snapshot.keys()) if (!registered.has(file)) errors.push(`${file}: protected file is missing from the review manifest`);
  return { ok: errors.length === 0, errors, checkedFiles: snapshot.size, approvedFiles, nonInstructionalFiles };
}

function readCheckout(root) {
  const files = new Map();
  const readRegularFile = relative => {
    const full = path.join(root, ...relative.split('/'));
    if (!fs.lstatSync(full).isFile()) throw new Error(`${relative}: expected a regular file; symlinks are not accepted`);
    return fs.readFileSync(full);
  };
  const walk = relative => {
    const full = path.join(root, ...relative.split('/'));
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error(`${relative}: symlinks are not accepted in protected content`);
    if (!stat.isDirectory()) throw new Error(`${relative}: expected a directory`);
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      const child = `${relative}/${entry.name}`;
      if (child === 'docs/vendor' && entry.isDirectory()) continue;
      if (!canonicalPath(child)) throw new Error(`${child}: unsafe or noncanonical path`);
      if (entry.isDirectory()) walk(child);
      else files.set(child, readRegularFile(child));
    }
  };
  // Validate the metadata directory too: a symlink must not fetch outside reviews.
  if (!fs.lstatSync(path.join(root, 'course-content')).isDirectory() || fs.lstatSync(path.join(root, 'course-content')).isSymbolicLink()) throw new Error('course-content: expected a regular directory');
  const manifest = JSON.parse(readRegularFile(MANIFEST_PATH).toString('utf8'));
  const catalog = JSON.parse(readRegularFile(CATALOG_PATH).toString('utf8'));
  walk('docs');
  return { manifest, catalog, files };
}

function readRevision(root, revision) {
  if (typeof revision !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(revision)) throw new Error('--revision requires a full hexadecimal commit hash');
  const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const commit = git(['rev-parse', '--verify', `${revision}^{commit}`]).toString('utf8').trim();
  if (commit.toLowerCase() !== revision.toLowerCase()) throw new Error('--revision must identify a commit, not a tag or another object');
  const listing = git(['ls-tree', '-r', '-z', '--full-tree', commit, '--', 'docs', MANIFEST_PATH, CATALOG_PATH]).toString('utf8');
  const blobs = new Map();
  for (const entry of listing.split('\0').filter(Boolean)) {
    const match = /^(\d+) (\w+) ([a-f0-9]+)\t([\s\S]+)$/.exec(entry);
    if (!match) throw new Error('git ls-tree returned an unrecognized entry');
    const [, mode, type, , file] = match;
    if (file.startsWith('docs/vendor/')) continue;
    if (!canonicalPath(file)) throw new Error(`${file}: unsafe or noncanonical path in revision`);
    if (type !== 'blob' || !['100644', '100755'].includes(mode)) throw new Error(`${file}: protected revision entries must be regular file blobs`);
    blobs.set(file, git(['show', `${commit}:${file}`]));
  }
  for (const file of [MANIFEST_PATH, CATALOG_PATH]) if (!blobs.has(file)) throw new Error(`${file}: missing from revision ${commit}`);
  if (![...blobs.keys()].some(isProtectedPath)) throw new Error(`docs/: no protected files found in revision ${commit}`);
  const manifest = JSON.parse(blobs.get(MANIFEST_PATH).toString('utf8'));
  const catalog = JSON.parse(blobs.get(CATALOG_PATH).toString('utf8'));
  return { manifest, catalog, files: new Map([...blobs].filter(([file]) => isProtectedPath(file))), revision: commit };
}

function checkRepository({ root = path.resolve(__dirname, '..'), revision } = {}) {
  try {
    const snapshot = revision === undefined ? readCheckout(root) : readRevision(root, revision);
    return { ...validateManifest(snapshot.manifest, snapshot.files, snapshot.catalog), mode: revision === undefined ? 'checkout' : 'revision', ...(snapshot.revision ? { revision: snapshot.revision } : {}) };
  } catch (error) {
    return { ok: false, errors: [`Cannot verify course content: ${error.message}`], checkedFiles: 0, approvedFiles: 0, nonInstructionalFiles: 0 };
  }
}

function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node scripts/check-course-content.cjs [--revision FULL_COMMIT_HASH]');
    return 0;
  }
  if (args.length !== 0 && !(args.length === 2 && args[0] === '--revision')) {
    console.error('Usage: node scripts/check-course-content.cjs [--revision FULL_COMMIT_HASH]');
    return 2;
  }
  const result = checkRepository({ revision: args.length ? args[1] : undefined });
  if (!result.ok) {
    console.error(`Course-content publication check failed (${result.errors.length} issue(s)):`);
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`Course-content review records match ${result.checkedFiles} protected files (${result.mode}${result.revision ? ` ${result.revision}` : ''}).`);
  console.log('This checks recorded evidence and file identity; it does not establish semantic correctness or authenticate reviewers.');
  return 0;
}

module.exports = { POLICY_VERSION, MANIFEST_PATH, CATALOG_PATH, canonicalContentHash, validateManifest, checkRepository, isProtectedPath };
if (require.main === module) process.exitCode = main(process.argv.slice(2));
