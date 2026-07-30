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
      options {
        name
        values
      }
      variants(first: 250) {
        edges {
          node {
            title
            selectedOptions {
              name
              value
            }
          }
        }
      }
    }
    p2: productByHandle(handle: "classic-fit-regular-tshirts") {
      title
      options {
        name
        values
      }
      variants(first: 250) {
        edges {
          node {
            title
            selectedOptions {
              name
              value
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
  const p1 = res.data.data.p1;
  const p2 = res.data.data.p2;
  
  console.log('Singular Product Options:', JSON.stringify(p1.options, null, 2));
  console.log('Plural Product Options:', JSON.stringify(p2.options, null, 2));
  
  console.log('Singular Variants count:', p1.variants.edges.length);
  console.log('Plural Variants count:', p2.variants.edges.length);
}).catch(err => {
  console.error(err.message);
});
