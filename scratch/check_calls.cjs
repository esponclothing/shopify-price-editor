require('dotenv').config();
const axios = require('axios');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function check() {
  const { data } = await axios.get(`/rest/v1/whatsapp_calls?order=created_at.desc&limit=5`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  console.log(JSON.stringify(data, null, 2));
}
check();
