// create_whatsapp_calls_table.cjs
// Run: node create_whatsapp_calls_table.cjs
// Creates the whatsapp_calls table in Supabase for the calling feature

const SUPABASE_URL = 'https://xkiukbebnntjzfilyfmh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';

const sql = `
CREATE TABLE IF NOT EXISTS whatsapp_calls (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  direction TEXT DEFAULT 'inbound',
  status TEXT DEFAULT 'ringing',
  answered_by TEXT,
  sdp_offer TEXT,
  sdp_answer TEXT,
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  customer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_calls REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_calls;
`;

async function run() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql })
    });

    // Try direct SQL endpoint instead
    const res2 = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });

    console.log('Trying direct table creation via Supabase Management API...');
    // Use the postgres REST endpoint
    const createRes = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_calls?limit=1`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    if (createRes.ok) {
      console.log('✅ whatsapp_calls table already exists!');
      return;
    }

    // Table doesn't exist, we need to create it via SQL
    console.log('Table does not exist. Please run this SQL in your Supabase SQL editor:');
    console.log('='.repeat(60));
    console.log(sql);
    console.log('='.repeat(60));
    console.log('\nGo to: https://supabase.com/dashboard/project/xkiukbebnntjzfilyfmh/sql/new');
  } catch (err) {
    console.error('Error:', err.message);
    console.log('\nPlease run this SQL manually in Supabase SQL editor:');
    console.log('https://supabase.com/dashboard/project/xkiukbebnntjzfilyfmh/sql/new');
    console.log('\n' + sql);
  }
}

run();
