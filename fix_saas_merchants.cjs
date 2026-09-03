const { Client } = require('pg');

async function fix() {
  const sbClient = new Client({ connectionString: 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit%40202612@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres', ssl: { rejectUnauthorized: false } });
  const rwClient = new Client({ connectionString: 'postgresql://postgres:gEeINngvmFomRYZljhTrKNkKrrjlcrfQ@altaria.proxy.rlwy.net:33107/railway' });

  await sbClient.connect();
  await rwClient.connect();

  const res = await sbClient.query('SELECT * FROM saas_merchants');
  
  for (const row of res.rows) {
    const cols = Object.keys(row);
    const vals = cols.map(c => {
      if (Array.isArray(row[c])) return '{' + row[c].join(',') + '}';
      if (typeof row[c] === 'object' && row[c] !== null) return JSON.stringify(row[c]);
      return row[c];
    });
    
    const placeholders = cols.map((_, i) => '$' + (i+1)).join(', ');
    const colStr = cols.map(c => `"${c}"`).join(', ');
    
    await rwClient.query(`INSERT INTO saas_merchants (${colStr}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, vals);
  }
  
  await sbClient.end();
  await rwClient.end();
  console.log('saas_merchants fixed');
}
fix().catch(console.error);
