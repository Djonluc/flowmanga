const fs = require('fs');
const content = fs.readFileSync('luacomic_home_page.js', 'utf8');

const targets = ['/series', '/popular_tags', 'announcements'];
targets.forEach(t => {
  let idx = 0;
  console.log(`=== Matches for "${t}" ===`);
  while (true) {
    idx = content.indexOf(t, idx);
    if (idx === -1) break;
    console.log(`- index ${idx}:`, content.slice(idx - 150, idx + 150));
    idx += t.length;
  }
});
