const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres:11fit%40202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to Postgres...');
  
  // 1. Add metadata column
  await client.query(`
    ALTER TABLE whatsapp_chat_memory ADD COLUMN IF NOT EXISTS metadata TEXT;
  `);
  console.log('Added metadata column!');

  await client.end();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
