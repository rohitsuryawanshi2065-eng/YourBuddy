// Copies the shared web app into ./www (run before start/build).
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', '..', 'web'), dst = path.join(__dirname, '..', 'www');
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log('web → www synced');
