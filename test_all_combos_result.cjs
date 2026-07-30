const axios = require('axios');

const SHOPIFY_STORE_URL = 'i2tu0d-jc.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = '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';

function extractProductKeyword(text) {
  if (/combo|trio|pack|offer|deal|discount/i.test(text)) {
    if (!/short|oversize|t\-?i?shirt|shirt|tee|pant|track/i.test(text)) {
      return '';
    }
  }
  const terms = [];
  if (/short/i.test(text)) terms.push('shorts');
  if (/oversize|t\-?i?shirt|shirt|tee/i.test(text)) terms.push('shirt');
  if (/pant|track|lower|trouser/i.test(text)) terms.push('pant');
  return terms.join(' ');
}

async function searchProducts(userText) {
  const cleanKeyword = extractProductKeyword(userText);
  const isComboSearch = /combo|trio|pack|offer|deal|discount/i.test(userText);
  const query = `
    query SearchProducts($query: String!) {
      products(first: 50, query: $query) {
        edges {
          node {
            title
            handle
            variants(first: 1) {
              edges {
                node { price }
              }
            }
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
      { query, variables: { query: `status:active ${cleanKeyword}` } },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    let edges = res.data?.data?.products?.edges || [];

    edges.sort((a, b) => {
      const aCombo = a.node.combo_config ? (() => { try { return JSON.parse(a.node.combo_config.value); } catch(_) { return null; } })() : null;
      const bCombo = b.node.combo_config ? (() => { try { return JSON.parse(b.node.combo_config.value); } catch(_) { return null; } })() : null;
      const aHasCombo = aCombo && Number(aCombo.count) > 0 && Number(aCombo.price) > 0 ? 1 : 0;
      const bHasCombo = bCombo && Number(bCombo.count) > 0 && Number(bCombo.price) > 0 ? 1 : 0;
      if (isComboSearch || aHasCombo !== bHasCombo) {
        return bHasCombo - aHasCombo; // Combo products first
      }
      return 0;
    });

    return edges.slice(0, 6).map(e => {
      const p = e.node;
      const singlePrice = p.variants.edges[0]?.node?.price || 'N/A';
      let combo = null;
      try {
        if (p.combo_config) combo = JSON.parse(p.combo_config.value);
      } catch (_) {}
      
      let comboLine = '';
      if (combo && Number(combo.count) > 0 && Number(combo.price) > 0) {
        comboLine = ` | *Combo Offer:* Pack of ${combo.count} @ *₹${combo.price}*`;
      }

      return `👕 *${p.title}*\n💰 *Single:* ₹${singlePrice}${comboLine}\n🔗 *Buy Now:* https://11fit.in/products/${p.handle}`;
    });
  } catch (err) {
    return { error: err.message };
  }
}

async function run() {
  console.log('=== TEST 1: "all combos you have" ===');
  const r1 = await searchProducts('all combos you have');
  r1.forEach(l => console.log(l, '\n'));

  console.log('=== TEST 2: "t-shirts combo" ===');
  const r2 = await searchProducts('t-shirts combo');
  r2.forEach(l => console.log(l, '\n'));
}

run();
