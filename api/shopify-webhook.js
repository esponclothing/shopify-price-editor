export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const order = req.body;
  if (!order || !order.id) {
    return res.status(200).json({ message: 'No valid order payload found, ignoring' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not configured');
    return res.status(500).json({ error: 'Database not configured' });
  }

  // 1. Extract phones for indexing
  const phones = [
    order.phone,
    order.customer?.phone,
    order.shipping_address?.phone,
    order.billing_address?.phone
  ];
  const uniqueLast10s = [];
  phones.forEach(p => {
    if (!p) return;
    const clean = p.toString().replace(/\D/g, '');
    if (clean.length >= 10) {
      const last10 = clean.slice(-10);
      if (!uniqueLast10s.includes(last10)) {
        uniqueLast10s.push(last10);
      }
    }
  });

  const phone_last10 = uniqueLast10s[0] || null;
  const alt_phone_last10 = uniqueLast10s[1] || null;

  const customer_name = order.shipping_address
    ? `${order.shipping_address.first_name || ''} ${order.shipping_address.last_name || ''}`.trim()
    : (order.customer ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim() : null);

  const fulfillment = (order.fulfillments && order.fulfillments.length > 0) ? order.fulfillments[0] : null;
  const tracking_number = fulfillment?.tracking_number || null;
  const tracking_company = fulfillment?.tracking_company || null;
  const tracking_url = fulfillment?.tracking_url || (fulfillment?.tracking_urls && fulfillment.tracking_urls[0]) || null;

  try {
    // Upsert into shopify_orders table
    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/shopify_orders`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: order.id,
        order_number: order.order_number,
        name: order.name || `#${order.order_number}`,
        phone_last10,
        alt_phone_last10,
        customer_name,
        total_price: order.total_price || 0,
        fulfillment_status: order.fulfillment_status || null,
        cancelled_at: order.cancelled_at || null,
        tracking_number,
        tracking_company,
        tracking_url,
        order_data: order,
        created_at: order.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      console.error('Error upserting order to shopify_orders:', errText);
    }

    // Also update network_users table if shipping address / phone available
    const mainPhone = order.customer?.phone || order.shipping_address?.phone;
    if (mainPhone && order.shipping_address) {
      let formattedPhone = mainPhone.replace(/\D/g, '');
      if (!formattedPhone.startsWith('91')) {
        formattedPhone = '91' + formattedPhone;
      }
      formattedPhone = '+' + formattedPhone;

      const { first_name, last_name, address1, address2, city, province, zip, country } = order.shipping_address;

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
    }

    return res.status(200).json({ success: true, message: 'Shopify order & customer synced to database' });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Failed to process Shopify webhook' });
  }
}
