const axios = require('axios');
require('dotenv').config();

const store = process.env.VITE_SHOPIFY_STORE_URL.replace('https://', '');
const token = process.env.VITE_SHOPIFY_ACCESS_TOKEN;

async function testThemes() {
  try {
    const query = `
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
    const res = await axios({
      method: 'POST',
      url: `https://${store}/admin/api/2024-04/graphql.json`,
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      },
      data: { query }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}
testThemes();
