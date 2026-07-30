const pg = require('pg');

const connectionString = 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres';

async function migrate() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  try {
    console.log('Connecting to Postgres...');
    await client.connect();
    console.log('Creating push_subscriptions table if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id BIGSERIAL PRIMARY KEY,
        endpoint TEXT UNIQUE NOT NULL,
        subscription JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('SUCCESS! push_subscriptions table created.');
    await client.end();
  } catch (err) {
    console.error('Err:', err.message);
    try { await client.end(); } catch (_) {}
  }
}

migrate();
