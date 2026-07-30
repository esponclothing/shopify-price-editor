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

const themeId = '197172887633'; // Live Theme ID

async function run() {
  try {
    const res = await axios.get(`https://${cleanStore}/admin/api/2024-04/themes/${themeId}/assets.json?asset[key]=sections/collection-subcategories.liquid`, {
      headers: {
        'X-Shopify-Access-Token': token.trim(),
        'Content-Type': 'application/json'
      }
    });
    console.log("Live file size:", res.data.asset.value.length);
    // Write to a temp file to diff it
    fs.writeFileSync('scratch/live_subcategories.liquid', res.data.asset.value);
    console.log("Saved live subcategories liquid to scratch/live_subcategories.liquid");
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}
run();
