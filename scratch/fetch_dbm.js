const fs = require('fs');

// Parse chapter listing to build a full chapter map
const html = fs.readFileSync('scratch/dbm_chapters.html', 'utf8');

// Extract chapter blocks with their page ranges
// Pattern: <h4>Chapter N: Title</h4> followed by page-X links
const chapterRegex = /<h4>Chapter (\d+): ([^<]+)<\/h4>\s*<p>([\s\S]*?)<\/p>/g;
let match;
const chapters = [];
while ((match = chapterRegex.exec(html)) !== null) {
    const chNum = match[1];
    const chTitle = match[2];
    const pageBlock = match[3];
    const pages = pageBlock.match(/page-(\d+)\.html/g);
    if (pages) {
        const pageNums = pages.map(p => parseInt(p.match(/\d+/)[0]));
        chapters.push({
            number: chNum,
            title: chTitle,
            firstPage: Math.min(...pageNums),
            lastPage: Math.max(...pageNums),
            pageCount: pages.length
        });
    }
}

console.log('Total chapters found:', chapters.length);
console.log('\nFirst 5 chapters:');
chapters.slice(0, 5).forEach(c => console.log(`  Ch${c.number}: "${c.title}" pages ${c.firstPage}-${c.lastPage} (${c.pageCount} pages)`));
console.log('\nLast 3 chapters:');
chapters.slice(-3).forEach(c => console.log(`  Ch${c.number}: "${c.title}" pages ${c.firstPage}-${c.lastPage} (${c.pageCount} pages)`));
