const axios = require('axios');

const NEW_TOKEN = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const WABA_ID = '2025586748064434';

async function test() {
  try {
    console.log('Testing Meta Graph API with NEW token for WABA ID:', WABA_ID);
    const res = await axios.get(
      `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?fields=name,status,language,category,components,id&limit=5`,
      { headers: { 'Authorization': `Bearer ${NEW_TOKEN}` } }
    );
    console.log('SUCCESS!! Templates count found:', res.data?.data?.length);
    console.log('Template names:', res.data?.data?.map(t => t.name));
  } catch (err) {
    console.error('Meta API ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

test();
