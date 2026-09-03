import axios from 'axios';
import fs from 'fs';

// Replace these with the new credentials once generated
const NEW_WABA_ID = 'YOUR_NEW_WABA_ID_HERE';
const NEW_WHATSAPP_TOKEN = 'YOUR_NEW_WHATSAPP_TOKEN_HERE';

async function restore() {
  try {
    const data = fs.readFileSync('templates_backup.json', 'utf8');
    const templates = JSON.parse(data);
    
    console.log(`Found ${templates.length} templates to restore.`);
    
    for (const tpl of templates) {
      if (tpl.name === 'hello_world' || tpl.name === 'sample_purchase_feedback' || tpl.name === 'sample_shipping_confirmation' || tpl.name === 'sample_issue_resolution') {
        console.log(`Skipping standard meta template: ${tpl.name}`);
        continue; // Meta auto-creates these usually
      }
      
      console.log(`Pushing template: ${tpl.name}...`);
      
      try {
        const payload = {
          name: tpl.name,
          language: tpl.language,
          category: tpl.category,
          allow_category_change: true,
          components: tpl.components
        };
        
        await axios.post(
          `https://graph.facebook.com/v20.0/${NEW_WABA_ID}/message_templates`,
          payload,
          { headers: { 'Authorization': `Bearer ${NEW_WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        console.log(`✅ Success: ${tpl.name}`);
      } catch (err) {
        console.error(`❌ Failed: ${tpl.name} -`, err.response?.data?.error?.message || err.message);
      }
      
      // Wait to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log('Restore process completed!');
  } catch (err) {
    console.error('Error reading backup:', err.message);
  }
}

if (NEW_WABA_ID === 'YOUR_NEW_WABA_ID_HERE') {
  console.log('Please insert your new WABA ID and Token into the script before running.');
} else {
  restore();
}
