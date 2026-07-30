export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const order = req.body;
  const topic = req.headers['x-shopify-topic'] || 'orders/create';
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

    // -------------------------------------------------------------
    // UPDATE CHECKOUT SESSIONS STATUS TO 'completed' IN POSTGRES
    // -------------------------------------------------------------
    try {
      const { Client } = await import('pg');
      const nfuDbUrl = 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit@202612@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';
      const pgClient = new Client({
        connectionString: nfuDbUrl,
        ssl: { rejectUnauthorized: false }
      });
      await pgClient.connect();

      const checkoutToken = order.checkout_token || order.cart_token || null;
      
      let queryArgs = [];
      let whereClauses = [];

      if (checkoutToken) {
        queryArgs.push(checkoutToken);
        whereClauses.push(`cart_details->>'token' = $${queryArgs.length}`);
      }
      
      if (phone_last10) {
        queryArgs.push(phone_last10);
        whereClauses.push(`phone LIKE '%' || $${queryArgs.length} || '%'`);
      }

      if (whereClauses.length > 0) {
        const updateQuery = `
          UPDATE checkout_sessions 
          SET status = 'completed', updated_at = NOW()
          WHERE status = 'abandoned' AND (${whereClauses.join(' OR ')})
        `;
        const updateRes = await pgClient.query(updateQuery, queryArgs);
        console.log(`Updated ${updateRes.rowCount} checkout_sessions to completed for order ${order.id}`);
      }
      await pgClient.end();
    } catch (pgErr) {
      console.error('Error updating checkout_sessions in Postgres:', pgErr.message);
    }

    // -------------------------------------------------------------
    // SEND ORDER CONFIRMATION WHATSAPP TEMPLATE
    // -------------------------------------------------------------
    try {
      // Get WA token + workflows from settings
      const settingsRes = await fetch(`${supabaseUrl}/rest/v1/whatsapp_settings?select=whatsapp_token,workflows&order=id.desc&limit=1`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
      let settingsData = [];
      if (settingsRes.ok) {
        settingsData = await settingsRes.json();
      } else {
        console.error('Failed to fetch whatsapp_settings:', await settingsRes.text());
      }
      const row = settingsData?.[0] || {};
      const waToken = row.whatsapp_token;
      const workflows = row.workflows || {};

      // Check if we should send a WhatsApp message based on the topic and workflow settings
      const shouldSendCreate = topic === 'orders/create' && workflows?.order_placed !== false;
      const shouldSendFulfill = topic === 'orders/fulfilled' && workflows?.order_shipped !== false;

      if (waToken && (shouldSendCreate || shouldSendFulfill)) {
        // Format customer phone for WhatsApp
        const rawPhone = order.customer?.phone || order.shipping_address?.phone || order.billing_address?.phone || order.phone || '';
        let waPhone = rawPhone.replace(/\D/g, '');
        if (waPhone.length === 10) waPhone = '91' + waPhone;
        if (waPhone.length === 12 && !waPhone.startsWith('91')) waPhone = '91' + waPhone.slice(-10);

        const name = order.shipping_address?.first_name || order.customer?.first_name || 'Customer';
        const orderName = order.name || `#${order.order_number}`;
        const address = order.shipping_address
          ? `${order.shipping_address.address1 || ''}, ${order.shipping_address.city || ''}, ${order.shipping_address.province || ''} ${order.shipping_address.zip || ''}`.replace(/^,\s*/, '').replace(/,\s*$/, '').trim()
          : 'On file';

        // Build items list (max 3 lines to stay within Meta limits)
        const lineItems = order.line_items || [];
        const itemsText = lineItems.slice(0, 3).map(i => {
          const variant = i.variant_title && i.variant_title !== 'Default Title' ? ` (${i.variant_title})` : '';
          return `${i.title}${variant} x${i.quantity}`;
        }).join(', ') + (lineItems.length > 3 ? ` +${lineItems.length - 3} more item(s)` : '');

        // Detect payment type
        const tags = (order.tags || '').toLowerCase();
        const totalPrice = parseFloat(order.total_price || 0);
        const totalOutstanding = parseFloat(order.total_outstanding || 0);
        const paymentGateway = (order.payment_gateway || '').toLowerCase();
        const advanceMatch = order.tags?.match?.(/Advance_Paid_([0-9.]+)/);

        let templateName, components;
        const WA_PHONE_ID = '1189183190949431';

        if (topic === 'orders/fulfilled') {
          // ORDER SHIPPED / OUT FOR DELIVERY (using out_for_delivery_v2 for dynamic tracking link)
          const fulfillment = (order.fulfillments && order.fulfillments.length > 0) ? order.fulfillments[0] : null;
          const trackingUrl = fulfillment?.tracking_url || (fulfillment?.tracking_urls && fulfillment.tracking_urls[0]) || '';
          
          let paymentInfo = '';
          if (paymentGateway.includes('cash') || paymentGateway === 'cod' || totalOutstanding >= totalPrice * 0.9) {
            paymentInfo = `₹${totalPrice.toFixed(2)} (COD - Please keep cash/UPI ready)`;
          } else {
            paymentInfo = `Prepaid (No payment required)`;
          }

          templateName = 'out_for_delivery_v2';
          components = [{
            type: 'body',
            parameters: [
              { type: 'text', text: name },
              { type: 'text', text: orderName },
              { type: 'text', text: trackingUrl ? `Track here: ${trackingUrl}` : 'Your order is on the way.' },
              { type: 'text', text: paymentInfo }
            ]
          }];
        } else {
          // ORDER CONFIRMED (using order_confirmed_v2)
          let paymentInfo = '';
          if (advanceMatch) {
            const advancePaid = advanceMatch[1];
            const balanceDue = (totalPrice - parseFloat(advancePaid)).toFixed(2);
            paymentInfo = `₹${balanceDue} Due (Advance ₹${advancePaid} paid)`;
          } else if (paymentGateway.includes('cash') || paymentGateway === 'cod' || totalOutstanding >= totalPrice * 0.9) {
            paymentInfo = `₹${totalPrice.toFixed(2)} (COD)`;
          } else {
            paymentInfo = `₹${totalPrice.toFixed(2)} (Prepaid)`;
          }

          templateName = 'order_confirmed_v2';
          components = [{
            type: 'body',
            parameters: [
              { type: 'text', text: name },
              { type: 'text', text: orderName },
              { type: 'text', text: itemsText || 'Your items' },
              { type: 'text', text: paymentInfo },
              { type: 'text', text: address }
            ]
          }, {
            type: 'button',
            sub_type: 'quick_reply',
            index: '0',
            parameters: [
              { type: 'payload', payload: 'track_order' }
            ]
          }];
        }

        if (waPhone.length >= 10) {
          const waRes = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${waToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: waPhone,
              type: 'template',
              template: {
                name: templateName,
                language: { code: 'en_US' },
                components
              }
            })
          });
          const waData = await waRes.json();
          console.log(`[WA Order] Sent ${templateName} to ${waPhone} → MsgID: ${waData?.messages?.[0]?.id || 'N/A'}`);
        }
      }
    } catch (waErr) {
      console.error('[WA Order] Error sending confirmation template:', waErr.message);
    }

    return res.status(200).json({ success: true, message: 'Shopify order & customer synced and WhatsApp sent' });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Failed to process Shopify webhook' });
  }
}

