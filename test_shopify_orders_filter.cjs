const axios = require('axios');
const https = require('https');
require('dotenv').config();

const shopifyStore = process.env.VITE_SHOPIFY_STORE_URL || process.env.SHOPIFY_STORE_URL || 'esponclothing.myshopify.com';
const shopifyToken = process.env.VITE_SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN || '';

const get10Digit = (ph) => {
  const s = String(ph || '').replace(/\D/g, '');
  return s.length >= 10 ? s.slice(-10) : s;
};

async function testFilter() {
  try {
    console.log('Fetching orders from:', shopifyStore);
    const res = await axios.get(`https://${shopifyStore}/admin/api/2024-04/orders.json?status=any&limit=100`, {
      headers: {
        'X-Shopify-Access-Token': shopifyToken.trim(),
        'Content-Type': 'application/json'
      },
      httpsAgent: new https.Agent({ family: 4, keepAlive: true })
    });
    const orders = res.data?.orders || [];
    console.log('Total orders fetched:', orders.length);

    const orderPhones = new Set();
    orders.forEach(o => {
      const phs = [
        o.phone,
        o.customer?.phone,
        o.customer?.default_address?.phone,
        o.shipping_address?.phone,
        o.billing_address?.phone
      ];
      phs.forEach(p => {
        const p10 = get10Digit(p);
        if (p10 && p10.length >= 10) orderPhones.add(p10);
      });
    });

    console.log('Total unique phone numbers with an order:', orderPhones.size);

    const testPhones = ['9176689256', '9567678088', '9686400443'];
    testPhones.forEach(p => {
      console.log(`Did ${p} place an order?`, orderPhones.has(p));
    });

  } catch (err) {
    console.error('Error fetching orders:', err.message);
  }
}

testFilter();
