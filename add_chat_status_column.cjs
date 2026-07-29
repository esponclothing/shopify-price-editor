const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to Postgres...');

  await client.query(`
    ALTER TABLE whatsapp_chat_settings ADD COLUMN IF NOT EXISTS chat_status TEXT DEFAULT 'open';
  `);
  console.log('Column chat_status added to whatsapp_chat_settings!');

  await client.end();
}

run().catch(e => { console.error('ERROR:', e.message); client.end(); });
