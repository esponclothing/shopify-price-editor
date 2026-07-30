const axios = require('axios');
const { Client } = require('pg');

const SHOPIFY_STORE_URL = 'i2tu0d-jc.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = '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';

const client = new Client({
  connectionString: 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

function extractPhoneLast10s(order) {
  const phones = [
    order.phone,
    order.customer?.phone,
    order.shipping_address?.phone,
    order.billing_address?.phone
  ];
  const uniqueLast10s = [];
  phones.forEach(p => {
    if (!p) return;
    const clean = p.toString().replace(/\D/g, '');
    if (clean.length >= 10) {
      const last10 = clean.slice(-10);
      if (!uniqueLast10s.includes(last10)) {
        uniqueLast10s.push(last10);
      }
    }
  });
  return {
    phone_last10: uniqueLast10s[0] || null,
    alt_phone_last10: uniqueLast10s[1] || null
  };
}

async function run() {
  await client.connect();
  console.log('Connected to Postgres...');

  console.log('Fetching all orders from Shopify...');
  const res = await axios.get(
    `https://${SHOPIFY_STORE_URL}/admin/api/2024-04/orders.json?status=any&limit=250`,
    { headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN } }
  );

  const orders = res.data?.orders || [];
  console.log(`Fetched ${orders.length} orders from Shopify store.`);

  let upserted = 0;
  for (const o of orders) {
    const { phone_last10, alt_phone_last10 } = extractPhoneLast10s(o);
    const customer_name = o.shipping_address
      ? `${o.shipping_address.first_name || ''} ${o.shipping_address.last_name || ''}`.trim()
      : (o.customer ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim() : null);

    const fulfillment = (o.fulfillments && o.fulfillments.length > 0) ? o.fulfillments[0] : null;
    const tracking_number = fulfillment?.tracking_number || null;
    const tracking_company = fulfillment?.tracking_company || null;
    const tracking_url = fulfillment?.tracking_url || (fulfillment?.tracking_urls && fulfillment.tracking_urls[0]) || null;

    await client.query(`
      INSERT INTO shopify_orders (
        id, order_number, name, phone_last10, alt_phone_last10, customer_name,
        total_price, fulfillment_status, cancelled_at, tracking_number,
        tracking_company, tracking_url, order_data, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (id) DO UPDATE SET
        order_number = EXCLUDED.order_number,
        name = EXCLUDED.name,
        phone_last10 = EXCLUDED.phone_last10,
        alt_phone_last10 = EXCLUDED.alt_phone_last10,
        customer_name = EXCLUDED.customer_name,
        total_price = EXCLUDED.total_price,
        fulfillment_status = EXCLUDED.fulfillment_status,
        cancelled_at = EXCLUDED.cancelled_at,
        tracking_number = EXCLUDED.tracking_number,
        tracking_company = EXCLUDED.tracking_company,
        tracking_url = EXCLUDED.tracking_url,
        order_data = EXCLUDED.order_data,
        updated_at = NOW();
    `, [
      o.id,
      o.order_number,
      o.name || `#${o.order_number}`,
      phone_last10,
      alt_phone_last10,
      customer_name,
      o.total_price || 0,
      o.fulfillment_status || null,
      o.cancelled_at || null,
      tracking_number,
      tracking_company,
      tracking_url,
      JSON.stringify(o),
      o.created_at || new Date().toISOString()
    ]);
    upserted++;
  }

  console.log(`Successfully synced ${upserted} orders into Supabase shopify_orders table!`);

  // Verify by querying for Yateen Chandarana (#1139 -> 9833264430)
  const testRes = await client.query(
    `SELECT name, phone_last10, alt_phone_last10, customer_name, total_price, fulfillment_status FROM shopify_orders WHERE phone_last10 = '9833264430' OR alt_phone_last10 = '9833264430'`
  );
  console.log('Test query from DB for 9833264430:', testRes.rows);

  await client.end();
}

run().catch(e => { console.error('ERROR:', e.message); client.end(); });
