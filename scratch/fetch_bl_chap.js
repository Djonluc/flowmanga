const fs = require('fs');
const { JSDOM } = require('jsdom');
fetch('https://w45.blue-lock-manga.com/manga/blue-lock-chapter-1/', {
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    }
}).then(r => r.text())
  .then(t => {
      const dom = new JSDOM(t);
      const doc = dom.window.document;
      const images = [];
      doc.querySelectorAll('img[data-src], img[src]').forEach(img => {
          const src = img.getAttribute('data-src') || img.getAttribute('src');
          if (src && !src.includes('data:image') && !src.includes('logo') && !src.includes('avatar')) {
              images.push(src);
          }
      });
      console.log('Images found:', images.length);
      console.log(images.slice(0, 5).join('\n'));
  })
  .catch(console.error);
