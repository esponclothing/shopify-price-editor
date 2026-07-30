const axios = require('axios');
const token = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const WA_PHONE_ID = '1189183190949431';
const to = '919500095000'; // arbitrary, just to check meta error

axios.post(
  `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`,
  {
    messaging_product: 'whatsapp',
    to: to,
    type: 'template',
    template: {
      name: 'order_confirmed_v2',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Rahul' },
            { type: 'text', text: '#1129' },
            { type: 'text', text: 'Items' },
            { type: 'text', text: 'COD' },
            { type: 'text', text: 'Address' }
          ]
        },
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: '0',
          parameters: [
            { type: 'payload', payload: 'track_order' }
          ]
        }
      ]
    }
  },
  { headers: { Authorization: `Bearer ${token}` } }
).then(r => console.log('Success'))
 .catch(err => console.log(JSON.stringify(err.response?.data)));
