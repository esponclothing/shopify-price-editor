const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit%40202612@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
});
async function run() {
  try {
    await client.connect();
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_flows (
        id SERIAL PRIMARY KEY,
        name TEXT,
        flow_json JSONB,
        is_active BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_flow_states (
        phone TEXT PRIMARY KEY,
        flow_id INTEGER REFERENCES whatsapp_flows(id),
        current_node_id TEXT,
        variables JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('Tables created successfully!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}
run();
