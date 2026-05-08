const fs = require('fs');

function check() {
  const html = fs.readFileSync('reader_data.html', 'utf8');
  console.log('Reader HTML Length:', html.length);
  
  // Search for anything that looks like a chapter object
  const chapterMatches = html.match(/\{[^{}]*?"hid"[^{}]*?\}/g) || [];
  console.log('Found', chapterMatches.length, 'potential objects with hid');
  
  chapterMatches.forEach(m => {
    if (m.includes('chapter') || m.includes('wv5rr')) {
      console.log('Match:', m.substring(0, 200));
    }
  });
}

check();
