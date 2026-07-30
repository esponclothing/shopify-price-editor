const axios = require('axios');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const storeUrl = envContent.match(/VITE_SHOPIFY_STORE_URL=(.*)/)?.[1]?.trim();
const accessToken = envContent.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)?.[1]?.trim();

async function main() {
  try {
    // 1. Get products list
    console.log("Fetching products from", storeUrl);
    const res = await axios.get(`https://${storeUrl}/admin/api/2024-04/products.json?limit=50`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    
    const products = res.data.products;
    console.log(`Fetched ${products.length} products.`);
    
    // 2. Find any combo products or products with template_suffix === 'combo'
    const comboProducts = products.filter(p => p.template_suffix === 'combo' || p.title.toLowerCase().includes('combo') || p.handle.toLowerCase().includes('combo'));
    if (comboProducts.length > 0) {
      console.log("\nFound combo products:");
      comboProducts.forEach(p => {
        console.log(`- Title: ${p.title}`);
        console.log(`  Handle: ${p.handle}`);
        console.log(`  Suffix: ${p.template_suffix}`);
        console.log(`  URL: https://${storeUrl}/products/${p.handle}`);
        console.log(`  Preview URL: https://11fit.in/products/${p.handle}`);
      });
    } else {
      console.log("\nNo products with template suffix 'combo' or combo in title found.");
      console.log("Here is a list of some products in the store:");
      products.slice(0, 10).forEach(p => {
        console.log(`- ${p.title} (suffix: ${p.template_suffix}) -> handle: ${p.handle}`);
      });
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();
