const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to Postgres...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_broadcasts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      segment TEXT NOT NULL,
      template_name TEXT NOT NULL,
      status TEXT DEFAULT 'pending', -- pending, running, completed, failed
      total_count INT DEFAULT 0,
      sent_count INT DEFAULT 0,
      failed_count INT DEFAULT 0,
      delivered_count INT DEFAULT 0,
      read_count INT DEFAULT 0,
      clicked_count INT DEFAULT 0,
      estimated_cost NUMERIC(10, 2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('Table whatsapp_broadcasts created or verified!');

  await client.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_broadcast_logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      broadcast_id UUID REFERENCES whatsapp_broadcasts(id) ON DELETE CASCADE,
      phone TEXT NOT NULL,
      wamid TEXT,
      status TEXT DEFAULT 'pending', -- pending, sent, delivered, read, clicked, failed
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('Table whatsapp_broadcast_logs created or verified!');

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_broadcast_logs_wamid ON whatsapp_broadcast_logs (wamid);
    CREATE INDEX IF NOT EXISTS idx_broadcast_logs_broadcast_id ON whatsapp_broadcast_logs (broadcast_id);
    CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON whatsapp_broadcasts (created_at DESC);
  `);
  console.log('Indexes created or verified!');

  await client.query(`ALTER TABLE whatsapp_broadcasts DISABLE ROW LEVEL SECURITY;`);
  await client.query(`ALTER TABLE whatsapp_broadcast_logs DISABLE ROW LEVEL SECURITY;`);
  console.log('RLS disabled!');

  await client.end();
}

run().catch(e => { console.error('ERROR:', e.message); client.end(); });
