'use strict';
const {readdirSync} = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

// Pass filenames directly: Node 20 on Windows does not expand shell globs.
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'tests');
const files = readdirSync(directory, {withFileTypes: true})
  .filter(entry => entry.isFile() && entry.name.endsWith('.test.js'))
  .map(entry => path.join(directory, entry.name))
  .sort();
if (!files.length) {
  console.error('No test files found in tests/.');
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, ['--test', ...files], {cwd: root, stdio: 'inherit'});
  if (result.error) console.error(result.error.message);
  else if (result.signal) console.error('Test process stopped by ' + result.signal + '.');
  process.exitCode = result.status === null ? 1 : result.status;
}
