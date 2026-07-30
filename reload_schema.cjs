const pg = require('pg');

const connectionString = 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres';

async function reload() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  try {
    await client.connect();
    console.log('Sending NOTIFY pgrst reload schema...');
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log('Reloaded PostgREST schema cache successfully!');
    await client.end();
  } catch (err) {
    console.error('Err:', err.message);
    try { await client.end(); } catch (_) {}
  }
}

reload();
