'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseLegacyHtml, parseSavedMarks, scanCorpus, buildArtifacts, assertPrivateDestination } = require('../scripts/import-advanced-research.cjs');

// Synthetic archives only: no personal filenames, source excerpts, or real marks.
function archive(questions = "[{id:1,subject:'ds',title:'An archived \\'example\\'',rationale:'Private research',score:9}]") {
  return `<script>
    const WA='../chat/'; const MAM='../assignments/'; const LN='../notes/';
    const LW='../word/'; const UNP='../other/'; const ROOT='../'; const EXAM='../exam/';
    const questionRefs={1:[{type:'book',file:'Private source label',loc:'Private locator',href:ROOT+'same.pdf'}]};
    const questions=${questions};
    throw new Error('This script must never execute');
  </script>`;
}

test('extracts literal data and escaped wording without executing the surrounding script', () => {
  const result = parseLegacyHtml(archive());
  assert.equal(result.questions[0].title, "An archived 'example'");
  assert.equal(result.questionRefs[1][0].href, '../same.pdf');
  assert.match(result.inputSha256, /^[0-9a-f]{64}$/);
});

test('rejects executable expressions, prototype keys, duplicate IDs, and unfamiliar topics', () => {
  globalThis.archiveExecutionSentinel = false;
  assert.throws(() => parseLegacyHtml(archive("[{id:1,subject:'ds',title:(globalThis.archiveExecutionSentinel=true)}]")), /Unsupported archive data/);
  assert.equal(globalThis.archiveExecutionSentinel, false);
  delete globalThis.archiveExecutionSentinel;
  assert.throws(() => parseLegacyHtml(archive("[{id:1,subject:'ds',title:'x',__proto__:{polluted:true}}]")), /unsafe/);
  assert.equal({}.polluted, undefined);
  assert.throws(() => parseLegacyHtml(archive("[{id:1,subject:'ds',title:'x'},{id:1,subject:'lp',title:'y'}]")), /duplicate legacy ID/);
  assert.throws(() => parseLegacyHtml(archive("[{id:1,subject:'new-topic',title:'x'}]")), /Unknown archived topic/);
});

test('recovers only explicitly checked known snapshot records as a private import suggestion', () => {
  const snapshot = parseSavedMarks(`<input type="checkbox" checked="" onchange="toggleStudied(1,this.checked)">
    <input type="checkbox" onchange="toggleStudied(2,this.checked)">
    <input type="checkbox" data-note="checked onchange='toggleStudied(2,this.checked)'">
    <input type="checkbox" checked onchange="toggleStudied(99,this.checked)">`, new Set([1, 2]));
  assert.deepEqual(snapshot.legacyIds, [1]);
  assert.equal(snapshot.requiresExplicitImport, true);
  assert.equal(snapshot.mustNotOverwriteNewer, true);
});

test('deduplicates by bytes, preserves same-name ambiguity privately, and excludes private evidence from public data', async t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'course-import-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  fs.mkdirSync(path.join(folder, 'a'));
  fs.mkdirSync(path.join(folder, 'b'));
  const first = '%PDF-1.7\nsynthetic-a';
  fs.writeFileSync(path.join(folder, 'a', 'same.pdf'), first);
  fs.writeFileSync(path.join(folder, 'duplicate-private.pdf'), first);
  fs.writeFileSync(path.join(folder, 'b', 'same.pdf'), '%PDF-1.7\nsynthetic-b');
  fs.writeFileSync(path.join(folder, 'private-recording.mp4'), 'fake recording');
  const corpus = await scanCorpus(folder);
  const snapshot = parseSavedMarks('<input checked onchange="toggleStudied(1,this.checked)">', new Set([1]));
  const result = buildArtifacts(parseLegacyHtml(archive()), corpus, snapshot);
  assert.equal(result.publicPrep.inventory.pdfFileCount, 3);
  assert.equal(result.publicPrep.inventory.uniquePdfCount, 2);
  assert.equal(result.publicPrep.inventory.duplicatePdfCount, 1);
  assert.equal(result.publicPrep.inventory.recordingCount, 1);
  assert.equal(result.publicPrep.inventory.referenceMapping.ambiguousFilename, 1);
  assert.equal(result.privateReport.referenceMappings[0].candidateSourceIds.length, 2);
  assert.deepEqual(result.privateReport.snapshotImportSuggestion.legacyIds, [1]);
  const publicText = JSON.stringify([result.curriculum, result.publicPrep]);
  for (const privateValue of ['Private research', 'Private source label', 'Private locator', 'same.pdf', 'duplicate-private', 'private-recording', folder, 'legacyIds', 'score', 'rationale']) assert.equal(publicText.includes(privateValue), false, privateValue);
  const sources = Object.values(result.curriculum.sources);
  assert.equal(sources.length, 2);
  assert.ok(sources.some(source => source.sha256 === crypto.createHash('sha256').update(first).digest('hex')));
  assert.ok(sources.every(source => source.path === `${source.id}.pdf` && source.contentStatus === 'needs-review'));
  assert.equal(result.publicPrep.scopeConfirmed, false);
  assert.equal(result.publicPrep.items[0].lessonUrl, null);
  assert.equal(result.publicPrep.items[0].title, "An archived 'example'");
  assert.deepEqual(result.curriculum.problems, []);
});

test('does not silently catalog a file merely because its extension says PDF', async t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'course-bad-pdf-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  fs.writeFileSync(path.join(folder, 'bad.pdf'), '<script>unsafe()</script>');
  await assert.rejects(scanCorpus(folder), /PDF header/);
});

test('private evidence cannot be written anywhere inside a Git checkout', t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'course-private-'));
  t.after(() => fs.rmSync(folder, { recursive: true, force: true }));
  fs.mkdirSync(path.join(folder, 'repository'));
  fs.writeFileSync(path.join(folder, 'repository', '.git'), 'gitdir: elsewhere');
  assert.throws(() => assertPrivateDestination(path.join(folder, 'repository', 'new', 'nested')), /outside every Git checkout/);
  assert.doesNotThrow(() => assertPrivateDestination(path.join(folder, 'private', 'new')));
});

test('checked-in preparation assets contain only unreviewed metadata and neutral PDF identities', () => {
  const directory = path.join(__dirname, '../docs/courses/advanced-algorithms');
  const prep = JSON.parse(fs.readFileSync(path.join(directory, 'exam-prep.json'), 'utf8'));
  const curriculum = JSON.parse(fs.readFileSync(path.join(directory, 'curriculum.json'), 'utf8'));
  assert.equal(prep.kind, 'legacy-research-backlog');
  assert.equal(prep.offeringId, 'exam-prep');
  assert.equal(prep.scopeConfirmed, false);
  assert.equal(prep.items.length, prep.inventory.candidateCount);
  assert.equal(new Set(prep.items.map(item => item.id)).size, prep.items.length);
  assert.ok(prep.items.every(item => item.id === `legacy-${item.legacyId}` && item.contentStatus === 'needs-review' && item.lessonUrl === null));
  assert.deepEqual(prep.items.flatMap(item => Object.keys(item)).filter(key => ['score', 'rationale', 'chat', 'images', 'studied'].includes(key)), []);
  assert.equal(Object.keys(curriculum.sources).length, prep.inventory.uniquePdfCount);
  assert.ok(Object.values(curriculum.sources).every(source => /^[a-f0-9]{64}$/.test(source.sha256) && /^aa-source-[a-f0-9]{16}\.pdf$/.test(source.path)));
  assert.equal(prep.topics.reduce((total, topic) => total + topic.count, 0), prep.items.length);
  assert.equal(curriculum.meta.examDate, null);
  assert.equal(curriculum.problems.length, 0);
});
