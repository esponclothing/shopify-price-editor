const axios = require('axios');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const storeUrl = envFile.match(/VITE_SHOPIFY_STORE_URL=(.+)/)[1].trim();
const accessToken = envFile.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.+)/)[1].trim();

async function fetchSampleProduct() {
  try {
    const response = await axios.get(`https://${storeUrl}/admin/api/2024-04/products.json?limit=2`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    const products = response.data.products;
    for (const p of products) {
      // Don't log the one we just updated
      if (p.id.toString() !== '10399182618756') {
        console.log(`--- FORMAT FOR PRODUCT: ${p.title} ---`);
        console.log(p.body_html);
        console.log('--------------------------------------');
        break;
      }
    }
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

fetchSampleProduct();
