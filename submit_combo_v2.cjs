const axios = require('axios');

const TOKEN = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const WABA_ID = '2025586748064434';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

const newTemplate = {
  name: 'combo_offer_reengage_v2',
  category: 'MARKETING',
  language: 'en_US',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'SPECIAL 11FIT OFFER'
    },
    {
      type: 'BODY',
      text: 'Hi {{1}}, we miss you! 🖤\n\nUpgrade your activewear wardrobe today with our exclusive Combo Deals. Buy more, save more!\n\nShop now before the stock runs out! 🏃‍♂️',
      example: {
        body_text: [ ['Rahul'] ]
      }
    },
    {
      type: 'FOOTER',
      text: '11FIT Activewear • Premium Quality'
    },
    {
      type: 'BUTTONS',
      buttons: [
        {
          type: 'URL',
          text: 'Shop All Combos',
          url: 'https://11fit.in/collections/all'
        }
      ]
    }
  ]
};

async function run() {
  console.log(`📤 Submitting "${newTemplate.name}" as MARKETING...`);
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates`,
      newTemplate,
      { headers }
    );
    console.log(`\n✅ SUCCESS! ID: ${res.data.id}`);
  } catch (err) {
    console.error(`\n❌ FAILED:`, err.response?.data?.error || err.message);
  }
}

run();
