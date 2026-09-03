const axios = require('axios');

const TOKEN = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const WABA_ID = '2025586748064434';

const template = {
  name: 'abandoned_cart_v2',
  category: 'MARKETING',
  language: 'en_US',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'YOUR 11FIT CART IS WAITING'
    },
    {
      type: 'BODY',
      text: 'Hey {{1}}, you left something awesome in your cart! 🔥\n\nWe noticed your activewear items are still waiting for you. High-demand oversized tees and drop-shoulder apparel sell out fast—secure yours before stock runs out!\n\n💰 Cart Value: ₹{{2}}\n⚡ EXTRA SAVINGS: Get an instant 5% EXTRA OFF when you choose Prepaid payment at checkout!\n\nTap below to complete your order or check our size guide.',
      example: {
        body_text: [ ['Aman', '1,499'] ]
      }
    },
    {
      type: 'FOOTER',
      text: '11FIT Activewear • Premium Fit & Fabric'
    },
    {
      type: 'BUTTONS',
      buttons: [
        {
          type: 'URL',
          text: 'Complete Your Order',
          url: 'https://11fit.in/cart'
        },
        {
          type: 'URL',
          text: 'Size Guide',
          url: 'https://11fit.in/pages/size-guide'
        }
      ]
    }
  ]
};

async function updateTemplate() {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v19.0/${WABA_ID}/message_templates`,
      template,
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Template updated successfully:', res.data);
  } catch (err) {
    console.error('❌ Error updating template:', err.response?.data || err.message);
  }
}

updateTemplate();
