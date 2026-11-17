'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { mimeType, resolveRequestPath, insideRoot, createServer, parsePort } = require('../scripts/preview.cjs');

test('preview serves JavaScript modules, PDF.js binary data, and fonts with explicit MIME types', () => {
  assert.equal(mimeType('pdf.mjs'), 'text/javascript; charset=utf-8');
  assert.equal(mimeType('pdf.worker.mjs'), 'text/javascript; charset=utf-8');
  assert.equal(mimeType('app.js'), 'text/javascript; charset=utf-8');
  assert.equal(mimeType('jbig2.wasm'), 'application/wasm');
  assert.equal(mimeType('Adobe-Hebrew.bcmap'), 'application/octet-stream');
  assert.equal(mimeType('font.woff2'), 'font/woff2');
  assert.equal(mimeType('font.woff'), 'font/woff');
  assert.equal(mimeType('font.ttf'), 'font/ttf');
  assert.equal(mimeType('index.html'), 'text/html; charset=utf-8');
  assert.equal(mimeType('unknown.bin'), 'application/octet-stream');
  assert.equal(mimeType('image.JPG'), 'image/jpeg');
});

test('preview resolves site URLs within docs and ignores cache/query parameters', () => {
  const root = path.resolve('/synthetic/docs');
  assert.equal(resolveRequestPath('/', root), path.join(root, 'index.html'));
  assert.equal(resolveRequestPath('/course/?course=example', root), path.join(root, 'course', 'index.html'));
  assert.equal(resolveRequestPath('/vendor/pdfjs/pdf.mjs?v=1', root), path.join(root, 'vendor', 'pdfjs', 'pdf.mjs'));
  assert.equal(resolveRequestPath('/a%20file.json', root), path.join(root, 'a file.json'));
});

test('preview rejects traversal, Windows escapes, absolute URLs, and malformed encoding before file access', () => {
  const root = path.resolve('/synthetic/docs');
  for (const url of ['/../private.txt', '/x/../../private', '/%2e%2e/private', '/x/%2E%2E/private', '/%2f%2e%2e/private', '/x\\..\\private', '/%5cprivate', '/C:/private', '/file.txt:stream', '/%00', '//server/share']) {
    assert.throws(() => resolveRequestPath(url, root), error => [400, 403].includes(error.statusCode), url);
  }
  for (const url of ['https://example.test/file', '/%ZZ']) assert.throws(() => resolveRequestPath(url, root), error => error.statusCode === 400, url);
  assert.equal(insideRoot(root, path.resolve(root, '../docs-other/file')), false);
  assert.equal(insideRoot(root, path.join(root, 'file')), true);
});

test('preview is opt-in on require and only accepts an explicit valid port', () => {
  const server = createServer();
  assert.equal(server.listening, false);
  assert.equal(parsePort([]), 8768);
  assert.equal(parsePort(['--port=9123']), 9123);
  for (const args of [['--port=0'], ['--port=65536'], ['--port=12.5'], ['--host=0.0.0.0'], ['--port=8000', '--port=8001']]) assert.throws(() => parsePort(args));
});
