const https = require('https');

https.get('https://loinew.com/images/Blue%20Lock/yJmnc7ysWZvflkV4CXXEAtE7IVxHSu1765998387.jpg', {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Referer": "https://w45.blue-lock-manga.com/"
  }
}, (res) => {
  console.log('Status code:', res.statusCode);
  console.log('Headers:', res.headers);
});
