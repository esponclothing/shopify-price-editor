const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  await client.connect();
  const res = await client.query('SELECT * FROM whatsapp_executions ORDER BY created_at DESC LIMIT 10');
  console.log('Executions in DB:', res.rows);
  await client.end();
}

check().catch(console.error);
