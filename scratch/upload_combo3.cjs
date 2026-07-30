const axios = require('axios');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
const storeUrl = envContent.match(/VITE_SHOPIFY_STORE_URL=(.*)/)?.[1]?.trim();
const accessToken = envContent.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)?.[1]?.trim();

const themeFile = path.join(__dirname, '../../11fit theme/templates/product.combo-3.json');
const sectionFile = path.join(__dirname, '../../11fit theme/sections/main-combo-3.liquid');
const globalJsFile = path.join(__dirname, '../../11fit theme/assets/global.js');

async function uploadAsset(themeId, key, filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const url = `https://${storeUrl}/admin/api/2024-04/themes/${themeId}/assets.json`;
    
    const response = await axios.put(url, {
      asset: {
        key: key,
        value: content
      }
    }, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Successfully uploaded ${key} to theme ${themeId}`);
    return true;
  } catch (err) {
    console.error(`Error uploading ${key}:`, err.message);
    if (err.response) {
      console.error(JSON.stringify(err.response.data));
    }
    return false;
  }
}

async function main() {
  try {
    console.log(`Fetching themes from ${storeUrl}...`);
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
    
    const themes = res.data.data.themes.edges;
    console.log("Found themes:");
    themes.forEach(t => console.log(`- [${t.node.role}] ${t.node.name} (ID: ${t.node.id})`));
    
    const mainTheme = themes.find(e => e.node.role === 'MAIN')?.node;
    if (!mainTheme) {
      console.error("Could not find the MAIN (active) theme.");
      return;
    }
    
    const themeId = mainTheme.id.split('/').pop();
    console.log(`\nActive Theme ID to upload is: ${themeId}`);
    
    // Upload all files
    await uploadAsset(themeId, 'templates/product.combo-3.json', themeFile);
    await uploadAsset(themeId, 'sections/main-combo-3.liquid', sectionFile);
    await uploadAsset(themeId, 'assets/global.js', globalJsFile);
    
  } catch (err) {
    console.error("Main execution failed:", err.message);
    if (err.response) {
      console.error(JSON.stringify(err.response.data));
    }
  }
}

main();
