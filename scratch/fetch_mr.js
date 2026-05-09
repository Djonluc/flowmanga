const fs = require('fs');
const html = fs.readFileSync('scratch/manhwaread_home.html', 'utf8');
const matches = html.match(/.{0,50}my-stepmother-s-friends.{0,50}/g);
console.log(matches ? matches.join('\n') : 'none');
