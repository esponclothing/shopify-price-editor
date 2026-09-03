const { Client } = require('pg');
(async () => {
  const pgClient = new Client({ connectionString: 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit@202612@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
  await pgClient.connect();
  const res = await pgClient.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'checkout_sessions'");
  console.log(res.rows.map(r => r.column_name));
  await pgClient.end();
})();
