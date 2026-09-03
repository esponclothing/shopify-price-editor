const axios = require('axios');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const storeUrl = envContent.match(/VITE_SHOPIFY_STORE_URL=(.*)/)?.[1]?.trim();
const accessToken = envContent.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)?.[1]?.trim();

async function main() {
  try {
    const query = `
      query {
        webPixelAppExtensions(first: 10) {
          edges {
            node {
              id
            }
          }
        }
      }
    `;
    const res = await axios.post(`https://${storeUrl}/admin/api/2024-04/graphql.json`, { query }, {
      headers: { 'X-Shopify-Access-Token': accessToken }
    });
    console.log("Web Pixels:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.response ? JSON.stringify(err.response.data) : err.message);
  }
}
main();
