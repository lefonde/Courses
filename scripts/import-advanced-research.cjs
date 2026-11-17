#!/usr/bin/env node
'use strict';

// Reads archival data without executing HTML or JavaScript. Nothing is written
// unless --write is supplied. Private evidence must stay outside a Git checkout.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createReadStream } = require('node:fs');

const COURSE_ID = 'advanced-algorithms';
const OFFERING_ID = 'exam-prep';
const TOPICS = Object.freeze([
  { id: 'ds', label: 'Data Structures' },
  { id: 'lp', label: 'Linear Programming' },
  { id: 'eg', label: 'Expander Graphs' },
  { id: 'mix', label: 'Cross-Topic' }
]);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const normalizeName = value => path.posix.basename(String(value).replace(/\\/g, '/')).normalize('NFC').toLowerCase();

// This deliberately small parser accepts only the literal subset in the old
// archive: strings, finite numbers, booleans/null, arrays, objects, and known
// string constants joined with +. Calls, computed keys, templates, and getters
// fail closed. It is not eval, Function, vm, or a general JavaScript interpreter.
class LiteralReader {
  constructor(text, constants = {}) { this.text = text; this.position = 0; this.constants = constants; }
  fail(message) { throw new Error(`Unsupported archive data at character ${this.position}: ${message}`); }
  skip() {
    for (;;) {
      const whitespace = /^\s+/.exec(this.text.slice(this.position));
      if (whitespace) { this.position += whitespace[0].length; continue; }
      if (this.text.startsWith('//', this.position)) {
        const end = this.text.indexOf('\n', this.position + 2);
        this.position = end < 0 ? this.text.length : end + 1; continue;
      }
      if (this.text.startsWith('/*', this.position)) {
        const end = this.text.indexOf('*/', this.position + 2);
        if (end < 0) this.fail('unfinished comment');
        this.position = end + 2; continue;
      }
      break;
    }
  }
  take(character) { this.skip(); if (this.text[this.position] === character) { this.position++; return true; } return false; }
  require(character) { if (!this.take(character)) this.fail(`expected ${character}`); }
  identifier() {
    this.skip();
    const match = /^[A-Za-z_$][\w$]*/.exec(this.text.slice(this.position));
    if (!match) this.fail('expected identifier');
    this.position += match[0].length; return match[0];
  }
  string() {
    this.skip(); const quote = this.text[this.position++]; let value = '';
    if (quote !== "'" && quote !== '"') this.fail('expected quoted string');
    while (this.position < this.text.length) {
      const character = this.text[this.position++];
      if (character === quote) return value;
      if (character === '\n' || character === '\r') this.fail('unescaped newline');
      if (character !== '\\') { value += character; continue; }
      const escaped = this.text[this.position++];
      const simple = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' };
      if (Object.hasOwn(simple, escaped)) { value += simple[escaped]; continue; }
      if (escaped === 'u' || escaped === 'x') {
        const length = escaped === 'u' ? 4 : 2;
        const digits = this.text.slice(this.position, this.position + length);
        if (!new RegExp(`^[0-9a-fA-F]{${length}}$`).test(digits)) this.fail('invalid escape');
        value += String.fromCharCode(parseInt(digits, 16)); this.position += length; continue;
      }
      if (escaped === '\n') continue;
      if (escaped === '\r') { if (this.text[this.position] === '\n') this.position++; continue; }
      if (escaped === undefined) this.fail('unfinished string');
      // JavaScript identity escapes (for example \') preserve the next character.
      value += escaped;
    }
    this.fail('unfinished string');
  }
  value(depth = 0) {
    if (depth > 30) this.fail('nesting limit');
    this.skip(); const character = this.text[this.position]; let value;
    if (character === "'" || character === '"') value = this.string();
    else if (character === '[') {
      this.position++; value = [];
      if (!this.take(']')) for (;;) {
        value.push(this.value(depth + 1));
        if (this.take(']')) break;
        this.require(','); if (this.take(']')) break;
      }
    } else if (character === '{') {
      this.position++; value = Object.create(null);
      if (!this.take('}')) for (;;) {
        this.skip(); const next = this.text[this.position]; let key;
        if (next === "'" || next === '"') key = this.string();
        else if (/\d/.test(next || '')) {
          const match = /^\d+/.exec(this.text.slice(this.position));
          key = match[0]; this.position += key.length;
        } else key = this.identifier();
        if (['__proto__', 'constructor', 'prototype'].includes(key) || Object.hasOwn(value, key)) this.fail('unsafe or duplicate key');
        this.require(':'); value[key] = this.value(depth + 1);
        if (this.take('}')) break;
        this.require(','); if (this.take('}')) break;
      }
    } else if (character === '-' || /\d/.test(character || '')) {
      const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.text.slice(this.position));
      if (!match) this.fail('invalid number');
      this.position += match[0].length; value = Number(match[0]);
      if (!Number.isFinite(value)) this.fail('non-finite number');
    } else {
      const name = this.identifier();
      if (name === 'true') value = true;
      else if (name === 'false') value = false;
      else if (name === 'null') value = null;
      else if (Object.hasOwn(this.constants, name)) value = this.constants[name];
      else this.fail('unknown identifier');
    }
    while (this.take('+')) {
      const right = this.value(depth + 1);
      if (typeof value !== 'string' || typeof right !== 'string') this.fail('only string concatenation is allowed');
      value += right;
    }
    return value;
  }
}

function declaration(html, name, constants = {}) {
  const matches = [...html.matchAll(new RegExp(`\\bconst\\s+${name}\\s*=`, 'g'))];
  if (matches.length !== 1) throw new Error(`Expected exactly one ${name} declaration`);
  const match = matches[0];
  const reader = new LiteralReader(html.slice(match.index + match[0].length), constants);
  const value = reader.value(); reader.require(';'); return value;
}

function parseLegacyHtml(html) {
  if (typeof html !== 'string' || Buffer.byteLength(html) > 5 * 1024 * 1024) throw new Error('Archive must be at most 5 MiB');
  const constants = Object.create(null);
  for (const name of ['WA', 'MAM', 'LN', 'LW', 'UNP', 'ROOT', 'EXAM']) {
    constants[name] = declaration(html, name);
    if (typeof constants[name] !== 'string') throw new Error('Archive path constants must be strings');
  }
  const questions = declaration(html, 'questions', constants);
  const questionRefs = declaration(html, 'questionRefs', constants);
  if (!Array.isArray(questions) || !questions.length || questions.length > 1000) throw new Error('Invalid candidate collection');
  if (!questionRefs || Array.isArray(questionRefs) || typeof questionRefs !== 'object') throw new Error('Invalid reference map');
  const ids = new Set();
  for (const question of questions) {
    if (!Number.isSafeInteger(question.id) || question.id < 1 || ids.has(question.id)) throw new Error('Invalid or duplicate legacy ID');
    ids.add(question.id);
    if (typeof question.title !== 'string' || !question.title.trim() || question.title.length > 2000) throw new Error('Invalid archived title');
    if (!TOPICS.some(topic => topic.id === question.subject)) throw new Error('Unknown archived topic');
  }
  for (const [id, refs] of Object.entries(questionRefs)) {
    if (!ids.has(Number(id)) || !Array.isArray(refs)) throw new Error('Reference map contains an unknown candidate');
    for (const ref of refs) if (!ref || typeof ref.href !== 'string' || typeof ref.loc !== 'string' || typeof ref.file !== 'string' || typeof ref.type !== 'string') throw new Error('Invalid archival reference');
  }
  return { questions, questionRefs, inputSha256: sha256(html) };
}

function parseSavedMarks(html, knownIds) {
  if (Buffer.byteLength(html) > 5 * 1024 * 1024) throw new Error('Saved archive must be at most 5 MiB');
  const studied = new Set();
  // Recover only a checked checkbox for a known ID; ignore arbitrary scripts.
  for (const input of html.matchAll(/<input\b[^>]*>/gi)) {
    const attributes = Object.create(null);
    const source = input[0].replace(/^<input\b/i, '').replace(/\/?\s*>$/, '');
    for (const attribute of source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      attributes[attribute[1].toLowerCase()] = attribute[2] ?? attribute[3] ?? attribute[4] ?? '';
    }
    if (!Object.hasOwn(attributes, 'checked') || (attributes.type && attributes.type.toLowerCase() !== 'checkbox')) continue;
    const match = /^toggleStudied\((\d+),this\.checked\)$/.exec(attributes.onchange || '');
    if (match && knownIds.has(Number(match[1]))) studied.add(Number(match[1]));
  }
  return {
    kind: 'legacy-rendered-study-marks', sourceSha256: sha256(html),
    provenance: 'Saved HTML checkbox snapshot; not current browser storage or verified performance.',
    requiresExplicitImport: true, mustNotOverwriteNewer: true,
    legacyIds: [...studied].sort((a, b) => a - b)
  };
}

async function hashFile(filename) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

async function scanCorpus(directory) {
  const root = await fs.promises.realpath(directory); const pdfs = []; const recordings = [];
  async function walk(current) {
    const entries = await fs.promises.readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) { await walk(absolute); continue; }
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (!['.pdf', '.mp4', '.m4v', '.mkv', '.mov', '.webm'].includes(extension)) continue;
      const stat = await fs.promises.stat(absolute);
      const file = { relativePath: path.relative(root, absolute).split(path.sep).join('/'), bytes: stat.size };
      if (extension === '.pdf') {
        const handle = await fs.promises.open(absolute, 'r');
        let prefix;
        try { const buffer = Buffer.alloc(Math.min(1024, stat.size)); await handle.read(buffer, 0, buffer.length, 0); prefix = buffer.toString('latin1'); }
        finally { await handle.close(); }
        if (!prefix.includes('%PDF-')) throw new Error('Corpus contains a .pdf file without a recognizable PDF header');
        file.sha256 = await hashFile(absolute); pdfs.push(file);
      } else recordings.push(file);
    }
  }
  await walk(root);
  return { root, pdfs, recordings };
}

function buildArtifacts(legacy, corpus, snapshot = null) {
  const byHash = new Map();
  for (const file of corpus.pdfs) {
    if (!/^[0-9a-f]{64}$/.test(file.sha256)) throw new Error('Invalid PDF content hash');
    if (!byHash.has(file.sha256)) byHash.set(file.sha256, { sha256: file.sha256, bytes: file.bytes, aliases: [] });
    byHash.get(file.sha256).aliases.push(file.relativePath);
  }
  const documents = [...byHash.values()].sort((a, b) => a.sha256.localeCompare(b.sha256));
  const sources = Object.create(null);
  documents.forEach((document, index) => {
    document.id = `aa-source-${document.sha256.slice(0, 16)}`;
    if (Object.hasOwn(sources, document.id)) throw new Error('Source ID collision');
    sources[document.id] = { id: document.id, label: `מקור ${index + 1} (PDF)`, path: `${document.id}.pdf`, sha256: document.sha256, bytes: document.bytes, kind: 'unverified-document', sourceType: 'unverified-document', identityStatus: 'file-hash-only', contentStatus: 'needs-review' };
  });
  const privateReferences = Object.entries(legacy.questionRefs).flatMap(([id, refs]) => refs.map(ref => {
    const matches = documents.filter(document => document.aliases.some(alias => normalizeName(alias) === normalizeName(ref.href)));
    return { legacyId: Number(id), ...ref, mappingStatus: matches.length === 1 ? 'filename-match-unverified' : matches.length ? 'ambiguous-filename' : 'missing-filename', candidateSourceIds: matches.map(document => document.id) };
  }));
  const uniqueRefs = new Map(privateReferences.map(ref => [ref.href, ref]));
  const inventory = {
    candidateCount: legacy.questions.length, legacyReferenceCount: privateReferences.length, legacyUniqueReferenceCount: uniqueRefs.size,
    pdfFileCount: corpus.pdfs.length, uniquePdfCount: documents.length, duplicatePdfCount: corpus.pdfs.length - documents.length,
    recordingCount: corpus.recordings.length, recordingBytes: corpus.recordings.reduce((total, file) => total + file.bytes, 0),
    referenceMapping: {
      matchedByFilename: [...uniqueRefs.values()].filter(ref => ref.mappingStatus === 'filename-match-unverified').length,
      ambiguousFilename: [...uniqueRefs.values()].filter(ref => ref.mappingStatus === 'ambiguous-filename').length,
      missingFilename: [...uniqueRefs.values()].filter(ref => ref.mappingStatus === 'missing-filename').length,
      contentVerified: 0
    }
  };
  const topics = TOPICS.map(topic => ({ ...topic, count: legacy.questions.filter(question => question.subject === topic.id).length }));
  const evidenceNotice = 'כותרות ורשימות נושאים הועתקו מארכיון אתר ההכנה הישן לצורך מיון בלבד. הן עדיין לא נבדקו מול חומרי הקורס ואינן קובעות את היקף הבחינה הנוכחית. אין כאן שיעורים או פתרונות מאושרים.';
  const publicPrep = {
    schemaVersion: 1, kind: 'legacy-research-backlog', courseId: COURSE_ID, offeringId: OFFERING_ID,
    courseScope: 'unconfirmed', scopeConfirmed: false, contentStatus: 'needs-review', evidenceNotice,
    inventory, topics,
    items: legacy.questions.map(question => ({ id: `legacy-${question.id}`, legacyId: question.id, title: question.title, topic: question.subject, contentStatus: 'needs-review', lessonUrl: null, referenceCount: (legacy.questionRefs[question.id] || []).length }))
  };
  const curriculum = {
    meta: { version: 1, course: COURSE_ID, courseId: COURSE_ID, offeringId: OFFERING_ID, title: 'נושאים מתקדמים באלגוריתמים', language: 'he', direction: 'rtl', courseScope: 'unconfirmed', scopeConfirmed: false, contentStatus: 'needs-review', evidenceNotice, examDate: null },
    topics, sources, problems: [], units: []
  };
  const privateReport = {
    schemaVersion: 1, kind: 'private-legacy-import-evidence', courseId: COURSE_ID, offeringId: OFFERING_ID,
    inputSha256: legacy.inputSha256, corpusRoot: corpus.root, inventory,
    sourceDocuments: documents, recordings: corpus.recordings, referenceMappings: privateReferences,
    legacyRecords: legacy.questions, snapshotImportSuggestion: snapshot,
    limitations: ['Filename matches are discovery candidates, not identity or source-support verification.', 'Historical predictions, discussions, source locators and personal filenames remain private.', 'No source page was reviewed and no content approval was granted.']
  };
  return { curriculum, publicPrep, privateReport };
}

function assertPrivateDestination(directory) {
  let current = path.resolve(directory);
  // Resolve the nearest existing parent so a symlink cannot hide a checkout.
  while (!fs.existsSync(current)) { const parent = path.dirname(current); if (parent === current) break; current = parent; }
  current = fs.realpathSync(current);
  for (;;) {
    if (fs.existsSync(path.join(current, '.git'))) throw new Error('Private report must be outside every Git checkout');
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
}

async function writeJson(filename, value) {
  await fs.promises.mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.tmp-${crypto.randomBytes(6).toString('hex')}`;
  await fs.promises.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  try { await fs.promises.rename(temporary, filename); }
  catch (error) { await fs.promises.unlink(temporary).catch(() => {}); throw error; }
}

async function main(argv) {
  const options = Object.create(null);
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i];
    if (name === '--write') { options.write = true; continue; }
    if (!['--legacy-html', '--saved-html', '--corpus', '--private-out', '--public-out'].includes(name) || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('Usage: node scripts/import-advanced-research.cjs --legacy-html <index.html> --corpus <folder> [--saved-html <capture.html>] [--write --private-out <outside-git-folder> --public-out <course-folder>]');
    options[name.slice(2)] = argv[++i];
  }
  if (!options['legacy-html'] || !options.corpus) throw new Error('--legacy-html and --corpus are required');
  if (options.write && (!options['private-out'] || !options['public-out'])) throw new Error('--write requires both --private-out and --public-out');
  if (options.write) assertPrivateDestination(options['private-out']);
  const legacy = parseLegacyHtml(await fs.promises.readFile(options['legacy-html'], 'utf8'));
  const snapshot = options['saved-html'] ? parseSavedMarks(await fs.promises.readFile(options['saved-html'], 'utf8'), new Set(legacy.questions.map(question => question.id))) : null;
  const artifacts = buildArtifacts(legacy, await scanCorpus(options.corpus), snapshot);
  if (options.write) {
    await writeJson(path.join(options['private-out'], 'advanced-research-evidence.json'), artifacts.privateReport);
    await writeJson(path.join(options['public-out'], 'curriculum.json'), artifacts.curriculum);
    await writeJson(path.join(options['public-out'], 'exam-prep.json'), artifacts.publicPrep);
  }
  // Never print source paths, names, research prose, or personal study marks.
  process.stdout.write(`${JSON.stringify({ mode: options.write ? 'written-locally' : 'dry-run', ...artifacts.publicPrep.inventory }, null, 2)}\n`);
  return artifacts;
}

module.exports = { LiteralReader, parseLegacyHtml, parseSavedMarks, scanCorpus, buildArtifacts, assertPrivateDestination, main };
if (require.main === module) main(process.argv.slice(2)).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
