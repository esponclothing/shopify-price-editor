const axios = require('axios');

const SHOPIFY_STORE_URL = 'i2tu0d-jc.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = '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';

async function checkAllCombos() {
  const query = `
    query {
      products(first: 250, query: "status:active") {
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
    console.log('TOTAL ACTIVE PRODUCTS IN STORE:', edges.length);
    let comboCount = 0;
    edges.forEach((e, idx) => {
      const p = e.node;
      let combo = null;
      try {
        if (p.combo_config) combo = JSON.parse(p.combo_config.value);
      } catch (_) {}
      if (combo && Number(combo.count) > 0 && Number(combo.price) > 0) {
        comboCount++;
        console.log(`[COMBO #${comboCount}] Index ${idx}: "${p.title}" => Pack of ${combo.count} @ Rs ${combo.price}`);
      }
    });
    if (comboCount === 0) {
      console.log('NO products found with count > 0 and price > 0 in combo_config!');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkAllCombos();
