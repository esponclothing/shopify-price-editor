const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)[1].trim();
let shopUrl = env.match(/VITE_SHOPIFY_STORE_URL=(.*)/)[1].trim();
if (!shopUrl.startsWith('http')) shopUrl = 'https://' + shopUrl;

const query = `
  query {
    products(first: 250) {
      edges {
        node {
          id
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
`;

axios.post(shopUrl + '/admin/api/2024-04/graphql.json', { query }, {
  headers: { 'X-Shopify-Access-Token': token }
}).then(res => {
  const prods = res.data.data.products.edges.map(e => e.node);
  const matched = prods.filter(p => p.handle.includes('regular') || p.handle.includes('classic'));
  for (const m of matched) {
    console.log(m.handle, ':', m.title);
    console.log('Options:', JSON.stringify(m.options, null, 2));
  }
}).catch(err => {
  console.error(err.message);
});
