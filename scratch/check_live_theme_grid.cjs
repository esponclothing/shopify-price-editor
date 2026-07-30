const axios = require('axios');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const storeUrl = envContent.match(/VITE_SHOPIFY_STORE_URL=(.*)/)?.[1]?.trim();
const accessToken = envContent.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)?.[1]?.trim();

async function main() {
  try {
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
    console.log("Active Theme ID:", themeId);

    const assetKey = 'sections/main-collection-product-grid.liquid';
    const assetRes = await axios.get(`https://${storeUrl}/admin/api/2024-04/themes/${themeId}/assets.json?asset[key]=${assetKey}`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });

    const val = assetRes.data.asset.value;
    console.log("File length:", val.length);
    console.log("Contains 'category-all-sections'?", val.includes('category-all-sections'));
    console.log("Contains 'collection.handle == 'all''?", val.includes("collection.handle == 'all'"));

    // Let's print around collection.handle checks
    const index = val.indexOf("collection.handle ==");
    if (index !== -1) {
      console.log("Snippet around first 'collection.handle ==':");
      console.log(val.substring(index - 100, index + 300));
    } else {
      console.log("No 'collection.handle ==' found in the live code!");
    }
  } catch (err) {
    console.error(err.message);
  }
}

main();
