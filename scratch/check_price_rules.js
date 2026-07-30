const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load env from the app folder
dotenv.config({ path: path.join(__dirname, '../.env') });

const storeUrl = process.env.VITE_SHOPIFY_STORE_URL;
const accessToken = process.env.VITE_SHOPIFY_ACCESS_TOKEN;

async function checkRules() {
  let cleanStore = storeUrl.trim();
  if (cleanStore.startsWith('https://')) cleanStore = cleanStore.replace('https://', '');
  if (cleanStore.startsWith('http://')) cleanStore = cleanStore.replace('http://', '');

  const url = `https://${cleanStore}/admin/api/2024-04/price_rules.json`;
  try {
    const res = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    console.log("Price Rules:", JSON.stringify(res.data.price_rules, null, 2));
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}

checkRules();
