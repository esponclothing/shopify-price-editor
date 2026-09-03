fetch('https://11fit.in')
  .then(r => r.text())
  .then(t => {
    let m1 = [...t.matchAll(/pixelId["']?\s*:\s*["'](\d+)/gi)].map(m => m[1]);
    let m2 = [...t.matchAll(/id["']?\s*:\s*["'](\d+)["'].*?facebook/gi)].map(m => m[1]);
    let m3 = [...t.matchAll(/facebook.*?pixel.*?(\d{10,16})/gi)].map(m => m[1]);
    let m4 = [...t.matchAll(/fbq\('init',\s*['"](\d+)/gi)].map(m => m[1]);
    let all = [...new Set([...m1, ...m2, ...m3, ...m4])];
    console.log("All Pixels:", all);
  });
