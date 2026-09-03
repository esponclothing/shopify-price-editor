const pg = require('pg');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xkiukbebnntjzfilyfmh.supabase.co';
const DB_URL = 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres';

const client = new pg.Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

const getCustomersForSegment = async (seg) => {
  if (seg === 'abandoned_carts_30_days' || seg === 'signed_up_not_ordered') {
    const client2 = new pg.Client({
      connectionString: 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit@202612@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
      ssl: { rejectUnauthorized: false }
    });
    await client2.connect();
    try {
      const cRes = await client2.query(`SELECT phone FROM checkout_sessions WHERE status = 'abandoned' AND created_at > NOW() - INTERVAL '30 days'`);
      
      let customers = cRes.rows.map(r => {
        const num = String(r.phone || '').replace(/\D/g, '');
        if (num.length >= 10) return {
          phone_last10: num.slice(-10),
          name: 'Customer',
          customer_name: 'Customer',
          order_number: 'Cart',
          tracking_url: ''
        };
        return null;
      }).filter(Boolean);

      const unique = [];
      const seen = new Set();
      for(let c of customers) {
        if(!seen.has(c.phone_last10)) {
          seen.add(c.phone_last10);
          unique.push(c);
        }
      }
      customers = unique;

      if (seg === 'signed_up_not_ordered') {
        const orderedRes = await client.query('SELECT DISTINCT phone_last10 FROM shopify_orders WHERE phone_last10 IS NOT NULL');
        const orderedPhones = new Set(orderedRes.rows.map(r => r.phone_last10));
        customers = customers.filter(c => !orderedPhones.has(c.phone_last10));
      }

      return customers;
    } finally {
      await client2.end();
    }
  }
}

(async () => {
  await client.connect();
  try {
    const res = await getCustomersForSegment('signed_up_not_ordered');
    console.log('Success, length:', res.length);
  } catch(e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
})();
