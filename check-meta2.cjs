const axios = require('axios');
const url = 'https://i2tu0d-jc.myshopify.com/admin/api/2024-01/graphql.json';
const headers = { 'X-Shopify-Access-Token': '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', 'Content-Type': 'application/json' };

async function run() {
  const q = { query: 'query { product(id: "gid://shopify/Product/15824217604177") { metafield(namespace: "custom", key: "active_campaign") { id value } } }' };
  const res = await axios.post(url, q, {headers});
  console.log(JSON.stringify(res.data, null, 2));
}
run();
