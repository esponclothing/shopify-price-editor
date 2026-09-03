import fetch from 'node-fetch';

const STORE = 'i2tu0d-jc.myshopify.com';
const TOKEN = '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';

fetch(`https://${STORE}/admin/api/2024-04/graphql.json`, {
  method: 'POST',
  headers: {
    'X-Shopify-Access-Token': TOKEN,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: '{ shop { name } }' })
})
.then(r => r.json().then(data => ({ status: r.status, data })))
.then(({ status, data }) => {
  console.log('Shopify GraphQL OK:', status, JSON.stringify(data, null, 2));
})
.catch(e => {
  console.error('Shopify GraphQL ERROR:', e);
});
