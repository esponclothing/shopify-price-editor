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
  
  const policies = JSON.parse(fs.readFileSync('policies_dump.json')).policies;
  
  for (let p of policies) {
     let newHtml = formatHtml(p.body);
     
     let typeMap = {
        'Privacy policy': 'PRIVACY_POLICY',
        'Refund policy': 'REFUND_POLICY',
        'Terms of service': 'TERMS_OF_SERVICE',
        'Shipping': 'SHIPPING_POLICY',
        'Legal notice': 'LEGAL_NOTICE',
        'Contact': 'CONTACT_INFORMATION'
     };
     
     const policyType = typeMap[p.title];
     if(!policyType) continue;

     const query = `
       mutation shopPolicyUpdate($policy: ShopPolicyInput!) {
         shopPolicyUpdate(shopPolicy: $policy) {
           shopPolicy {
             id
             title
           }
           userErrors {
             field
             message
           }
         }
       }
     `;

     const variables = {
       policy: {
         body: newHtml,
         type: policyType
       }
     };

     const gqlRes = await fetch('https://' + store + '/admin/api/2024-04/graphql.json', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'X-Shopify-Access-Token': token
       },
       body: JSON.stringify({ query, variables })
     });
     
     const gqlData = await gqlRes.json();
     if(gqlData.data && gqlData.data.shopPolicyUpdate && gqlData.data.shopPolicyUpdate.userErrors.length === 0) {
        console.log('Updated policy without CSS block:', p.title, 'SUCCESS');
     } else {
        console.log('Error updating policy:', p.title, JSON.stringify(gqlData));
     }
  }
}
run();
