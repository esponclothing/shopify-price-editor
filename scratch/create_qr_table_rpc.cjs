const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xkiukbebnntjzfilyfmh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function setup() {
  try {
    await axios.post(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      sql: `
        CREATE TABLE IF NOT EXISTS whatsapp_quick_replies (
          id BIGSERIAL PRIMARY KEY,
          label TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    }, { headers }).catch(e => console.log('RPC failed:', e.response?.data || e.message));
    
    // Insert initial data
    const replies = [
      { label: 'Apology for Delay', text: "Hi there! We sincerely apologize for the delay. We are looking into this right now and will get back to you shortly." },
      { label: 'Size Chart Request', text: "Here is our detailed sizing chart: https://11fit.in/pages/size-chart. Please let me know if you need help picking the right size!" },
      { label: 'Confirm Address', text: "Could you please confirm if your delivery address is correct and complete with a landmark?" },
      { label: 'Out of Stock', text: "Unfortunately, the item you requested is currently out of stock. We expect to restock it next week!" },
      { label: 'Warehouse Check', text: "I'll need to check with our warehouse team regarding the stock for this item. Please give me a few minutes." },
    ];
    for (const r of replies) {
        await axios.post(`${SUPABASE_URL}/rest/v1/whatsapp_quick_replies`, r, { headers }).catch(() => {});
    }
    console.log("Setup complete");
  } catch (e) {
    console.log(e);
  }
}

setup();
