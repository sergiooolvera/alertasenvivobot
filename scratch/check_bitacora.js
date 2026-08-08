const fs = require('fs');
const path = require('path');

const bitacoraPath = path.join(__dirname, '..', 'bitacora.md');
const content = fs.readFileSync(bitacoraPath, 'utf8');

const lines = content.split('\n');
console.log('Total líneas:', lines.length);
lines.slice(-15).forEach((line, idx) => {
    console.log(`${lines.length - 15 + idx + 1}: ${line}`);
});
