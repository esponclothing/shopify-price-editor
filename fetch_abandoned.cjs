const https = require('https');

const STORE = 'i2tu0d-jc.myshopify.com';
const TOKEN = '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';
const VERSION = '2024-01';

const options = {
  hostname: STORE,
  path: `/admin/api/${VERSION}/checkouts.json?limit=250`,
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
      if (parsed.errors) {
        console.error("API Error:", parsed.errors);
        return;
      }
      
      const checkouts = parsed.checkouts || [];
      const output = [];
      
      checkouts.forEach(c => {
        if (!c.email) return; // Only process those with emails
        
        const items = c.line_items.map(item => `${item.quantity}x ${item.title} (${item.variant_title || 'Default'})`).join(', ');
        
        output.push(`Email: ${c.email}`);
        output.push(`Items Left: ${items}`);
        output.push(`Checkout Link: ${c.abandoned_checkout_url}`);
        output.push(`----------------------------------------`);
      });
      
      console.log(`Found ${output.length / 4} abandoned checkouts with emails.\n\n`);
      console.log(output.join('\n'));
      
    } catch (e) {
      console.error("Parse Error:", e.message);
    }
  });
});

req.on('error', (e) => {
  console.error("Request Error:", e);
});

req.end();
