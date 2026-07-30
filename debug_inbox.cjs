require('dotenv').config();
const handler = require('./api/whatsapp-inbox.js').default;
const axios = require('axios');

async function run() {
  const req = { 
    method: 'POST', 
    body: { 
      action: 'send_template', 
      phone: '+919306817689', 
      template_name: 'order_shipped_v1', 
      template_params: ['Nitin', '#1163', 'Other', '371309065411'] 
    } 
  };
  
  const res = { 
    setHeader: () => {}, 
    status: (c) => ({ json: (d) => console.log(c, d) }),
    json: (d) => console.log(200, d)
  };
  
  const origFetch = global.fetch;
  global.fetch = async (...args) => {
    const r = await origFetch(...args);
    if (typeof args[0] === 'string' && args[0].includes('facebook.com')) {
      const clone = r.clone();
      console.log('META RES:', await clone.text());
    }
    return r;
  };
  
  await handler(req, res);
}

run().catch(console.error);
