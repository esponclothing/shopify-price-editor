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

    console.log('Sending call_permission_request to 919306817689...');
    const url = `https://graph.facebook.com/v21.0/${WA_PHONE_NUMBER_ID}/messages`;
    
    const payload = {
      messaging_product: 'whatsapp',
      to: '917053301234',
      type: 'template',
      template: {
        name: 'call_permission_request',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'Saurabh' }
            ]
          }
        ]
      }
    };

    const res = await axios.post(url, payload, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Success:', res.data);
  } catch (err) {
    console.error('Error:', JSON.stringify(err.response?.data || err.message, null, 2));
  }
}
test();
