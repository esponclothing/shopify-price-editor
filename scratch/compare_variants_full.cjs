const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)[1].trim();
let shopUrl = env.match(/VITE_SHOPIFY_STORE_URL=(.*)/)[1].trim();
if (!shopUrl.startsWith('http')) shopUrl = 'https://' + shopUrl;

const query = `
  query {
    p1: productByHandle(handle: "classic-fit-regular-t-shirt") {
      variants(first: 250) {
        edges {
          node {
            title
            sku
            price
          }
        }
      }
    }
    p2: productByHandle(handle: "classic-fit-regular-tshirts") {
      variants(first: 250) {
        edges {
          node {
            title
            sku
            price
          }
        }
      }
    }
  }
`;

axios.post(shopUrl + '/admin/api/2024-04/graphql.json', { query }, {
  headers: { 'X-Shopify-Access-Token': token }
}).then(res => {
  const p1 = res.data.data.p1.variants.edges.map(e => e.node);
  const p2 = res.data.data.p2.variants.edges.map(e => e.node);
  
  console.log('Singular Variants:');
  console.log(p1.map(v => `${v.title} (${v.price})`).slice(0, 10));
  
  console.log('Plural Variants:');
  console.log(p2.map(v => `${v.title} (${v.price})`).slice(0, 10));
  
  const diff1 = p1.filter(v1 => !p2.some(v2 => v2.title === v1.title));
  const diff2 = p2.filter(v2 => !p1.some(v1 => v1.title === v2.title));
  
  console.log('In Singular but not Plural:', diff1);
  console.log('In Plural but not Singular:', diff2);
}).catch(err => {
  console.error(err.message);
});
