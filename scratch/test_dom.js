const fs = require('fs');
fetch('https://w45.blue-lock-manga.com/manga/blue-lock-chapter-1/', {
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    }
}).then(r => r.text())
  .then(html => {
      const imgRegex = /<img[^>]+>/g;
      const images = [];
      let pageNumber = 1;
      let match;
      while ((match = imgRegex.exec(html)) !== null) {
          const img = match[0];
          let srcMatch = img.match(/data-src=["']([^"']+)["']/);
          if (!srcMatch) srcMatch = img.match(/src=["']([^"']+)["']/);
          if (srcMatch) {
              const src = srcMatch[1];
              if (src && !src.includes('data:image') && !src.includes('logo') && !src.includes('avatar') && !src.includes('icon')) {
                  images.push({ url: src, pageNumber: pageNumber++ });
              }
          }
      }
      console.log('Total extracted:', images.length);
      console.log(images.slice(0, 3));
  })
  .catch(console.error);
