const axios = require('axios');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync('.env', 'utf8');
const storeUrl = envContent.match(/VITE_SHOPIFY_STORE_URL=(.*)/)?.[1]?.trim();
const accessToken = envContent.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)?.[1]?.trim();

async function main() {
  try {
    // 1. Get MAIN theme ID
    const themeQuery = `
      query {
        themes(first: 10) {
          edges {
            node {
              id
              role
            }
          }
        }
      }
    `;
    const res = await axios.post(`https://${storeUrl}/admin/api/2024-04/graphql.json`, { query: themeQuery }, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    const mainTheme = res.data.data.themes.edges.find(e => e.node.role === 'MAIN')?.node;
    const themeId = mainTheme.id.split('/').pop();
    console.log("Deploying to Theme ID:", themeId);

    // 2. Read local liquid file
    const localLiquidPath = path.join('C:', 'Users', 'HP', 'Desktop', '11fit theme', 'sections', 'main-collection-product-grid.liquid');
    const localContent = fs.readFileSync(localLiquidPath, 'utf8');
    console.log("Local file length:", localContent.length);

    // 3. Put asset to Shopify
    const assetKey = 'sections/main-collection-product-grid.liquid';
    const putRes = await axios.put(`https://${storeUrl}/admin/api/2024-04/themes/${themeId}/assets.json`, {
      asset: {
        key: assetKey,
        value: localContent
      }
    }, {
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' }
    });

    console.log("Successfully deployed the main-collection-product-grid section asset to Shopify theme!");
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
