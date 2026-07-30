const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    // Check tables
    const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    console.log("Tables:", res.rows.map(r => r.tablename).join(', '));
    
    // Add column
    await client.query("ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS workflows JSONB;");
    
    // Set default value if empty
    await client.query("UPDATE whatsapp_settings SET workflows = '{\"order_placed\": true}'::jsonb WHERE workflows IS NULL;");
    
    console.log('Column workflows added and initialized successfully!');
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
