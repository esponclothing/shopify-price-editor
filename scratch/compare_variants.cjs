const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)[1].trim();
let shopUrl = env.match(/VITE_SHOPIFY_STORE_URL=(.*)/)[1].trim();
if (!shopUrl.startsWith('http')) shopUrl = 'https://' + shopUrl;

const query = `
  query {
    p1: productByHandle(handle: "classic-fit-regular-t-shirt") {
      title
      variants(first: 250) {
        edges {
          node {
            title
            price
            sku
          }
        }
      }
    }
    p2: productByHandle(handle: "classic-fit-regular-tshirts") {
      title
      variants(first: 250) {
        edges {
          node {
            title
            price
            sku
          }
        }
      }
    }
  }
`;

axios.post(shopUrl + '/admin/api/2024-04/graphql.json', { query }, {
  headers: { 'X-Shopify-Access-Token': token }
}).then(res => {
  const p1 = res.data.data.p1;
  const p2 = res.data.data.p2;
  
  const v1 = p1.variants.edges.map(e => e.node.title);
  const v2 = p2.variants.edges.map(e => e.node.title);
  
  console.log('Singular product title:', p1.title, `(${v1.length} variants)`);
  console.log('Plural product title:', p2.title, `(${v2.length} variants)`);
  
  const missingInP2 = v1.filter(v => !v2.includes(v));
  const extraInP2 = v2.filter(v => !v1.includes(v));
  
  console.log('Missing in Plural:', missingInP2);
  console.log('Extra in Plural:', extraInP2);
}).catch(err => {
  console.error(err.message);
});
