const axios = require('axios');
const token = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const waba = '2025586748064434';

async function list() {
  try {
    const res = await axios.get(`https://graph.facebook.com/v21.0/${waba}/message_templates?fields=name,status&limit=100`, {headers: {Authorization: `Bearer ${token}`}});
    console.log(res.data.data.map(t => t.name).join(', '));
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}
list();
