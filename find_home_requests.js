const fs = require('fs');
const content = fs.readFileSync('luacomic_home_page.js', 'utf8');

// Find all strings starting with a slash
const matches = content.match(/"\/[a-zA-Z0-9_/.-]+"/g) || [];
const unique = [...new Set(matches)].map(m => m.slice(1, -1));
console.log('Paths in home JS:');
console.log(unique.filter(p => !p.startsWith('/_next') && p.length > 2).slice(0, 100));
