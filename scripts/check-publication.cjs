'use strict';

// The normal content gate is unchanged. This dated online-review authorization
// covers only a user-requested snapshot, never general approval of legacy text.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {checkRepository, validateManifest, canonicalContentHash, POLICY_VERSION} = require('./check-course-content.cjs');
const AUTH_PATH = 'course-content/online-review-authorization.json';
const AUTH_HASH = '9b0695f4f552b485121217785e1f6b1ce1d9a24961d27526d47f00f42ff814b4';
// A separate, bounded publication request; it does not refresh the 24-Oct record.
const SITE_RELEASE_PATH = 'course-content/site-release-2026-10-26.json';
const SITE_RELEASE_HASH = '55a55a9d09cd3637464f79f2c38de90712bcf622c9771fad10748bfb4a1a93d3';
const SITE_RELEASE_BASELINE = '4ff46f4c6fb9375bdb5fa9162c99c7f98c59fe87';
const MANIFEST_PATH = 'course-content/review-status.json';
const CATALOG_PATH = 'course-content/source-catalog.json';
const APPROVED = [
  'docs/data/reference-probability.json', 'docs/data/reference-sat.json', 'docs/data/reference-walk.json',
  'docs/exam-problems/directed-reset-walk.html', 'docs/exam-problems/max3sat-small-sample-space.html',
  'docs/exam-problems/random-graph-isolated-vertices.html'
];
const INTEGRATION = [
  'docs/data/curriculum.json', 'docs/data/exam-problem-pages.json', 'docs/data/reference-links.json',
  'docs/exam-problem-ui.js', 'docs/index.html', 'docs/preview-learning.html',
  'docs/reference-ui.js', 'docs/reference.css'
];
const BASELINE = '635a48c0059ff5c346b08f7abd71a593ece55464';
const REQUEST = 'Upload it ill check in online. Give me the link once its up';
// Independent integration-diff review, /root/release_review, 2026-10-24.
// These are not whole-file course approvals for the legacy curriculum.
const INTEGRATION_HASHES = {
  'docs/data/curriculum.json':'8311604f64d007c8d58a1b0be0df3749721d507d8f9d797858328a7fedb4cfff',
  'docs/data/exam-problem-pages.json':'8afabc7197ada4149d6bb07002b2bca8cf6dd2fd3a50834b821ca646d70b37f5',
  'docs/data/reference-links.json':'e4452c563b7343e3375ba78b0a0bd0071e3aae756194fb966bbb254e9415947f',
  'docs/exam-problem-ui.js':'128b1cea618922bffdc7bafa0826bd788ed6285344d1d4658dee5b40e5dbf06d',
  'docs/index.html':'3312cd9d2f71c718d86cd51ab41f74432fe04fac0f3b6061d91f749c669ab262',
  'docs/preview-learning.html':'7b30b97529994c2f89c03656869f2f19caba16ac8ec3e939e2fb4b89ddf3c16c',
  'docs/reference-ui.js':'d5f525193a1e5569720ecbcf5ac85f6e0370f96d1a9993cd7115911fa756a1ba',
  'docs/reference.css':'634af0405c8ea449924722f9382df7c53efae6bd68e0f5eac71eda8928599786'
};
// Git auto-converts these extensionless license texts to CRLF on Windows.
// Normalize their line endings just as for .txt; every other byte still counts.
const hash = (file, bytes) => canonicalContentHash(/^docs\/vendor\/(?:[^/]+\/)*LICENSE(?:_[A-Z0-9_]+)?$/.test(file) ? file+'.txt' : file, bytes);
const sameSet = (a, b) => Array.isArray(a) && a.length === b.length && new Set(a).size === a.length && a.every(x => b.includes(x));
const safePath = name => typeof name === 'string' && name.startsWith('docs/') && !/[\\:\x00-\x1f\x7f]/.test(name) && name.split('/').every(p => p && p !== '.' && p !== '..' && !/[. ]$/.test(p));

function validateAuthorization({authorization: a, files, baselineFiles, manifest, catalog, manifestBytes, catalogBytes, remoteBase}) {
  const errors = [];
  const fail = message => errors.push(message);
  if (!a || a.schemaVersion !== 1 || a.kind !== 'user-requested-online-review' || a.policyVersion !== POLICY_VERSION) return {ok:false, errors:['Missing or unsupported online-review authorization']};
  if (a.requestQuote !== REQUEST || a.requestDate !== '2026-10-24' || !a.scope) fail('Authorization must record the specific user request and its scope');
  if (a.baselineCommit !== BASELINE) fail('Authorization must use the previously published baseline');
  if (remoteBase !== undefined && remoteBase !== BASELINE) fail('The publishing branch has moved since the authorized baseline; do not overwrite it');
  if (!sameSet(a.approvedContentPaths, APPROVED)) fail('Authorization must retain exactly the six reviewed content files');
  if (!a.integrationReview || typeof a.integrationReview.reviewer !== 'string' || !a.integrationReview.reviewer.trim() || typeof a.integrationReview.note !== 'string' || !a.integrationReview.note.trim() || !sameSet(a.integrationReview.paths, INTEGRATION)) fail('Exact integration changes require their recorded independent review');
  if (a.reviewManifestHash !== hash(MANIFEST_PATH, manifestBytes) || a.sourceCatalogHash !== hash(CATALOG_PATH, catalogBytes)) fail('Review records or source catalog changed after authorization');
  const authorized = new Map();
  for (const row of a.files || []) {
    if (!row || !safePath(row.path) || !/^[a-f0-9]{64}$/.test(row.sha256 || '') || authorized.has(row.path)) { fail('Invalid or duplicate snapshot entry'); continue; }
    authorized.set(row.path, row.sha256);
  }
  if (!sameSet([...authorized.keys()], [...files.keys()])) fail('Published file inventory differs from the authorized snapshot');
  if (!sameSet([...files.keys()], [...baselineFiles.keys()])) fail('This authorization does not permit adding or deleting published files');
  const changed = [];
  for (const [name, bytes] of files) {
    const current = hash(name, bytes);
    if (current !== authorized.get(name)) fail(`${name}: differs from the authorized snapshot`);
    if (INTEGRATION.includes(name) && current !== INTEGRATION_HASHES[name]) fail(`${name}: differs from the independently reviewed integration changes`);
    if (baselineFiles.has(name) && current !== hash(name, baselineFiles.get(name))) changed.push(name);
  }
  if (!sameSet(changed, [...APPROVED, ...INTEGRATION])) fail('Changed files differ from the reviewed content and integration scope: '+JSON.stringify({unexpected:changed.filter(name=>![...APPROVED,...INTEGRATION].includes(name)),missing:[...APPROVED,...INTEGRATION].filter(name=>!changed.includes(name))}));
  const reviewedRows = (manifest.files || []).filter(row => APPROVED.includes(row.path));
  const full = validateManifest(manifest, new Map([...files].filter(([name]) => !name.startsWith('docs/vendor/'))), catalog);
  errors.push(...full.errors.filter(error => !/: status (needs-review|blocked) prevents publication$/.test(error)));
  if (reviewedRows.some(row => row.status !== 'approved')) fail('A required content file is no longer approved');
  const result = validateManifest({...manifest, files:reviewedRows}, new Map([...files].filter(([name]) => APPROVED.includes(name))), catalog);
  errors.push(...result.errors);
  // Preserve pending review statuses for legacy/integration files; never grant
  // them course approval merely because the user requested an online review.
  const expectedPending = [...files.keys()].filter(name => !name.startsWith('docs/vendor/') && !APPROVED.includes(name));
  const pendingRows = (manifest.files || []).filter(row => expectedPending.includes(row.path));
  if (!sameSet(pendingRows.map(row => row.path), expectedPending) || pendingRows.some(row => !['needs-review','blocked'].includes(row.status))) fail('Legacy and integration content must retain its pending review status');
  return {ok:errors.length === 0, errors, mode:'authorized-online-review', reviewedContentFiles:result.approvedFiles, legacyApprovalGranted:false};
}

function readSiteReleaseAuthorization(bytes) {
  if (hash(SITE_RELEASE_PATH, bytes) !== SITE_RELEASE_HASH) throw new Error('The 26-Oct authorization differs from the exact user-requested snapshot; do not refresh it for later edits');
  return JSON.parse(bytes);
}

function validateSiteRelease({authorization: a, files, baselineFiles, manifest, catalog, manifestBytes, catalogBytes, remoteBase}) {
  const errors = [], fail = message => errors.push(message);
  if (!a || a.schemaVersion !== 1 || a.kind !== 'user-requested-site-release' || a.policyVersion !== POLICY_VERSION) return {ok:false, errors:['Missing or unsupported site-release authorization']};
  if (a.requestQuote !== 'push the current site' || a.requestDate !== '2026-10-26' || typeof a.scope !== 'string' || !a.scope.trim()) fail('Authorization must record the specific 26-Oct user request and scope');
  if (a.baselineCommit !== SITE_RELEASE_BASELINE) fail('Site release must use the previously published baseline');
  if (remoteBase !== undefined && remoteBase !== SITE_RELEASE_BASELINE) fail('The publishing branch has moved since the authorized baseline; do not overwrite it');
  if (a.contentReviewPerformed !== false || typeof a.technicalReview !== 'string' || !a.technicalReview.trim()) fail('Publication must distinguish technical verification from unperformed content review');
  if (a.reviewManifestHash !== hash(MANIFEST_PATH, manifestBytes) || a.sourceCatalogHash !== hash(CATALOG_PATH, catalogBytes)) fail('Review records or source catalog changed after authorization');
  const authorized = new Map();
  if (!Array.isArray(a.files)) fail('Published snapshot requires a files array');
  for (const row of Array.isArray(a.files) ? a.files : []) {
    if (!row || !safePath(row.path) || !/^[a-f0-9]{64}$/.test(row.sha256 || '') || authorized.has(row.path)) {fail('Invalid or duplicate snapshot entry'); continue;}
    authorized.set(row.path, row.sha256);
  }
  if (!sameSet([...authorized.keys()], [...files.keys()])) fail('Published file inventory differs from the authorized snapshot');
  const changed = [];
  for (const [name, bytes] of files) {
    if (!safePath(name)) fail('Invalid published path');
    const current = hash(name, bytes);
    if (current !== authorized.get(name)) fail(`${name}: differs from the authorized snapshot`);
    if (!baselineFiles.has(name) || current !== hash(name, baselineFiles.get(name))) changed.push(name);
  }
  if (!Array.isArray(a.changedPaths) || a.changedPaths.some(name => !safePath(name)) || !sameSet(a.changedPaths, changed)) fail('Changed files differ from the authorized release scope');
  if (!sameSet(a.deletedPaths, []) || [...baselineFiles.keys()].some(name => !files.has(name))) fail('This release does not authorize deleting published files');
  const full = validateManifest(manifest, new Map([...files].filter(([name]) => !name.startsWith('docs/vendor/'))), catalog);
  // Only pending status is deferred. Hashes, registration, source catalog and
  // any existing approval must still pass their normal structural checks.
  errors.push(...full.errors.filter(error => !/: status (needs-review|blocked) prevents publication$/.test(error)));
  return {ok:errors.length === 0, errors, mode:'authorized-site-release', contentReviewPerformed:false, legacyApprovalGranted:false};
}

function checkPublication({root = path.resolve(__dirname, '..'), revision, remoteBase} = {}) {
  const strict = checkRepository({root, revision});
  if (strict.ok) return {...strict, mode:'full-course-review'};
  // Do not use authorization to excuse malformed reviews, stale hashes or
  // missing registrations. Only pending-review status may be deferred.
  if (!strict.errors.every(error => /: status (needs-review|blocked) prevents publication$/.test(error))) return strict;
  try {
    const git = (args,input) => execFileSync('git', args, {cwd:root, input, maxBuffer:128*1024*1024, windowsHide:true, stdio:['pipe','pipe','pipe']});
    if (revision !== undefined && !/^[a-f0-9]{40}$/.test(revision)) throw new Error('A full commit hash is required');
    const read = name => {
      if (revision) return git(['show', `${revision}:${name}`]);
      const full = path.join(root, name);
      if (!fs.lstatSync(full).isFile()) throw new Error(`${name}: regular file required`);
      return fs.readFileSync(full);
    };
    const readTree = ref => {
      const files = new Map();
      const entries = [];
      for (const entry of git(['ls-tree','-r','-z',ref,'--','docs']).toString('utf8').split('\0').filter(Boolean)) {
        const match = /^(100644|100755) blob ([a-f0-9]+)\t(.+)$/.exec(entry);
        if (!match || !safePath(match[3])) throw new Error('Published tree contains an unsupported path or file type');
        entries.push({name:match[3],oid:match[2]});
      }
      // Read blob bytes in one Git process; spawning a process per font/image
      // is particularly slow on Windows. Git's size header frames binary data.
      const output = git(['cat-file','--batch'],entries.map(entry=>entry.oid).join('\n')+'\n');
      let offset = 0;
      for (const entry of entries) {
        const end = output.indexOf(10,offset);
        if (end < 0) throw new Error('Truncated Git blob header');
        const header = /^([a-f0-9]+) blob (\d+)$/.exec(output.subarray(offset,end).toString('ascii'));
        if (!header || header[1] !== entry.oid) throw new Error('Unexpected Git blob response');
        const size = Number(header[2]), start = end+1;
        if (!Number.isSafeInteger(size) || start+size >= output.length || output[start+size] !== 10) throw new Error('Truncated Git blob contents');
        files.set(entry.name,output.subarray(start,start+size));
        offset = start+size+1;
      }
      if (offset !== output.length) throw new Error('Unexpected bytes after Git blob batch');
      return files;
    };
    let files;
    if (revision) files = readTree(revision);
    else {
      files = new Map();
      const walk = name => {
        const full = path.join(root, name), stat = fs.lstatSync(full);
        if (stat.isSymbolicLink()) throw new Error(`${name}: symbolic links are not permitted`);
        if (stat.isDirectory()) for (const child of fs.readdirSync(full)) walk(`${name}/${child}`);
        else {if (!stat.isFile() || !safePath(name)) throw new Error(`${name}: invalid published file`); files.set(name, fs.readFileSync(full));}
      };
      walk('docs');
    }
    const manifestBytes = read(MANIFEST_PATH), catalogBytes = read(CATALOG_PATH);
    const hasSiteRelease = revision
      ? git(['ls-tree','--name-only',revision,'--',SITE_RELEASE_PATH]).toString('utf8').trim() === SITE_RELEASE_PATH
      : fs.existsSync(path.join(root, SITE_RELEASE_PATH));
    if (hasSiteRelease) {
      const authorization = readSiteReleaseAuthorization(read(SITE_RELEASE_PATH));
      return validateSiteRelease({authorization, files, baselineFiles:readTree(SITE_RELEASE_BASELINE), manifest:JSON.parse(manifestBytes), catalog:JSON.parse(catalogBytes), manifestBytes, catalogBytes, remoteBase});
    }
    const authorizationBytes = read(AUTH_PATH);
    if (hash(AUTH_PATH, authorizationBytes) !== AUTH_HASH) throw new Error('The dated user authorization was changed; it must not be refreshed to permit another revision');
    return validateAuthorization({authorization:JSON.parse(authorizationBytes), files, baselineFiles:readTree(BASELINE), manifest:JSON.parse(manifestBytes), catalog:JSON.parse(catalogBytes), manifestBytes, catalogBytes, remoteBase});
  } catch(error) {return {ok:false,errors:[`Online-review authorization failed: ${error.message}`]};}
}

function main(args) {
  const options = {};
  while (args.length) {
    const flag = args.shift(), value = args.shift();
    if (!value || !['--revision','--remote-base'].includes(flag)) throw new Error('Usage: check-publication.cjs [--revision FULL_SHA] [--remote-base FULL_SHA]');
    options[flag === '--revision' ? 'revision' : 'remoteBase'] = value;
  }
  const result = checkPublication(options);
  if (!result.ok) {console.error(result.errors.join('\n'));return 1;}
  console.log(result.mode === 'authorized-site-release' ? 'Exact current-site snapshot authorized by the user on 26-Oct. Technical release only; no new course-content approval is granted.' : result.mode === 'authorized-online-review' ? 'Exact online-review snapshot authorized by the user. Six content files reviewed; legacy course approval is NOT granted.' : 'Full course-source publication check passed.');
  return 0;
}
module.exports = {validateAuthorization, validateSiteRelease, readSiteReleaseAuthorization, checkPublication, publicationContentHash:hash, AUTH_PATH, APPROVED, INTEGRATION, BASELINE, REQUEST, SITE_RELEASE_PATH, SITE_RELEASE_BASELINE};
if (require.main === module) {try {process.exitCode=main(process.argv.slice(2));} catch(error) {console.error(error.message);process.exitCode=1;}}
