const pg = require('pg');

const NEW_TOKEN = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const WABA_ID = '2025586748064434';

const mainDbUrl = 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres';
const nfuDbUrl = 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit@202612@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';

async function updateTokens() {
  // 1. Update main DB (xkiukbebnntjzfilyfmh)
  const clientMain = new pg.Client({
    connectionString: mainDbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  try {
    console.log('Connecting to Main DB (xkiukbebnntjzfilyfmh)...');
    await clientMain.connect();
    
    // Check if table exists
    const checkTable = await clientMain.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE  table_name = 'whatsapp_settings'
      );
    `);
    if (checkTable.rows[0].exists) {
      await clientMain.query(`
        UPDATE whatsapp_settings 
        SET whatsapp_token = $1, waba_id = $2;
      `, [NEW_TOKEN, WABA_ID]);
      console.log('SUCCESS! Updated whatsapp_settings in Main DB with NEW Meta token & WABA ID.');
    } else {
      console.log('Table whatsapp_settings not found in Main DB.');
    }
    await clientMain.end();
  } catch (err) {
    console.error('Error Main DB:', err.message);
    try { await clientMain.end(); } catch (_) {}
  }

  // 2. Check NFU DB (nfubnpgfwgrlpfhcbjlg - Checkout App DB)
  const clientNfu = new pg.Client({
    connectionString: nfuDbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  try {
    console.log('Connecting to Checkout App DB (nfubnpgfwgrlpfhcbjlg)...');
    await clientNfu.connect();
    
    // Check if whatsapp_settings or settings tables exist
    const res = await clientNfu.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    const tables = res.rows.map(r => r.table_name);
    console.log('Checkout App DB Tables:', tables);

    if (tables.includes('whatsapp_settings')) {
      await clientNfu.query(`
        UPDATE whatsapp_settings 
        SET whatsapp_token = $1, waba_id = $2;
      `, [NEW_TOKEN, WABA_ID]);
      console.log('SUCCESS! Updated whatsapp_settings in Checkout App DB.');
    }
    if (tables.includes('settings')) {
      await clientNfu.query(`
        UPDATE settings 
        SET whatsapp_token = $1 WHERE whatsapp_token IS NOT NULL;
      `).catch(() => {});
      console.log('Checked settings table in Checkout App DB.');
    }
    await clientNfu.end();
  } catch (err) {
    console.error('Error Checkout App DB:', err.message);
    try { await clientNfu.end(); } catch (_) {}
  }
}

updateTokens();
