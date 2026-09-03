const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres:11fit%40202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to Postgres...');
  
  // 1. Add exchange_shipped_at column
  await client.query(`
    ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS exchange_shipped_at TIMESTAMPTZ;
  `);
  console.log('Added exchange_shipped_at column!');

  // 2. Drop existing check constraint on status and add updated one
  await client.query(`
    ALTER TABLE return_requests DROP CONSTRAINT IF EXISTS return_requests_status_check;
    ALTER TABLE return_requests ADD CONSTRAINT return_requests_status_check 
      CHECK (status IN ('pending','approved','rejected','pickup_scheduled','in_transit','received','exchange_shipped','completed','cancelled'));
  `);
  console.log('Updated return_requests_status_check constraint to include exchange_shipped!');

  await client.end();
  console.log('Done!');
}

run().catch(e => { console.error('ERROR:', e.message); client.end(); });
