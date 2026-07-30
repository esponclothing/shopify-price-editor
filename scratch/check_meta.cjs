const axios = require('axios');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
let storeUrl = '';
let token = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SHOPIFY_STORE_URL=')) storeUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SHOPIFY_ACCESS_TOKEN=')) token = line.split('=')[1].trim();
});

let cleanStore = storeUrl.trim();
if (cleanStore.startsWith('https://')) cleanStore = cleanStore.replace('https://', '');
if (cleanStore.startsWith('http://')) cleanStore = cleanStore.replace('http://', '');

async function getMeta() {
  try {
    const res = await axios.get(`https://${cleanStore}/admin/api/2024-04/products/15824217604177/metafields.json`, {
      headers: {
        'X-Shopify-Access-Token': token.trim(),
        'Content-Type': 'application/json'
      }
    });
    console.log(JSON.stringify(res.data.metafields.filter(m => m.namespace === 'price_editor'), null, 2));
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}
getMeta();
