const axios = require('axios');
async function run() {
  const query = `{ products(first: 20) { edges { node { title metafield(namespace: "custom", key: "active_campaign") { value } } } } }`;
  const res = await axios.post('https://i2tu0d-jc.myshopify.com/admin/api/2024-01/graphql.json', { query }, {
    headers: { 'X-Shopify-Access-Token': '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', 'Content-Type': 'application/json' }
  });
  console.log(JSON.stringify(res.data.data.products.edges.filter(e => e.node.metafield), null, 2));
}
run();
