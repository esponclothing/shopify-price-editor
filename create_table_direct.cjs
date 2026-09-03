const { Client } = require('pg');

const connectionString = 'postgresql://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres';

const sql = `
CREATE TABLE IF NOT EXISTS whatsapp_calls (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  direction TEXT DEFAULT 'inbound',
  status TEXT DEFAULT 'ringing',
  answered_by TEXT,
  sdp_offer TEXT,
  sdp_answer TEXT,
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  customer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_calls REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'whatsapp_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_calls;
  END IF;
END
$$;
`;

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to Supabase Postgres!');
    await client.query(sql);
    console.log('✅ whatsapp_calls table created successfully!');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
