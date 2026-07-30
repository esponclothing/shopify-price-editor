const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)[1].trim();
let shopUrl = env.match(/VITE_SHOPIFY_STORE_URL=(.*)/)[1].trim();
if (!shopUrl.startsWith('http')) shopUrl = 'https://' + shopUrl;

const query = `
  query {
    collectionByHandle(handle: "t-shirts-regular-fit") {
      title
      products(first: 50) {
        edges {
          node {
            title
            handle
            options {
              name
              values
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
  console.log(JSON.stringify(products, null, 2));
}).catch(err => {
  console.error(err.message);
});
