const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to Postgres...');
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_chat_settings (
      phone TEXT PRIMARY KEY,
      ai_paused BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('Table whatsapp_chat_settings created or verified!');

  await client.query(`ALTER TABLE whatsapp_chat_settings DISABLE ROW LEVEL SECURITY;`);
  console.log('RLS disabled on whatsapp_chat_settings!');

  await client.end();
}

run().catch(e => { console.error('ERROR:', e.message); client.end(); });
