const axios = require('axios');
const fs = require('fs');

// Read storeUrl and accessToken from .env manually to avoid dotenv dependency
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

    const assetsRes = await axios.get(`https://${storeUrl}/admin/api/2024-04/themes/${themeId}/assets.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    
    const assets = assetsRes.data.assets;
    console.log(`Total Assets: ${assets.length}`);

    const relevantAssets = assets.filter(a => 
      a.key.includes('subcat') || 
      a.key.includes('pill') || 
      a.key.includes('collection') || 
      a.key.includes('product-grid')
    );
    console.log("Found relevant assets:");
    relevantAssets.forEach(a => console.log(`- ${a.key}`));

    console.log("\nSample sections/snippets:");
    const templatesAndSections = assets.filter(a => a.key.startsWith('sections/') || a.key.startsWith('snippets/'));
    templatesAndSections.slice(0, 40).forEach(a => console.log(`- ${a.key}`));

  } catch (err) {
    console.error(err.message);
  }
}

main();
