const axios = require('axios');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const storeUrl = env.VITE_SHOPIFY_STORE_URL || '';
const accessToken = env.VITE_SHOPIFY_ACCESS_TOKEN || '';

async function checkDiscountCodes() {
  let cleanStore = storeUrl.trim();
  if (cleanStore.startsWith('https://')) cleanStore = cleanStore.replace('https://', '');
  if (cleanStore.startsWith('http://')) cleanStore = cleanStore.replace('http://', '');

  const priceRuleId = 2273531428945;
  const url = `https://${cleanStore}/admin/api/2024-04/price_rules/${priceRuleId}/discount_codes.json`;
  try {
    const res = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    console.log("Discount Codes:", JSON.stringify(res.data.discount_codes, null, 2));
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}

checkDiscountCodes();
