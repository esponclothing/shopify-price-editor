const axios = require('axios');

const SHOPIFY_STORE_URL = 'i2tu0d-jc.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = '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';

async function testTcombo() {
  const query = `
    query {
      products(first: 50, query: "status:active oversized") {
        edges {
          node {
            title
            handle
            combo_config: metafield(namespace: "price_editor", key: "combo_config") {
              value
            }
          }
        }
      }
    }
  `;
  try {
    const res = await axios.post(
      `https://${SHOPIFY_STORE_URL}/admin/api/2024-10/graphql.json`,
      { query },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    const edges = res.data?.data?.products?.edges || [];
    console.log('OVERSIZED MATCH COUNT:', edges.length);
    edges.forEach(e => console.log('-', e.node.title, '=>', e.node.combo_config?.value));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testTcombo();
