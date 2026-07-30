const axios = require('axios');
const fs = require('fs');
const token = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const waba = '2025586748064434';
axios.get(`https://graph.facebook.com/v21.0/${waba}/message_templates?fields=name,status,components&limit=100`, {headers: {Authorization: `Bearer ${token}`}})
  .then(res => fs.writeFileSync('templates_dump.json', JSON.stringify(res.data.data, null, 2)))
  .catch(err => console.error(err.message));
