require('dotenv').config();
const { Client } = require('pg');

async function fixTable() {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:zXuyDwmBoMwdHnUqoFMUIkkKILuEcaas@reseau.proxy.rlwy.net:12168/railway';
  const client = new Client({
    connectionString: dbUrl,
    ssl: false,
    connectionTimeoutMillis: 15000
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    // Create table if it doesn't exist
    await client.query(`
        CREATE TABLE IF NOT EXISTS return_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now(),
          phone TEXT NOT NULL,
          customer_name TEXT,
          email TEXT,
          device_id TEXT,
          order_id TEXT NOT NULL,
          order_name TEXT NOT NULL,
          order_date TIMESTAMPTZ,
          line_item_id TEXT NOT NULL,
          product_title TEXT NOT NULL,
          variant_title TEXT,
          sku TEXT,
          quantity INTEGER DEFAULT 1,
          item_price NUMERIC(10,2),
          image_url TEXT,
          request_type TEXT NOT NULL CHECK (request_type IN ('return', 'exchange')),
          reason TEXT NOT NULL,
          reason_detail TEXT,
          exchange_size TEXT,
          exchange_product_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending','approved','rejected','pickup_scheduled',
                              'in_transit','received','exchange_shipped','completed','cancelled')),
          admin_note TEXT,
          photo_url TEXT,
          photo_expires_at TIMESTAMPTZ,
          return_tracking_number TEXT,
          return_tracking_company TEXT,
          return_tracking_url TEXT,
          exchange_tracking_number TEXT,
          exchange_tracking_company TEXT,
          exchange_tracking_url TEXT,
          approved_at TIMESTAMPTZ,
          rejected_at TIMESTAMPTZ,
          pickup_at TIMESTAMPTZ,
          received_at TIMESTAMPTZ,
          exchange_shipped_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          refund_method TEXT DEFAULT 'store_credit',
          store TEXT DEFAULT 'i2tu0d-jc.myshopify.com',
          merchant_key TEXT
        );
    `);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_return_requests_phone ON return_requests(phone);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests(order_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_return_requests_created_at ON return_requests(created_at DESC);`);
    console.log('Successfully created return_requests table on Railway Postgres.');

    await client.end();
    console.log('Table fixed successfully.');
  } catch (err) {
    console.error('Error:', err);
    await client.end().catch(() => {});
  }
}

fixTable();
