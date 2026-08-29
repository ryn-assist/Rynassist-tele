const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(dir, entry.name)) : entry.name.endsWith('.js') ? [path.join(dir, entry.name)] : []); }
const targets = [...files(path.resolve('src')), ...files(path.resolve('scripts')), ...files(path.resolve('test')).filter(fs.existsSync)];
for (const file of targets) { const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' }); if (result.status) process.exit(result.status); }
console.log(`Syntax valid: ${targets.length} file JavaScript.`);
