const pg = require('pg');
require('dotenv').config();

async function check() {
  const client = new pg.Client({
    connectionString: 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'whatsapp_settings';
    `);
    console.log("whatsapp_settings columns:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();
