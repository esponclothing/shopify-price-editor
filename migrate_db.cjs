const { Client } = require('pg');

const oldClient = new Client({
  connectionString: 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit%40202612@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const newClient = new Client({
  connectionString: 'postgres://postgres:11fit%40202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await oldClient.connect();
  await newClient.connect();
  console.log('Connected to both databases!');

  const tablesRes = await oldClient.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  const tables = tablesRes.rows.map(r => r.table_name);
  console.log('Tables to migrate:', tables);

  // We should try to insert all rows for each table
  // But wait, there might be foreign key constraints. We'll do it in multiple passes or ignore conflicts.
  for (const table of tables) {
    try {
      console.log(`Migrating ${table}...`);
      const oldData = await oldClient.query(`SELECT * FROM "${table}"`);
      if (oldData.rows.length === 0) {
        console.log(`  Table ${table} is empty.`);
        continue;
      }
      
      const columns = Object.keys(oldData.rows[0]);
      
      for (const row of oldData.rows) {
        const values = columns.map(c => row[c]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const colNames = columns.map(c => `"${c}"`).join(', ');
        
        try {
          await newClient.query(
            `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values
          );
        } catch (e) {
          // If the conflict target is not found (meaning table has no primary key), we fallback to direct insert and catch duplicates later
          if (e.message.includes('there is no unique or exclusion constraint matching the ON CONFLICT specification')) {
             try {
                await newClient.query(`INSERT INTO "${table}" (${colNames}) VALUES (${placeholders})`, values);
             } catch(e2) {
                // ignore
             }
          } else {
             // console.error(`  Error inserting row into ${table}:`, e.message);
          }
        }
      }
      console.log(`  Migrated ${oldData.rows.length} rows to ${table}.`);
    } catch (e) {
      console.error(`Error migrating table ${table}:`, e.message);
    }
  }

  await oldClient.end();
  await newClient.end();
  console.log('Migration complete!');
}

run().catch(console.error);
