const fs = require('fs');

function check() {
  const html = fs.readFileSync('reader_data.html', 'utf8');
  console.log('Searching for tokens in reader HTML...');
  
  // Search for any key that starts with _ and has a long value
  const matches = html.match(/(_=[a-zA-Z0-9_-]{20,})/g) || [];
  console.log('Matches for _= pattern:', matches.length);
  matches.forEach(m => console.log('Match:', m));

  // Search for long random-looking strings in the whole file
  const longStrings = html.match(/[a-zA-Z0-9_-]{50,}/g) || [];
  console.log('Matches for long strings:', longStrings.length);
  longStrings.slice(0, 10).forEach(s => console.log('Long string:', s.substring(0, 50) + '...'));

  // Search for JSON keys that might be tokens
  if (fs.existsSync('reader_data.json')) {
    const json = JSON.parse(fs.readFileSync('reader_data.json', 'utf8'));
    console.log('Keys in JSON:', Object.keys(json));
    // Recursive search in JSON
    function findToken(obj, path = '') {
      if (typeof obj === 'string' && obj.length > 50) {
        console.log('Potential token in JSON at', path, ':', obj.substring(0, 50) + '...');
      } else if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(k => findToken(obj[k], path + '.' + k));
      }
    }
    findToken(json);
  }
}

check();
