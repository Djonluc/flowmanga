const fs = require('fs');
const js = fs.readFileSync('main-dev-DO5JyAjg.js', 'utf8');

function search() {
  console.log('Searching for signature clues in JS...');
  
  // Search for any atob strings
  const atobRegex = /atob\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  const atobStrings = [];
  while ((match = atobRegex.exec(js)) !== null) {
    atobStrings.push(match[1]);
  }
  console.log('Found', atobStrings.length, 'atob strings.');
  atobStrings.slice(0, 20).forEach(s => console.log('Atob:', s));

  // Search for the RC4-like loop: for (let i = 0; i < 256; i++) state[i] = i;
  if (js.includes('256')) {
     console.log('JS contains 256, potential RC4 present.');
  }

  // Search for the Switch/Case logic
  const switchRegex = /switch\s*\((\w+)\s*%\s*10\)\s*\{/g;
  while ((match = switchRegex.exec(js)) !== null) {
    console.log('Found signature-like switch/case logic!');
  }
}

search();
