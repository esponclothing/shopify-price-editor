const axios = require('axios');

const TOKEN = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const WABA_ID = '2025586748064434';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

// Use a COMPLETELY different name since Meta blocks category change on this name for 4 weeks
const newTemplate = {
  name: 'order_delivered_confirm_v1',  // fresh name, no history
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
      // Strictly transactional: only delivery confirmation + support. No products, no combos.
      text: 'Hi {{1}}, your 11FIT order {{2}} has been delivered successfully.\n\nWe hope you are happy with your purchase! If you have any questions, issues, or need help with sizing or the product, just reply to this message and our support team will assist you right away.\n\nThank you for shopping with 11FIT. We appreciate your trust! 🙌',
      example: {
        body_text: [ ['Rahul', '#1129'] ]
      }
    },
    {
      type: 'FOOTER',
      text: '11FIT Activewear • support@11fit.com'
    }
  ]
};

async function run() {
  console.log(`📤 Submitting "${newTemplate.name}" as UTILITY with purely transactional body...`);
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates`,
      newTemplate,
      { headers }
    );
    console.log(`\n✅ SUCCESS!`);
    console.log(`   Name:     ${newTemplate.name}`);
    console.log(`   ID:       ${res.data.id}`);
    console.log(`   Category: ${res.data.category}`);
    console.log(`   Status:   ${res.data.status || 'PENDING'}`);
    console.log(`\nMeta should approve this as UTILITY since body is purely transactional.`);
  } catch (err) {
    const metaErr = err.response?.data?.error?.error_user_msg || err.response?.data?.error?.message || err.message;
    console.error(`\n❌ FAILED: ${metaErr}`);
    if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  }
}

run();
