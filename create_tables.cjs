const axios = require('axios');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xkiukbebnntjzfilyfmh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';
const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json'
};
async function setup() {
  await axios.post(SUPABASE_URL + '/rest/v1/rpc/exec_sql', {
    sql: 'CREATE TABLE IF NOT EXISTS whatsapp_scheduled_messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), phone TEXT NOT NULL, flow_id UUID, current_node_id TEXT, variables JSONB DEFAULT \'' + '{}' + '\'::jsonb, send_after TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()); CREATE TABLE IF NOT EXISTS whatsapp_flow_analytics (flow_id UUID, node_id TEXT, hits INTEGER DEFAULT 1, PRIMARY KEY (flow_id, node_id));'
  }, { headers }).catch(e => console.log('RPC failed:', e.response?.data || e.message));
  console.log('Setup complete');
}
setup();
