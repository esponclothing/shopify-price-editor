const axios = require('axios');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
let storeUrl = '';
let token = '';

envFile.split('\n').forEach(line => {
  if (line.trim().startsWith('VITE_SHOPIFY_STORE_URL=')) storeUrl = line.split('=')[1].trim();
  if (line.trim().startsWith('VITE_SHOPIFY_ACCESS_TOKEN=')) token = line.split('=')[1].trim();
});

let cleanStore = storeUrl.trim();
if (cleanStore.startsWith('https://')) cleanStore = cleanStore.replace('https://', '');
if (cleanStore.startsWith('http://')) cleanStore = cleanStore.replace('http://', '');

async function run() {
  const query = `
    query {
      collection(id: "gid://shopify/Collection/690229706833") {
        title
        metafields(first: 10) {
          edges {
            node {
              key
              namespace
              value
              updatedAt
            }
          }
        }
      }
    }
  `;
  try {
    const res = await axios.post(`https://${cleanStore}/admin/api/2024-04/graphql.json`, { query }, {
      headers: {
        'X-Shopify-Access-Token': token.trim(),
        'Content-Type': 'application/json'
      }
    });
    console.log(JSON.stringify(res.data.data.collection.metafields.edges, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}
run();
