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

async function setMeta() {
  try {
    const res = await axios.post(`https://${cleanStore}/admin/api/2024-04/products/15824217604177/metafields.json`, {
      metafield: {
        namespace: "price_editor",
        key: "combo_config",
        value: JSON.stringify({ count: 2, price: 800 }),
        type: "json"
      }
    }, {
      headers: {
        'X-Shopify-Access-Token': token.trim(),
        'Content-Type': 'application/json'
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}
setMeta();
