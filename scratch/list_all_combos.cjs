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
          metafield(namespace: "price_editor", key: "combo_config") {
            value
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
  const combos = prods.filter(p => {
    if (!p.metafield?.value) return false;
    try {
      const val = JSON.parse(p.metafield.value);
      return val.count > 0 && val.price > 0;
    } catch(e) {
      return false;
    }
  });
  console.log(JSON.stringify(combos, null, 2));
}).catch(err => {
  console.error(err.message);
});
