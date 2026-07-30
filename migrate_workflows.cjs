const pg = require('pg');
require('dotenv').config();

async function check() {
  const client = new pg.Client({
    connectionString: 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit@202612@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    await client.query(`
      ALTER TABLE whatsapp_settings 
      ADD COLUMN IF NOT EXISTS workflows jsonb DEFAULT '{"abandoned_cart":true,"order_placed":true,"order_shipped":true,"out_for_delivery":true,"order_delivered":true}'::jsonb;
    `);
    console.log("workflows column added!");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

check();
