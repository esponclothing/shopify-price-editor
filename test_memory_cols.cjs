const axios = require('axios');

async function checkCols() {
  try {
    const res = await axios.get(
      `/rest/v1/whatsapp_chat_memory?limit=5`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    console.log('ROWS:', res.data);
  } catch (err) {
    console.error('ERROR:', err.response?.data || err.message);
  }
}
checkCols();
