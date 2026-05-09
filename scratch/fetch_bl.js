const https = require('https');
const url = "https://api.allorigins.win/get?url=" + encodeURIComponent("https://w45.blue-lock-manga.com/");
https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(data.substring(0, 500));
  });
});
