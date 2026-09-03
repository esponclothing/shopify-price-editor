const axios = require('axios');
const META_TOKEN = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const PHONE_NUMBER_ID = '1189183190949431';

async function run() {
  const phone = '919306817689';
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'template',
    template: {
      name: 'abandoned_cart_v4',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Tinkal' },
            { type: 'text', text: '699' }
          ]
        }
      ]
    }
  };

  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${META_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ SUCCESS without button parameter!', res.data);
  } catch (err) {
    console.log('❌ Error without button parameter:', JSON.stringify(err.response?.data, null, 2));
  }
}

run();
