const pg = require('pg');

const connectionString = 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres';

async function setWaba() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  try {
    console.log('Connecting to Postgres...');
    await client.connect();
    
    // Ensure column exists
    await client.query(`ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS waba_id TEXT;`).catch(() => {});

    // Check existing row
    const res = await client.query(`SELECT id FROM whatsapp_settings LIMIT 1;`);
    if (res.rows.length === 0) {
      await client.query(
        `INSERT INTO whatsapp_settings (waba_id, is_active) VALUES ($1, true);`,
        ['2025586748064434']
      );
      console.log('INSERTED permanent WABA ID: 2025586748064434');
    } else {
      await client.query(
        `UPDATE whatsapp_settings SET waba_id = $1 WHERE id = $2;`,
        ['2025586748064434', res.rows[0].id]
      );
      console.log('UPDATED permanent WABA ID: 2025586748064434');
    }
    await client.end();
  } catch (err) {
    console.error('Err:', err.message);
    try { await client.end(); } catch (_) {}
  }
}

setWaba();
