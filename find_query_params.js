const fs = require('fs');
const content = fs.readFileSync('luacomic_series_page.js', 'utf8');

const target = '/query';
let idx = 0;
while (true) {
  idx = content.indexOf(target, idx);
  if (idx === -1) break;
  console.log(`- index ${idx}:`, content.slice(idx - 150, idx + 150));
  idx += target.length;
}
