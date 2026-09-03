require('dotenv').config();
const axios = require('axios');
async function test() {
  try {
    const WA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '1189183190949431';
    
    // get token from db
    const res2 = await axios.get(process.env.SUPABASE_URL + '/rest/v1/whatsapp_settings?select=whatsapp_token&order=id.desc&limit=1', {
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY }
    });
    const token = res2.data[0].whatsapp_token;

    console.log('Fetching templates from Meta...');
    const url = `https://graph.facebook.com/v21.0/2025586748064434/message_templates?fields=name,status,language&limit=20`;
    const res = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Templates:');
    res.data.data.forEach(t => {
      console.log(`- ${t.name} (Status: ${t.status}, Language: ${t.language})`);
    });
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}
test();
