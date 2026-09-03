const fs = require('fs');

fetch('https://11fit.in')
  .then(r => r.text())
  .then(t => {
    fs.writeFileSync('scratch/live_html.txt', t);
    const m = [...t.matchAll(/(?:['"]|id=|pixel=)(\d{15,16})(?:['"]|&|;)/g)];
    const unique = [...new Set(m.map(x => x[1]))];
    console.log("Potential Pixel IDs:", unique);
  });
