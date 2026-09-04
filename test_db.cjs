const axios = require('axios');

axios.get(
  `/rest/v1/whatsapp_chat_memory?phone=eq.919306817689&order=created_at.desc&limit=5`,
  { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
).then(res => console.log(JSON.stringify(res.data, null, 2)))
 .catch(err => console.log(err.message));
