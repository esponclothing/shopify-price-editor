const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_settings (
      id SERIAL PRIMARY KEY,
      groq_api_key TEXT,
      groq_model TEXT DEFAULT 'llama-3.3-70b-versatile',
      whatsapp_token TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('Table created!');

  await client.query(`ALTER TABLE whatsapp_settings DISABLE ROW LEVEL SECURITY;`);
  console.log('RLS disabled!');

  const existing = await client.query(`SELECT COUNT(*) FROM whatsapp_settings`);
  if (parseInt(existing.rows[0].count) === 0) {
    await client.query(`
      INSERT INTO whatsapp_settings (groq_api_key, groq_model) 
      VALUES ($1, $2)
    `, ['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', 'llama-3.3-70b-versatile']);
    console.log('Default row inserted!');
  } else {
    console.log('Row already exists, skipping insert.');
  }

  const check = await client.query(`SELECT * FROM whatsapp_settings`);
  console.log('Current settings:', check.rows);

  await client.end();
}

run().catch(e => { console.error('ERROR:', e.message); client.end(); });
