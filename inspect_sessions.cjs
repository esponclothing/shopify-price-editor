const pg = require('pg');
const nfuDbUrl = 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit@202612@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';

async function check() {
  const client = new pg.Client({
    connectionString: nfuDbUrl,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    // Check distinct status values in checkout_sessions
    const statRes = await client.query(`SELECT DISTINCT status FROM checkout_sessions;`);
    console.log('Distinct status in checkout_sessions:', statRes.rows);

    // Check rows for +919176689256
    const userRes = await client.query(`
      SELECT * 
      FROM checkout_sessions 
      WHERE phone LIKE '%9176689256%'
      ORDER BY created_at DESC LIMIT 5;
    `);
    console.log('Rows for 9176689256:', userRes.rows);

    // Check columns of checkout_sessions
    const colsRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'checkout_sessions';
    `);
    console.log('Columns in checkout_sessions:', colsRes.rows.map(r => r.column_name));
    await client.end();
  } catch (err) {
    console.error('Error:', err.message);
    try { await client.end(); } catch (_) {}
  }
}
check();
