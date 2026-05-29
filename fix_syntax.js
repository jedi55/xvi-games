const fs = require('fs');
const file = 'src/pages/booking.js';
let content = fs.readFileSync(file, 'utf8');

// Replace \${ with ${
content = content.replace(/\\\${/g, '${');

// Replace \` with `
content = content.replace(/\\`/g, '`');

fs.writeFileSync(file, content);
console.log('Fixed syntax errors');
