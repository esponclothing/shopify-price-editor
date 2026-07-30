const axios = require('axios');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)[1].trim();
const store = env.match(/VITE_SHOPIFY_STORE_URL=(.*)/)[1].trim().replace('https://', '');

async function testQuery() {
  const query = `
    query {
      themes(first: 10) {
        edges {
          node {
            id
            role
            files(first: 1, filenames: ["config/settings_data.json"]) {
              nodes {
                body {
                  ... on OnlineStoreThemeFileBodyText {
                    content
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  try {
    const res = await axios.post(`https://${store}/admin/api/2024-04/graphql.json`, { query }, {
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}
testQuery();
