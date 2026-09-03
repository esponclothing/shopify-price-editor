const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:gEeINngvmFomRYZljhTrKNkKrrjlcrfQ@altaria.proxy.rlwy.net:33107/railway'
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables:', res.rows.map(r => r.table_name));
  await client.end();
}
run();
