const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to Postgres...');

  await client.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_settings (
      id SERIAL PRIMARY KEY,
      groq_api_key TEXT,
      groq_model TEXT,
      whatsapp_token TEXT
    );
  `);

  const queries = [
    `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS inst_language TEXT;`,
    `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS inst_order_security TEXT;`,
    `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS inst_size_advisor TEXT;`,
    `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS inst_brand_policies TEXT;`,
    `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS inst_custom TEXT;`
  ];

  for (const q of queries) {
    await client.query(q);
  }

  console.log('AI Instruction columns added to whatsapp_settings!');

  await client.end();
}

run().catch(e => { console.error('ERROR:', e.message); client.end(); });
