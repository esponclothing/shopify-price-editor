const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)[1].trim();
let shopUrl = env.match(/VITE_SHOPIFY_STORE_URL=(.*)/)[1].trim();
if (!shopUrl.startsWith('http')) shopUrl = 'https://' + shopUrl;

axios.post(shopUrl + '/admin/api/2024-04/graphql.json', {
  query: `
    query {
      collections(first: 50) {
        edges {
          node {
            id
            title
            handle
            metafield(namespace: "price_editor", key: "featured_products") {
              value
            }
          }
        }
      }
    }
  `
}, {
  headers: { 'X-Shopify-Access-Token': token }
}).then(res => {
  const cols = res.data.data.collections.edges.map(e => e.node);
  console.log(JSON.stringify(cols.filter(c => c.metafield), null, 2));
}).catch(err => {
  console.error(err.message);
});
