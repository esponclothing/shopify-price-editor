fetch('https://11fit.in')
  .then(r => r.text())
  .then(t => {
    let m = t.match(/pixelId["']?\s*:\s*["'](\d+)/i);
    if (!m) m = t.match(/id["']?\s*:\s*["'](\d+)["'].*?facebook/i);
    if (!m) m = t.match(/facebook.*?pixel.*?(\d{10,16})/i);
    console.log("Found pixel ID:", m ? m[1] : 'not found');
  });
