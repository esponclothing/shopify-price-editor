const axios = require('axios');

const url = 'https://xkiukbebnntjzfilyfmh.supabase.co/rest/v1/whatsapp_executions?select=*&order=created_at.desc&limit=10';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';

axios.get(url, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
}).then(r => {
  console.log('SUCCESS! Fetched rows:', r.data);
}).catch(err => {
  console.error('ERROR:', err.response?.data || err.message);
});
