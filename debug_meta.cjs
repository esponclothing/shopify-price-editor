require('dotenv').config();
const handler = require('./api/shopify-webhook.js').default;
const axios = require('axios');

async function run() {
  const url = 'https://i2tu0d-jc.myshopify.com/admin/api/2024-01/orders/12798858526801.json';
  const res = await axios.get(url, { headers: { 'X-Shopify-Access-Token': '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' } });
  
  const req = { method: 'POST', body: res.data.order };
  const resObj = { status: (c) => ({ json: (d) => console.log(c, d) }) };
  
  const origFetch = global.fetch;
  global.fetch = async (...args) => {
    const r = await origFetch(...args);
    if (typeof args[0] === 'string' && args[0].includes('facebook.com')) {
      const clone = r.clone();
      console.log('META RES:', await clone.text());
    }
    return r;
  };
  
  await handler(req, resObj);
}

run().catch(console.error);
