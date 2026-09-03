const fs = require('fs');

function replaceText(html) {
  if(!html) return '';
  let txt = html.replace(/Espon Clothing Pvt\. Ltd\.?/gi, 'ELEVENFIT CLOTHING PRIVATE LIMITED');
  txt = txt.replace(/Espon Clothing/gi, 'ELEVENFIT CLOTHING PRIVATE LIMITED');
  txt = txt.replace(/Espon/gi, '11FIT');
  return txt;
}

function formatHtml(html) {
  if(!html) return '';
  
  if(html.includes('policy-container')) {
    let cleaned = html;
    const marker = '<div class="policy-container">';
    if (cleaned.includes(marker)) {
      const markerPos = cleaned.indexOf(marker);
      if (markerPos > 0) {
        cleaned = cleaned.substring(markerPos);
      }
    }
    return replaceText(cleaned);
  }

  let cleaned = html.replace(/<style>.*?<\/style>/gis, '');
  
  let parts = cleaned.split(/<h2[^>]*>/i);
  let newHtml = '<div class="policy-container">';
  
  let intro = parts[0].trim();
  if (intro) {
    newHtml += '<div class="policy-section">' + intro + '</div>';
  }
  
  for(let i=1; i<parts.length; i++) {
    let content = parts[i].split('</h2>');
    if (content.length > 1) {
       let h2Text = content[0];
       let rest = content[1];
       newHtml += '<div class="policy-section"><h2>' + h2Text + '</h2>' + rest + '</div>';
    } else {
       newHtml += '<div class="policy-section"><h2>' + parts[i] + '</div>';
    }
  }
  
  newHtml += '</div>';
  return replaceText(newHtml);
}

async function run() {
  const store = 'esponsports.myshopify.com';
  const token = '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';
  
  // 1. Fetch current pages
  const getRes = await fetch(`https://${store}/admin/api/2024-04/pages.json?limit=250`, {
    headers: { 'X-Shopify-Access-Token': token }
  });
  const data = await getRes.json();
  if (!data.pages) return console.log(data);

  // 2. Format and update them
  for (let p of data.pages) {
     let newHtml = formatHtml(p.body_html);
     
     const res = await fetch(`https://${store}/admin/api/2024-04/pages/${p.id}.json`, {
       method: 'PUT',
       headers: {
         'Content-Type': 'application/json',
         'X-Shopify-Access-Token': token
       },
       body: JSON.stringify({
         page: {
           id: p.id,
           body_html: newHtml
         }
       })
     });
     
     if(res.ok) {
        console.log('Updated page:', p.title);
     } else {
        console.log('Failed to update page:', p.title, await res.text());
     }
  }
}
run();
