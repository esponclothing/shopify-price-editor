const axios = require('axios');

const TOKEN = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const WABA_ID = '2025586748064434';

async function testDelete() {
  try {
    console.log('Testing DELETE template with name: hello_world');
    const res = await axios.delete(
      `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?name=hello_world`,
      { headers: { 'Authorization': `Bearer ${TOKEN}` } }
    );
    console.log('SUCCESS DELETE:', res.data);
  } catch (err) {
    console.error('ERROR status:', err.response?.status);
    console.error('ERROR data:', JSON.stringify(err.response?.data, null, 2));
  }
}

testDelete();
