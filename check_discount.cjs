const a = require('./node_modules/axios/dist/node/axios.cjs');
// I need the Shopify token, but I don't have it easily available in the command line env without reading .env
// Let me read .env manually
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const tokenMatch = env.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/);
const token = tokenMatch ? tokenMatch[1].trim() : '';

a.get('https://i2tu0d-jc.myshopify.com/admin/api/2024-10/price_rules.json', {
  headers: { 'X-Shopify-Access-Token': token }
}).then(async r => {
  const rules = r.data.price_rules.filter(x => x.title.includes('15824217604177'));
  if (rules.length === 0) console.log('No price rules found for this product id');
  
  for (let p of rules) {
    console.log('Rule:', p.title, 'ID:', p.id);
    try {
      const c = await a.get(`https://i2tu0d-jc.myshopify.com/admin/api/2024-10/price_rules/${p.id}/discount_codes.json`, {
        headers: { 'X-Shopify-Access-Token': token }
      });
      console.log('  Codes:', c.data.discount_codes.map(x => x.code));
    } catch (e) {
      console.log('  Error fetching codes:', e.message);
    }
  }
}).catch(e => console.log(e.message));
