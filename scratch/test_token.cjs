const fs = require('fs');

async function run() {
  const store = 'esponsports.myshopify.com';
  const token = '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';
  
  const query = `
    query {
      shop {
        privacyPolicy {
          body
        }
      }
    }
  `;

  const res = await fetch(`https://${store}/admin/api/2024-04/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token
    },
    body: JSON.stringify({ query })
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
