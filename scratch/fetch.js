const fs = require('fs');
fetch('https://manhwaread.com/genre/action/')
  .then(r => r.text())
  .then(t => {
    fs.writeFileSync('manhwaread_action.html', t);
    console.log('done');
  });
