const axios = require('axios');


async function test(phone) {
  console.log('Testing phone:', phone);
  const url = `/rest/v1/shopify_orders?or=(phone_last10.eq.${phone},alt_phone_last10.eq.${phone})&order=created_at.desc`;
  try {
    const res = await axios.get(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    console.log('Found rows count:', res.data?.length);
    if (res.data?.length > 0) {
      console.log('Sample row order_number:', res.data[0].order_number);
      console.log('Sample row order_data type:', typeof res.data[0].order_data);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test('9306817689');
test('9833264430');
