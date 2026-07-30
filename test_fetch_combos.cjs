const axios = require('axios');

const SHOPIFY_STORE_URL = 'i2tu0d-jc.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = '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';

async function fetchCombos() {
  try {
    const res = await axios.get(
      `https://${SHOPIFY_STORE_URL}/admin/api/2024-04/price_rules.json`,
      { headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN } }
    );
    const rules = res.data?.price_rules || [];
    console.log('Total Price Rules:', rules.length);
    const comboRules = rules.filter(r => r.title.startsWith('COMBO_PR_'));
    console.log('Combo Rules found:', comboRules.length);
    comboRules.forEach(r => {
      console.log('->', r.title, '| Value:', r.value, '| Entitled IDs:', r.entitled_product_ids, '| Quantity:', r.prerequisite_quantity_range);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

fetchCombos();
