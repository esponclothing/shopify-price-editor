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

    const assetKey = 'assets/whatsapp-checkout.js';
    const assetRes = await axios.get(`https://${storeUrl}/admin/api/2024-04/themes/${themeId}/assets.json?asset[key]=${assetKey}`, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });

    fs.writeFileSync('scratch/whatsapp-checkout.js', assetRes.data.asset.value);
    console.log(`Saved ${assetKey} to scratch/whatsapp-checkout.js`);
  } catch (err) {
    console.error(err.message);
  }
}

main();
