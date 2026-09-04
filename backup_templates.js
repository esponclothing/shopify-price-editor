import axios from 'axios';
import fs from 'fs';


const supabaseHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function backup() {
  try {
    const setRes = await axios.get(
      `/rest/v1/whatsapp_settings?select=whatsapp_token,waba_id&order=id.desc&limit=1`,
      { headers: supabaseHeaders }
    );
    
    if (!setRes.data || setRes.data.length === 0) {
      console.error('No whatsapp settings found');
      return;
    }
    
    const { whatsapp_token, waba_id } = setRes.data[0];
    console.log(`Fetching templates for WABA: ${waba_id}...`);
    
    const tRes = await axios.get(
      `https://graph.facebook.com/v20.0/${waba_id}/message_templates?fields=name,components,category,language,allow_category_change&limit=100`,
      { headers: { 'Authorization': `Bearer ${whatsapp_token}` } }
    );
    
    const templates = tRes.data.data;
    console.log(`Found ${templates.length} templates.`);
    
    // Filter out standard meta templates like "hello_world" if we only want custom ones, but we'll fetch all.
    // Also remove IDs as new creation won't use them.
    const cleanTemplates = templates.map(t => ({
      name: t.name,
      language: t.language,
      category: t.category,
      allow_category_change: true,
      components: t.components.map(c => {
        // Remove read-only / meta properties from components
        const cleanC = { ...c };
        delete cleanC.id;
        delete cleanC.buttons; // buttons is sometimes read-only nested structure, we might need to handle it carefully but let's keep it for now and clean up below
        if (cleanC.type === 'BUTTONS') {
           cleanC.buttons = c.buttons?.map(b => {
             const cleanB = { ...b };
             delete cleanB.id;
             return cleanB;
           });
        }
        return cleanC;
      })
    }));

    fs.writeFileSync('templates_backup.json', JSON.stringify(cleanTemplates, null, 2));
    console.log('Templates successfully backed up to templates_backup.json');
    
  } catch (err) {
    console.error('Error fetching templates:', err.response?.data || err.message);
  }
}

backup();
