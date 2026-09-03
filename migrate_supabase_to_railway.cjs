const { Client } = require('pg');

async function run() {
  const supabaseUrl = 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit%40202612@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';
  const railwayUrl = 'postgresql://postgres:gEeINngvmFomRYZljhTrKNkKrrjlcrfQ@altaria.proxy.rlwy.net:33107/railway';
  
  const sbClient = new Client({ connectionString: supabaseUrl, ssl: { rejectUnauthorized: false } });
  const rwClient = new Client({ connectionString: railwayUrl });
  
  console.log('Connecting to databases...');
  await sbClient.connect();
  await rwClient.connect();

  console.log('Fetching tables from Supabase...');
  // Only migrate the missing ones!
  const tables = [
    'whatsapp_chat_memory',
    'whatsapp_chat_settings',
    'push_subscriptions',
    'whatsapp_settings',
    'whatsapp_broadcasts'
  ];
  console.log(`Found ${tables.length} tables:`, tables.join(', '));

  for (const table of tables) {
    console.log(`\nProcessing table: ${table}`);
    
    // 1. Generate Schema
    const colRes = await sbClient.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    let cols = [];
    for (const c of colRes.rows) {
      let type = c.data_type;
      if (type === 'character varying') type = c.character_maximum_length ? `VARCHAR(${c.character_maximum_length})` : 'VARCHAR';
      else if (type === 'timestamp with time zone') type = 'TIMESTAMPTZ';
      else if (type === 'timestamp without time zone') type = 'TIMESTAMP';
      else if (type === 'ARRAY') type = 'TEXT[]'; // Simplify arrays
      else if (type === 'USER-DEFINED' || type === 'user-defined') type = 'TEXT';
      
      let def = c.column_default ? ` DEFAULT ${c.column_default}` : '';
      let nullStr = c.is_nullable === 'YES' ? '' : ' NOT NULL';
      
      if (def.includes('::') || def.includes('auth.uid()') || def.includes('uuid_generate_v4()')) {
        def = ''; 
      }
      cols.push(`"${c.column_name}" ${type}${nullStr}${def}`);
    }

    const createSql = `CREATE TABLE IF NOT EXISTS "${table}" (\n  ${cols.join(',\n  ')}\n);`;
    await rwClient.query(createSql);
    
    // 2. Primary Keys
    const pkRes = await sbClient.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1
    `, [table]);

    if (pkRes.rows.length > 0) {
      const pks = pkRes.rows.map(r => `"${r.column_name}"`).join(', ');
      try {
        await rwClient.query(`ALTER TABLE "${table}" ADD PRIMARY KEY (${pks})`);
        console.log(`  Added PK: ${pks}`);
      } catch (e) {
        if (!e.message.includes('already exists')) console.log(`  Failed PK: ${e.message}`);
      }
    }

    // 3. Copy Data in Batches
    console.log(`  Fetching data...`);
    const dataRes = await sbClient.query(`SELECT * FROM "${table}"`);
    const rows = dataRes.rows;
    if (rows.length === 0) {
      console.log(`  No data to copy.`);
      continue;
    }
    
    console.log(`  Copying ${rows.length} rows using batch inserts...`);
    const columns = Object.keys(rows[0]);
    const colStr = columns.map(c => `"${c}"`).join(', ');
    
    const BATCH_SIZE = 500;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batchRows = rows.slice(i, i + BATCH_SIZE);
      let valuesStrArray = [];
      let flatValues = [];
      let paramIndex = 1;
      
      for (const row of batchRows) {
        const rowParams = [];
        for (const c of columns) {
          let val = row[c];
          if (Array.isArray(val)) val = JSON.stringify(val);
          else if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
          
          flatValues.push(val);
          rowParams.push(`$${paramIndex++}`);
        }
        valuesStrArray.push(`(${rowParams.join(', ')})`);
      }
      
      const query = `INSERT INTO "${table}" (${colStr}) VALUES ${valuesStrArray.join(', ')} ON CONFLICT DO NOTHING`;
      try {
        await rwClient.query(query, flatValues);
      } catch (e) {
        console.error(`  Batch insert error on table ${table}: ${e.message}`);
      }
      process.stdout.write(`\r  Inserted ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);
    }
    console.log();
  }

  console.log('\nMigration complete!');
  await sbClient.end();
  await rwClient.end();
}
run().catch(console.error);
