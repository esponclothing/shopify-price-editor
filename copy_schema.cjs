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
  console.log('Connected to both databases for schema replication.');

  const res = await oldClient.query(`
    SELECT table_name, column_name, data_type, character_maximum_length, column_default, is_nullable
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    ORDER BY table_name, ordinal_position
  `);

  const tables = {};
  for (const row of res.rows) {
    if (!tables[row.table_name]) tables[row.table_name] = [];
    tables[row.table_name].push(row);
  }

  for (const [tableName, columns] of Object.entries(tables)) {
    let sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
    
    const colDefs = columns.map(c => {
      let type = c.data_type === 'ARRAY' ? 'TEXT[]' : c.data_type;
      let def = `  "${c.column_name}" ${type}`;
      if (c.character_maximum_length) def += `(${c.character_maximum_length})`;
      if (c.is_nullable === 'NO') def += ' NOT NULL';
      if (c.column_default) def += ` DEFAULT ${c.column_default}`;
      return def;
    });
    
    sql += colDefs.join(',\n');
    sql += '\n);';

    console.log(`Creating table ${tableName}...`);
    try {
      await newClient.query(sql);
    } catch (e) {
      console.error(`Error creating table ${tableName}:`, e.message);
    }
  }

  await oldClient.end();
  await newClient.end();
  console.log('Schema creation complete!');
}

run().catch(console.error);
