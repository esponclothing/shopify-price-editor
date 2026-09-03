// run_create_returns.cjs  — direct pg migration (no @supabase/supabase-js needed)
const { Client } = require('pg');

const dbUrl = 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await client.connect();
  console.log('Connected to Supabase Postgres...');

  const sql = `
    CREATE TABLE IF NOT EXISTS return_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),

      -- Customer info
      phone TEXT NOT NULL,
      customer_name TEXT,
      email TEXT,
      device_id TEXT,

      -- Order info
      order_id TEXT NOT NULL,
      order_name TEXT NOT NULL,
      order_date TIMESTAMPTZ,

      -- Line item info
      line_item_id TEXT NOT NULL,
      product_title TEXT NOT NULL,
      variant_title TEXT,
      sku TEXT,
      quantity INTEGER DEFAULT 1,
      item_price NUMERIC(10,2),
      image_url TEXT,

      -- Request details
      request_type TEXT NOT NULL CHECK (request_type IN ('return', 'exchange')),
      reason TEXT NOT NULL,
      reason_detail TEXT,
      exchange_size TEXT,
      exchange_product_id TEXT,

      -- Photo proof (auto-deleted after 30 days)
      photo_url TEXT,
      photo_expires_at TIMESTAMPTZ,

      -- Status lifecycle
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected','pickup_scheduled',
                          'in_transit','received','completed','cancelled')),
      admin_note TEXT,
      refund_method TEXT DEFAULT 'store_credit',

      -- Return tracking
      return_tracking_number TEXT,
      return_tracking_company TEXT,
      return_tracking_url TEXT,

      -- Exchange dispatch tracking
      exchange_tracking_number TEXT,
      exchange_tracking_company TEXT,
      exchange_tracking_url TEXT,

      -- Stage timestamps
      approved_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      pickup_at TIMESTAMPTZ,
      received_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,

      -- Multi-merchant
      store TEXT DEFAULT 'i2tu0d-jc.myshopify.com',
      merchant_key TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_return_requests_phone ON return_requests(phone);
    CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests(order_id);
    CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);
    CREATE INDEX IF NOT EXISTS idx_return_requests_created_at ON return_requests(created_at DESC);
  `;

  await client.query(sql);
  console.log('✅  return_requests table + indices created!');

  // Verify
  const check = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='return_requests' ORDER BY ordinal_position`);
  console.log('Columns:', check.rows.map(r => r.column_name).join(', '));

  await client.end();
}

run().catch(err => { console.error('Migration failed:', err.message); process.exit(1); });
