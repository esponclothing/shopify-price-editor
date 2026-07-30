const axios = require('axios');
require('dotenv').config();

const storeUrl = process.env.VITE_SHOPIFY_STORE_URL;
const accessToken = process.env.VITE_SHOPIFY_ACCESS_TOKEN;

async function main() {
  try {
    // 1. Get MAIN theme ID
    const themeQuery = `
      query {
        themes(first: 10) {
          edges {
            node {
              id
              name
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
    if (!mainTheme) {
      console.log("No active theme found!");
      return;
    }
    const themeId = mainTheme.id.split('/').pop();
    console.log(`Published Theme: ${mainTheme.name} (ID: ${themeId})`);

    // 2. Fetch Assets list
    const assetsRes = await axios.get(`https://${storeUrl}/admin/api/2024-04/themes/${themeId}/assets.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    
    const assets = assetsRes.data.assets;
    console.log(`Total Assets: ${assets.length}`);

    // Search for main-collection-product-grid or subcategory or collection template files
    const relevantAssets = assets.filter(a => 
      a.key.includes('subcat') || 
      a.key.includes('pill') || 
      a.key.includes('collection') || 
      a.key.includes('product-grid')
    );
    console.log("Found relevant assets:");
    relevantAssets.forEach(a => console.log(`- ${a.key}`));

    // Let's print out all files in templates/ or sections/ to locate where the collection grid renders
    const templatesAndSections = assets.filter(a => a.key.startsWith('sections/') || a.key.startsWith('snippets/'));
    console.log("\nSample sections/snippets:");
    templatesAndSections.slice(0, 30).forEach(a => console.log(`- ${a.key}`));

  } catch (err) {
    console.error(err.message);
    if (err.response) {
      console.error(JSON.stringify(err.response.data));
    }
  }
}

main();
