const axios = require('axios');

const TOKEN = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const WABA_ID = '2025586748064434';
const TEMPLATE_NAME = 'order_delivered_utility_v1';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

// UTILITY-compliant body — strictly transactional, no promotions
// Meta auto-classifies as MARKETING if you mention discounts, new products, combos etc.
const newTemplate = {
  name: TEMPLATE_NAME,
  category: 'UTILITY',
  language: 'en_US',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'ORDER DELIVERED'
    },
    {
      type: 'BODY',
      // Purely transactional: delivery confirmation + support offer only. 
      // NO promotions, NO combo deals, NO new arrivals mentions.
      text: 'Hi {{1}}, great news! Your 11FIT order {{2}} has been successfully delivered.\n\nWe hope you love your new activewear! If you have any questions about sizing, the product, or anything else, just reply here and our team will be happy to help.\n\nThank you for shopping with 11FIT! 🙌',
      example: {
        body_text: [ ['Rahul', '#1129'] ]
      }
    },
    {
      type: 'FOOTER',
      text: '11FIT Activewear • Support: support@11fit.com'
    }
  ]
};

async function run() {
  // Step 1: Find & delete existing version
  console.log(`\n🔍 Finding existing "${TEMPLATE_NAME}"...`);
  const listRes = await axios.get(
    `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?name=${TEMPLATE_NAME}&limit=5`,
    { headers }
  );
  const templates = listRes.data?.data || [];

  for (const tpl of templates) {
    console.log(`   Found: ID=${tpl.id}, Category=${tpl.category}, Status=${tpl.status}`);
    try {
      await axios.delete(
        `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?hsm_id=${tpl.id}&name=${TEMPLATE_NAME}`,
        { headers }
      );
      console.log(`   ✅ Deleted ID ${tpl.id}`);
    } catch (err) {
      console.log(`   ⚠️  Delete failed: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  if (templates.length === 0) {
    console.log('   (No existing template found, going straight to create)');
  }

  // Step 2: Wait
  console.log('\n⏳ Waiting 4 seconds before resubmitting...');
  await new Promise(r => setTimeout(r, 4000));

  // Step 3: Resubmit as UTILITY with clean transactional content
  console.log(`📤 Submitting "${TEMPLATE_NAME}" as UTILITY (transactional body)...`);
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates`,
      newTemplate,
      { headers }
    );
    console.log(`\n✅ SUCCESS!`);
    console.log(`   ID:       ${res.data.id}`);
    console.log(`   Category: ${res.data.category || 'UTILITY'}`);
    console.log(`   Status:   ${res.data.status || 'PENDING'}`);
    console.log(`\n⏳ Meta will review — should approve within 1-15 min.`);
    console.log(`   With a purely transactional body, Meta MUST classify this as UTILITY.`);
  } catch (err) {
    const metaErr = err.response?.data?.error?.error_user_msg || err.response?.data?.error?.message || err.message;
    console.error(`\n❌ FAILED: ${metaErr}`);
    if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  }
}

run();
