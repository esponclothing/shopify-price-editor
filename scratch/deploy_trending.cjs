const axios = require('axios');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync('.env', 'utf-8');
const storeUrl = envContent.match(/VITE_SHOPIFY_STORE_URL=(.*)/)?.[1]?.trim();
const accessToken = envContent.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)?.[1]?.trim();
const themeId = '197172887633'; // Live Theme ID

async function main() {
  try {
    const localLiquidPath = path.join('C:', 'Users', 'HP', 'Desktop', '11fit theme', 'sections', '11fit-flash-sale.liquid');
    const localContent = fs.readFileSync(localLiquidPath, 'utf8');
    console.log("Local file length:", localContent.length);

    const assetKey = 'sections/11fit-flash-sale.liquid';
    const putRes = await axios.put(`https://${storeUrl}/admin/api/2024-04/themes/${themeId}/assets.json`, {
      asset: {
        key: assetKey,
        value: localContent
      }
    }, {
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' }
    });

    console.log("Successfully deployed the 11fit-flash-sale section asset to Shopify theme!");
    console.log("Remote File Key:", putRes.data.asset.key);
    console.log("Remote File Size:", putRes.data.asset.size);
  } catch (err) {
    console.error("Error deploying asset:", err.message);
    if (err.response) {
      console.error(JSON.stringify(err.response.data));
    }
  }
}

main();
