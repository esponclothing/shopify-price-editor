// create_returns_table.cjs
// Run: node create_returns_table.cjs
// Creates the return_requests table in Supabase for the 11fit Return & Exchange system

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
  console.log('Creating return_requests table in Supabase...');

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
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

        -- Status lifecycle
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','approved','rejected','pickup_scheduled',
                            'in_transit','received','exchange_shipped','completed','cancelled')),
        admin_note TEXT,

        -- Photo proof (auto-deleted after 30 days)
        photo_url TEXT,
        photo_expires_at TIMESTAMPTZ,

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
        exchange_shipped_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,

        -- Refund method
        refund_method TEXT DEFAULT 'store_credit',

        -- Multi-merchant
        store TEXT DEFAULT 'i2tu0d-jc.myshopify.com',
        merchant_key TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_return_requests_phone ON return_requests(phone);
      CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests(order_id);
      CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);
      CREATE INDEX IF NOT EXISTS idx_return_requests_store ON return_requests(store);
      CREATE INDEX IF NOT EXISTS idx_return_requests_created_at ON return_requests(created_at DESC);
    `
  });

  if (error) {
    console.error('Error creating table via RPC:', error.message);
    console.log('\nFalling back to REST API method...');
    
    // Fallback: use raw SQL via pg
    const { Client } = require('pg');
    const dbUrl = process.env.SUPABASE_DB_URL || 
      `postgresql://postgres.${supabaseUrl.replace('https://', '').split('.')[0]}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres`;
    
    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000
    });
    
    try {
      await client.connect();
      
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
                              'in_transit','received','completed','cancelled')),
          admin_note TEXT,
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
          completed_at TIMESTAMPTZ,
          store TEXT DEFAULT 'i2tu0d-jc.myshopify.com',
          merchant_key TEXT
        );
      `);
      
      await client.query(`CREATE INDEX IF NOT EXISTS idx_return_requests_phone ON return_requests(phone);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests(order_id);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_return_requests_created_at ON return_requests(created_at DESC);`);
      
      await client.end();
      console.log('✅ return_requests table created successfully via pg!');
    } catch (pgError) {
      console.error('pg Error:', pgError.message);
      await client.end().catch(() => {});
    }
  } else {
    console.log('✅ return_requests table created successfully!');
  }
}

createTable().catch(console.error);
