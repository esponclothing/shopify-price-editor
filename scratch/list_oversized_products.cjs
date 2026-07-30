const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)[1].trim();
let shopUrl = env.match(/VITE_SHOPIFY_STORE_URL=(.*)/)[1].trim();
if (!shopUrl.startsWith('http')) shopUrl = 'https://' + shopUrl;

const query = `
  query {
    collectionByHandle(handle: "t-shirts-oversized") {
      title
      products(first: 50) {
        edges {
          node {
            id
            title
            handle
            options {
              name
              values
            }
            variants(first: 1) {
              edges {
                node {
                  price
                  compareAtPrice
                }
              }
            }
          }
        }
      }
    }
  }
`;

axios.post(shopUrl + '/admin/api/2024-04/graphql.json', { query }, {
  headers: { 'X-Shopify-Access-Token': token }
}).then(res => {
  const col = res.data.data.collectionByHandle;
  if (!col) {
    console.log('Collection not found, trying alternate handles...');
    return;
  }
  console.log('Collection:', col.title);
  const products = col.products.edges.map(e => e.node);
  for (const p of products) {
    console.log(`\n${p.handle} (${p.title})`);
    console.log('  ID:', p.id);
    console.log('  Price:', p.variants.edges[0]?.node?.price, '| Compare:', p.variants.edges[0]?.node?.compareAtPrice);
    for (const o of p.options) {
      console.log(`  ${o.name}:`, o.values.join(', '));
    }
  }
}).catch(err => {
  console.error(err.message);
});
