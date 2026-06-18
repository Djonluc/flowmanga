async function test() {
  try {
    const res = await fetch('https://sankakuapi.com/posts/keyset?tags=rating:safe&limit=40');
    const data = await res.json();
    console.log(data.data[0].preview_url);
    console.log(data.data[0].sample_url);
    console.log(data.data[0].file_url);
  } catch (e) {
    console.error(e);
  }
}
test();
