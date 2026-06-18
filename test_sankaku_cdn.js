import { execSync } from 'child_process';
async function test() {
  const res = await fetch('https://sankakuapi.com/posts/keyset?tags=rating:safe&limit=1');
  const d = await res.json();
  const url = d.data[0].sample_url;
  console.log(url);
  execSync('curl.exe -I -A "Mozilla/5.0" -H "Referer: https://chan.sankakucomplex.com" "' + url + '"', {stdio:'inherit'});
  execSync('curl.exe -I -A "Mozilla/5.0" -H "Referer: http://localhost:5173" "' + url + '"', {stdio:'inherit'});
  execSync('curl.exe -I -A "Mozilla/5.0" "' + url + '"', {stdio:'inherit'});
}
test();
