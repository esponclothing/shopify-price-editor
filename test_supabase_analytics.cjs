const { Client } = require('pg');

const connectionString = 'postgres://postgres:11fit@202612@db.nfubnpgfwgrlpfhcbjlg.supabase.co:5432/postgres';
const client = new Client({ connectionString });

async function run() {
  await client.connect();
  const otpRes = await client.query('SELECT * FROM otp_analytics ORDER BY created_at DESC LIMIT 10');
  console.log('otp_analytics rows count:', otpRes.rows.length);
  if (otpRes.rows.length > 0) {
    console.log('Sample OTP Row:', otpRes.rows[0]);
  }

  const usersRes = await client.query('SELECT * FROM network_users ORDER BY created_at DESC LIMIT 10');
  console.log('network_users rows count:', usersRes.rows.length);
  if (usersRes.rows.length > 0) {
    console.log('Sample User Row:', usersRes.rows[0]);
  }
  await client.end();
}

run();
