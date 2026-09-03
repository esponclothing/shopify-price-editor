const { Client } = require('pg');
const axios = require('axios');

async function checkReturns() {
  const client = new Client({
    connectionString: 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query(`SELECT COUNT(*) FROM return_requests`);
  console.log(`Returns in Postgres: ${res.rows[0].count}`);
  await client.end();
}
checkReturns();
