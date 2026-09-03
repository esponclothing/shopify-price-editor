const fs = require('fs');
const token = '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';
const store = 'i2tu0d-jc.myshopify.com';

const css = `
<style>
  .policy-container {
    max-width: 800px;
    margin: 0 auto;
    font-family: inherit;
    line-height: 1.8;
    color: #333;
  }
  .policy-header {
    text-align: center;
    margin-bottom: 40px;
  }
  .policy-header h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 10px;
    color: #111;
  }
  .policy-header p {
    font-size: 1.1rem;
    color: #555;
    max-width: 600px;
    margin: 0 auto;
  }
  .policy-section {
    background: #fff;
    border: 1px solid #eaeaea;
    border-radius: 8px;
    padding: 30px 35px;
    margin-bottom: 25px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.02);
  }
  .policy-section h2, .policy-section h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 15px;
    color: #111;
  }
  .policy-section p, .policy-section ul {
    margin-bottom: 15px;
    font-size: 1.05rem;
  }
  .policy-section ul { padding-left: 20px; }
  .policy-section li { margin-bottom: 8px; }
  .highlight-box {
    background: #f9f9f9;
    border-left: 4px solid #111;
    padding: 20px;
    margin: 25px 0;
    font-weight: 500;
    font-size: 1.1rem;
    color: #222;
    font-style: italic;
  }
</style>
`;

function replaceText(html) {
  if(!html) return '';
  let txt = html.replace(/Espon Clothing Pvt\. Ltd\.?/gi, 'ELEVENFIT CLOTHING PRIVATE LIMITED');
  txt = txt.replace(/Espon Clothing/gi, 'ELEVENFIT CLOTHING PRIVATE LIMITED');
  txt = txt.replace(/Espon/gi, '11FIT');
  return txt;
}

function formatHtml(html, title) {
  if(!html) return '';
  
  if(html.includes('policy-container')) {
    return replaceText(html);
  }

  let cleaned = html.replace(/<style>.*?<\/style>/gis, '');
  
  let parts = cleaned.split(/<h2[^>]*>/i);
  let newHtml = css + '<div class="policy-container">';
  
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
  const pages = JSON.parse(fs.readFileSync('pages_dump.json')).pages;
  for (let p of pages) {
    if (p.title === 'kp account') continue;
    
    let newHtml = formatHtml(p.body_html, p.title);
    
    const res = await fetch('https://' + store + '/admin/api/2024-04/pages/' + p.id + '.json', {
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
    console.log('Updated page:', p.title, res.status);
  }

  // To update policies, Shopify GraphQL API is required: `shopPolicyUpdate`
  // But wait, GraphQL uses `shopPolicyUpdate` which expects a policy input.
  const policies = JSON.parse(fs.readFileSync('policies_dump.json')).policies;
  
  for (let p of policies) {
     let newHtml = formatHtml(p.body, p.title);
     // Update using GraphQL
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
        console.log('Updated policy:', p.title, 'SUCCESS');
     } else {
        console.log('Error updating policy:', p.title, JSON.stringify(gqlData));
     }
  }
}
run();
