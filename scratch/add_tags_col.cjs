const axios = require('axios');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';

axios.post(
  SUPABASE_URL + '/rest/v1/rpc/exec',
  { query: "ALTER TABLE whatsapp_chat_settings ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb" },
  { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' } }
).then(res => {
  console.log('OK', res.data);
}).catch(err => {
  console.log('ERROR RPC EXEC:', err.response?.data || err.message);
  // fallback if rpc exec doesn't exist (it doesn't in default supabase sometimes, we used rest/v1/rpc/exec_sql earlier)
  axios.post(
    SUPABASE_URL + '/rest/v1/rpc/exec_sql',
    { query: "ALTER TABLE whatsapp_chat_settings ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb" },
    { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' } }
  ).then(r => console.log('OK exec_sql')).catch(e => console.log('ERROR exec_sql:', e.response?.data || e.message));
});
