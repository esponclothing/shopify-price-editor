const axios = require('axios');


async function test() {
  try {
    const res = await axios.get(
      `/rest/v1/push_subscriptions?select=*&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    console.log('SUCCESS! Status:', res.status, 'Data:', res.data);
  } catch (err) {
    console.error('ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

test();
