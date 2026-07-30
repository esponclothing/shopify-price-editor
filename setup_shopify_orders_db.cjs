const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to Postgres...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS shopify_orders (
      id BIGINT PRIMARY KEY,
      order_number INT,
      name TEXT,
      phone_last10 TEXT,
      alt_phone_last10 TEXT,
      customer_name TEXT,
      total_price NUMERIC,
      fulfillment_status TEXT,
      cancelled_at TIMESTAMPTZ,
      tracking_number TEXT,
      tracking_company TEXT,
      tracking_url TEXT,
      order_data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('Table shopify_orders created or verified!');

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_shopify_orders_phone_last10 ON shopify_orders (phone_last10);
    CREATE INDEX IF NOT EXISTS idx_shopify_orders_alt_phone_last10 ON shopify_orders (alt_phone_last10);
    CREATE INDEX IF NOT EXISTS idx_shopify_orders_created_at ON shopify_orders (created_at DESC);
  `);
  console.log('Indexes created or verified!');

  await client.query(`ALTER TABLE shopify_orders DISABLE ROW LEVEL SECURITY;`);
  console.log('RLS disabled on shopify_orders!');

  await client.end();
}

run().catch(e => { console.error('ERROR:', e.message); client.end(); });
