#!/usr/bin/env node
'use strict';

// Local preview only. Explicit MIME types keep PDF.js modules usable on Windows.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const DEFAULT_ROOT = path.resolve(__dirname, '../docs');
const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.bcmap': 'application/octet-stream',
  '.pdf': 'application/pdf'
});

function mimeType(filename) {
  return MIME_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}

function requestError(statusCode) {
  const error = new Error(statusCode === 400 ? 'Bad request' : 'Forbidden');
  error.statusCode = statusCode;
  return error;
}

function insideRoot(root, filename) {
  const relative = path.relative(root, filename);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function resolveRequestPath(url, root = DEFAULT_ROOT) {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) throw requestError(400);
  const rawPath = url.split(/[?#]/, 1)[0];
  let decoded;
  try { decoded = decodeURIComponent(rawPath); }
  catch { throw requestError(400); }
  // Inspect before URL normalization can erase traversal segments. Backslashes,
  // drive letters and alternate streams are never legitimate site URL paths.
  if (/[\\:\0]/.test(decoded) || decoded.startsWith('//') || decoded.split('/').some(part => part === '..')) throw requestError(403);
  const absoluteRoot = path.resolve(root);
  const relative = decoded.replace(/^\/+/, '') + (decoded.endsWith('/') ? 'index.html' : '');
  const filename = path.resolve(absoluteRoot, relative);
  if (!insideRoot(absoluteRoot, filename)) throw requestError(403);
  return filename;
}

function sendError(response, statusCode, headOnly = false) {
  const messages = { 400: 'Bad request', 403: 'Forbidden', 404: 'Not found', 405: 'Method not allowed', 500: 'Preview error' };
  const body = `${messages[statusCode] || messages[500]}\n`;
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(statusCode === 405 ? { Allow: 'GET, HEAD' } : {})
  });
  response.end(headOnly ? undefined : body);
}

function createServer({ root = DEFAULT_ROOT } = {}) {
  const realRoot = fs.realpathSync(root);
  return http.createServer(async (request, response) => {
    const headOnly = request.method === 'HEAD';
    if (request.method !== 'GET' && !headOnly) { sendError(response, 405); return; }
    try {
      let filename = resolveRequestPath(request.url, realRoot);
      let realFilename = await fs.promises.realpath(filename);
      if (!insideRoot(realRoot, realFilename)) throw requestError(403);
      let stat = await fs.promises.stat(realFilename);
      if (stat.isDirectory()) {
        filename = path.join(realFilename, 'index.html');
        realFilename = await fs.promises.realpath(filename);
        if (!insideRoot(realRoot, realFilename)) throw requestError(403);
        stat = await fs.promises.stat(realFilename);
      }
      if (!stat.isFile()) { sendError(response, 404, headOnly); return; }
      response.writeHead(200, {
        'Content-Type': mimeType(realFilename),
        'Content-Length': stat.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      if (headOnly) { response.end(); return; }
      const stream = fs.createReadStream(realFilename);
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    } catch (error) {
      const statusCode = error.statusCode || (['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : ['EACCES', 'EPERM'].includes(error.code) ? 403 : 500);
      if (!response.headersSent) sendError(response, statusCode, headOnly);
      else response.destroy();
    }
  });
}

function parsePort(argv) {
  if (!argv.length) return 8768;
  if (argv.length !== 1 || !/^--port=\d+$/.test(argv[0])) throw new Error('Usage: node scripts/preview.cjs [--port=8768]');
  const port = Number(argv[0].slice('--port='.length));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be between 1 and 65535');
  return port;
}

function main(argv) {
  const port = parsePort(argv);
  const server = createServer();
  server.on('error', error => { process.stderr.write(`Preview could not start (${error.code || 'error'}).\n`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => process.stdout.write(`Local preview: http://127.0.0.1:${port}/\n`));
  return server;
}

module.exports = { mimeType, resolveRequestPath, insideRoot, createServer, parsePort, main };
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
