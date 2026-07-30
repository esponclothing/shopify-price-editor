const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)[1].trim();
let shopUrl = env.match(/VITE_SHOPIFY_STORE_URL=(.*)/)[1].trim();
if (!shopUrl.startsWith('http')) shopUrl = 'https://' + shopUrl;

const query = `
  query {
    collectionByHandle(handle: "t-shirts-regular-fit") {
      products(first: 50) {
        edges {
          node {
            id
            title
            handle
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
  const products = res.data.data.collectionByHandle.products.edges.map(e => e.node);
  const info = products.map(p => ({
    handle: p.handle,
    title: p.title,
    id: p.id,
    price: p.variants.edges[0]?.node?.price,
    compareAtPrice: p.variants.edges[0]?.node?.compareAtPrice
  }));
  console.log(JSON.stringify(info, null, 2));
}).catch(err => {
  console.error(err.message);
});
