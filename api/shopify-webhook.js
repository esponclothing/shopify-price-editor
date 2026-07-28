export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic Shopify webhook validation (can be enhanced with HMAC verification)
  const order = req.body;
  if (!order || !order.customer || !order.shipping_address) {
    return res.status(200).json({ message: 'No customer or address found, ignoring' });
  }

  const phone = order.customer.phone || order.shipping_address.phone;
  if (!phone) {
    return res.status(200).json({ message: 'No phone number, ignoring' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('91')) {
      formattedPhone = '91' + formattedPhone;
    }
    formattedPhone = '+' + formattedPhone;

    const { first_name, last_name, address1, address2, city, province, zip, country } = order.shipping_address;

    try {
      await fetch(`${supabaseUrl}/rest/v1/network_users`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          phone: formattedPhone,
          first_name,
          last_name,
          address1,
          address2,
          city,
          province,
          zip,
          country,
          updated_at: new Date().toISOString()
        })
      });
      return res.status(200).json({ success: true, message: 'Identity Network updated' });
    } catch (err) {
      console.error('Webhook error:', err);
      return res.status(500).json({ error: 'Failed to update Identity Network' });
    }
  }

  return res.status(500).json({ error: 'Database not configured' });
}
