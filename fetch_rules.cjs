const https = require('https');

const STORE = 'i2tu0d-jc.myshopify.com';
const TOKEN = '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';
const VERSION = '2024-01';

const options = {
  hostname: STORE,
  path: `/admin/api/${VERSION}/price_rules.json`,
  method: 'GET',
  headers: {
    'X-Shopify-Access-Token': TOKEN,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const rules = parsed.price_rules || [];
      const activeRules = rules.map(r => ({
        title: r.title,
        value: r.value,
        type: r.value_type,
        target_type: r.target_type,
        allocation_method: r.allocation_method
      }));
      console.log(JSON.stringify(activeRules, null, 2));
    } catch (e) {
      console.error(e);
    }
  });
});

req.end();
