require('dotenv').config();
const axios = require('axios');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nfubnpgfwgrlpfhcbjlg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

async function main() {
  try {
    // 1. Add Quick Replies
    console.log("Adding quick replies...");
    const quickReplies = [
      { label: 'Returns Portal', text: 'You can easily process your return or exchange by visiting our website: www.11fit.in/a/returns' },
      { label: 'HR / Careers', text: 'We handle recruitment via email. Please send your CV to careers@11fit.com' },
      { label: 'Website Link', text: 'You can check out our latest collection on our website: www.11fit.in' }
    ];

    for (const qr of quickReplies) {
      await axios.post(`${SUPABASE_URL}/rest/v1/whatsapp_quick_replies`, qr, { headers });
      console.log(`Added quick reply: ${qr.label}`);
    }

    // 2. Update existing whatsapp_settings
    console.log("Updating whatsapp_settings AI prompts...");
    const newBrandPolicy = `- Oversized Tees & Track Pants: Combed cotton & 4-Way Lycra. Size Guide available on our website.
- Shipping: 3-5 business days across India. COD & Prepaid available.
- Returns & Exchanges: 7-Day Return/Exchange policy. Customers must process returns via our website (www.11fit.in) on the returns portal.
- Recruitment/HR: For jobs or CV submissions, strictly tell them to email careers@11fit.com. Do not ask for CVs on WhatsApp.
- Support: For escalations or detailed support, email support@11fit.com.
- Website: www.11fit.in`;

    // Fetch the latest settings row
    const { data: settings } = await axios.get(`${SUPABASE_URL}/rest/v1/whatsapp_settings?select=id&order=id.desc&limit=1`, { headers });
    if (settings && settings.length > 0) {
      await axios.patch(`${SUPABASE_URL}/rest/v1/whatsapp_settings?id=eq.${settings[0].id}`, {
        inst_brand_policies: newBrandPolicy
      }, { headers });
      console.log("Updated existing whatsapp_settings row id:", settings[0].id);
    } else {
      console.log("No settings row found to update. (Defaults will be used)");
    }

  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
}

main();
