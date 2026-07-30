const axios = require('axios');
const url = 'https://i2tu0d-jc.myshopify.com/admin/api/2024-01/graphql.json';
const headers = { 'X-Shopify-Access-Token': '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', 'Content-Type': 'application/json' };

async function run() {
  const q = { query: 'mutation metafieldDelete($input: MetafieldDeleteInput!) { metafieldDelete(input: $input) { deletedId userErrors { message } } }', variables: { input: { id: "gid://shopify/Metafield/190089459892305" } } };
  const res = await axios.post(url, q, {headers});
  console.log(JSON.stringify(res.data, null, 2));
}
run();
