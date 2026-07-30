const axios = require('axios');

const TOKEN = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const WABA_ID = '2025586748064434';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

// Submit order_delivered as a new template with UTILITY category and a new name
const newTemplate = {
  name: 'order_delivered_utility_v1',
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
      text: 'Hi {{1}}, your 11FIT order {{2}} has been successfully delivered! 🎯\n\nThank you for being part of the 11FIT family! We hope you love the fit, drop-shoulder cut, and premium 4-way stretch quality.\n\n🔥 UPGRADE YOUR WARDROBE!\nWe just launched our newest Drop-Shoulder Oversized Tees and Activewear Combo Deals! Grab 2 or 3 tees together at an exclusive discounted price.\n\nTap below to explore our hottest combo packs and new arrivals!',
      example: {
        body_text: [ [ 'Rahul', '#1129' ] ]
      }
    },
    {
      type: 'FOOTER',
      text: '11FIT Activewear • Built For Performance'
    },
    {
      type: 'BUTTONS',
      buttons: [
        {
          type: 'URL',
          text: 'Explore Combo Deals',
          url: 'https://11fit.in/collections/combos'
        },
        {
          type: 'URL',
          text: 'Shop New Arrivals',
          url: 'https://11fit.in/collections/new-arrivals'
        }
      ]
    }
  ]
};

async function run() {
  console.log('📤 Submitting order_delivered_utility_v1 as UTILITY...');
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates`,
      newTemplate,
      { headers }
    );
    console.log(`\n✅ SUCCESS!`);
    console.log(`   Name:     order_delivered_utility_v1`);
    console.log(`   ID:       ${res.data.id}`);
    console.log(`   Category: UTILITY`);
    console.log(`   Status:   ${res.data.status || 'PENDING'}`);
    console.log(`\n⏳ Meta will review and approve within 1–15 minutes.`);
  } catch (err) {
    const metaErr = err.response?.data?.error?.error_user_msg || err.response?.data?.error?.message || err.message;
    console.error(`\n❌ FAILED: ${metaErr}`);
    if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  }
}

run();
