const axios = require('axios');
const SHOPIFY_STORE_URL = 'i2tu0d-jc.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = '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';

async function run() {
  const res = await axios.get(
    `https://${SHOPIFY_STORE_URL}/admin/api/2024-04/orders.json?status=any&limit=10`,
    { headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN } }
  );

  const orders = res.data.orders;
  for (const o of orders) {
    console.log(`Order ${o.name}: fulfillment_status=${o.fulfillment_status}, financial_status=${o.financial_status}, tags=${o.tags}`);
    if (o.fulfillments && o.fulfillments.length > 0) {
      console.log(`  Shipment status: ${o.fulfillments[0].shipment_status}`);
    }
    console.log(`  Return status: ${o.return_status || 'none'}`);
  }
}
run();
