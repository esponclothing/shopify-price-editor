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
            availableForSale
            inventoryQuantity
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
            availableForSale
            inventoryQuantity
          }
        }
      }
    }
  }
`;

axios.post(shopUrl + '/admin/api/2024-04/graphql.json', { query }, {
  headers: { 'X-Shopify-Access-Token': token }
}).then(res => {
  if (res.data.errors) {
    console.error(JSON.stringify(res.data.errors));
    return;
  }
  const p1 = res.data.data.p1;
  const p2 = res.data.data.p2;
  
  const inStock1 = p1.variants.edges.filter(e => e.node.inventoryQuantity > 0 || e.node.availableForSale).map(e => e.node.title);
  const inStock2 = p2.variants.edges.filter(e => e.node.inventoryQuantity > 0 || e.node.availableForSale).map(e => e.node.title);
  
  console.log('Singular Product In-Stock count:', inStock1.length);
  console.log('Plural Product In-Stock count:', inStock2.length);
  
  const missingInStock2 = inStock1.filter(v => !inStock2.includes(v));
  const extraInStock2 = inStock2.filter(v => !inStock1.includes(v));
  
  console.log('Missing In-Stock in Plural:', missingInStock2);
  console.log('Extra In-Stock in Plural:', extraInStock2);
}).catch(err => {
  console.error(err.message);
});
