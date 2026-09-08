import pg from 'pg';
const { Pool } = pg;

export const poolEditor = new Pool({
  connectionString: process.env.RAILWAY_DATABASE_URL || 'postgresql://postgres:gEeINngvmFomRYZljhTrKNkKrrjlcrfQ@altaria.proxy.rlwy.net:33107/railway',
  ssl: { rejectUnauthorized: false }
});

export const poolCheckout = new Pool({
  connectionString: process.env.CHECKOUT_DATABASE_URL || 'postgresql://postgres:zXuyDwmBoMwdHnUqoFMUIkkKILuEcaas@reseau.proxy.rlwy.net:12168/railway',
  ssl: { rejectUnauthorized: false }
});

let cachedSettings = null;
let lastSettingsFetch = 0;

export async function getCachedSettings() {
  if (cachedSettings && (Date.now() - lastSettingsFetch < 60000)) {
    return cachedSettings;
  }
  try {
    const sRes = await poolEditor.query(
      `SELECT whatsapp_token, waba_id, workflows FROM whatsapp_settings LIMIT 1`
    );
    cachedSettings = sRes.rows[0] || {};
    lastSettingsFetch = Date.now();
  } catch (err) {
    console.error('[Order Lifecycle] Error fetching whatsapp_settings:', err.message);
  }
  return cachedSettings || {};
}

/**
 * Format raw phone number to Meta WhatsApp format (e.g., 919812345678)
 */
export function formatToWhatsAppPhone(rawPhone) {
  if (!rawPhone) return null;
  const digits = String(rawPhone).replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length > 10) return '91' + digits.slice(-10);
  return null;
}

/**
 * Send a WhatsApp template via Meta Cloud API and log to memory
 */
async function sendWhatsAppTemplate({ toPhone, templateName, components, waToken, phoneId, orderNumber, summaryText }) {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${waToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en_US' },
          components
        }
      })
    });

    const data = await res.json();
    const msgId = data?.messages?.[0]?.id;

    if (res.ok && msgId) {
      console.log(`[Order Lifecycle] ✅ Sent ${templateName} to ${toPhone} for Order #${orderNumber} → MsgID: ${msgId}`);

      // Log into whatsapp_chat_memory so AI & inbox know about it
      const memoryText = `📦 *[Auto Workflow: ${templateName}]*\nOrder #${orderNumber} • ${summaryText || ''}`;
      await poolEditor.query(
        `INSERT INTO whatsapp_chat_memory (phone, role, content, created_at) VALUES ($1, 'assistant', $2, NOW())`,
        [toPhone, memoryText]
      ).catch(e => console.error('[Order Lifecycle] Failed to log to chat memory:', e.message));

      return { success: true, msgId };
    } else {
      console.error(`[Order Lifecycle] ❌ Failed to send ${templateName} to ${toPhone}:`, JSON.stringify(data));
      return { success: false, error: data };
    }
  } catch (err) {
    console.error(`[Order Lifecycle] Error sending ${templateName}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Main lifecycle processor for any Shopify order
 * Handles: order_placed, order_shipped, out_for_delivery, order_delivered
 */
export async function processOrderLifecycle(order, triggerSource = 'webhook', incomingStoreDomain = '') {
  if (!order || !order.id) return { success: false, message: 'Invalid order' };

  // Resolve store domain
  let storeDomain = incomingStoreDomain || order.shop_domain || '';
  if (!storeDomain) {
    const url = order.order_status_url || '';
    if (url.includes('espon')) storeDomain = 'esponsports.myshopify.com';
    else if (url.includes('11fit') || url.includes('104305262673')) storeDomain = 'i2tu0d-jc.myshopify.com';
    else storeDomain = 'i2tu0d-jc.myshopify.com';
  }

  // 1. Extract phone numbers for indexing & WhatsApp
  const rawPhones = [
    order.customer?.phone,
    order.shipping_address?.phone,
    order.billing_address?.phone,
    order.phone
  ].filter(Boolean);

  const uniqueLast10s = [];
  rawPhones.forEach(p => {
    const clean = String(p).replace(/\D/g, '');
    if (clean.length >= 10) {
      const last10 = clean.slice(-10);
      if (!uniqueLast10s.includes(last10)) uniqueLast10s.push(last10);
    }
  });

  const phone_last10 = uniqueLast10s[0] || null;
  const alt_phone_last10 = uniqueLast10s[1] || null;
  const waPhone = formatToWhatsAppPhone(rawPhones[0]);

  // Customer Name
  const firstName = (order.shipping_address?.first_name || order.customer?.first_name || 'Customer').trim();
  const lastName = (order.shipping_address?.last_name || order.customer?.last_name || '').trim();
  const customer_name = `${firstName} ${lastName}`.trim() || 'Customer';

  // Fulfillments & Tracking
  const fulfillments = order.fulfillments || [];
  const activeFulfillment = fulfillments.find(f => f.status === 'success') || fulfillments[0] || null;
  const tracking_number = activeFulfillment?.tracking_number || null;
  const tracking_company = activeFulfillment?.tracking_company || null;
  const tracking_url = activeFulfillment?.tracking_url || (activeFulfillment?.tracking_urls && activeFulfillment.tracking_urls[0]) || null;
  const shipment_status = (activeFulfillment?.shipment_status || '').toLowerCase();

  // Payment Calculation
  const totalPrice = parseFloat(order.total_price || 0);
  const totalOutstanding = parseFloat(order.total_outstanding || 0);
  const paymentGateways = (order.payment_gateway_names || [order.payment_gateway || '']).join(' ').toLowerCase();
  const advanceMatch = order.tags?.match?.(/Advance_Paid_([0-9.]+)/i);

  let paymentInfo = '';
  let paymentType = 'prepaid';
  if (advanceMatch) {
    const advancePaid = advanceMatch[1];
    const balanceDue = (totalPrice - parseFloat(advancePaid)).toFixed(2);
    paymentInfo = `₹${balanceDue} Due (Advance ₹${advancePaid} paid)`;
    paymentType = 'advance';
  } else if (paymentGateways.includes('cash') || paymentGateways.includes('cod') || totalOutstanding >= (totalPrice * 0.8)) {
    paymentInfo = `₹${totalPrice.toFixed(2)} (COD)`;
    paymentType = 'cod';
  } else {
    paymentInfo = `₹${totalPrice.toFixed(2)} (Prepaid)`;
    paymentType = 'prepaid';
  }

  // Address
  const address = order.shipping_address
    ? `${order.shipping_address.address1 || ''}, ${order.shipping_address.city || ''}, ${order.shipping_address.province || ''} ${order.shipping_address.zip || ''}`.replace(/^,\s*/, '').replace(/,\s*$/, '').trim()
    : 'Address on file';

  // Line Items Summary
  const lineItems = order.line_items || [];
  const itemsText = lineItems.slice(0, 3).map(i => {
    const variant = i.variant_title && i.variant_title !== 'Default Title' ? ` (${i.variant_title})` : '';
    return `${i.title}${variant} x${i.quantity}`;
  }).join(', ') + (lineItems.length > 3 ? ` +${lineItems.length - 3} more` : '');

  const orderName = order.name || `#${order.order_number}`;

  // 2. Fetch or initialize notifications_sent from shopify_orders
  let notifications_sent = {};
  try {
    const existingRes = await poolEditor.query(
      `SELECT notifications_sent FROM shopify_orders WHERE id = $1`,
      [order.id]
    );
    if (existingRes.rows.length > 0 && existingRes.rows[0].notifications_sent) {
      notifications_sent = existingRes.rows[0].notifications_sent;
    }
  } catch (err) {
    console.warn('[Order Lifecycle] Could not read existing notifications_sent:', err.message);
  }

  // 3. Upsert order into shopify_orders with store_domain
  try {
    await poolEditor.query(`
      INSERT INTO shopify_orders (
        id, order_number, name, phone_last10, alt_phone_last10, customer_name,
        total_price, fulfillment_status, cancelled_at, tracking_number,
        tracking_company, tracking_url, order_data, notifications_sent, store_domain,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      ON CONFLICT (id) DO UPDATE SET
        fulfillment_status = EXCLUDED.fulfillment_status,
        cancelled_at = EXCLUDED.cancelled_at,
        tracking_number = COALESCE(EXCLUDED.tracking_number, shopify_orders.tracking_number),
        tracking_company = COALESCE(EXCLUDED.tracking_company, shopify_orders.tracking_company),
        tracking_url = COALESCE(EXCLUDED.tracking_url, shopify_orders.tracking_url),
        order_data = EXCLUDED.order_data,
        notifications_sent = COALESCE(shopify_orders.notifications_sent, '{}'::jsonb) || EXCLUDED.notifications_sent,
        store_domain = COALESCE(EXCLUDED.store_domain, shopify_orders.store_domain),
        updated_at = NOW()
    `, [
      order.id,
      order.order_number,
      orderName,
      phone_last10,
      alt_phone_last10,
      customer_name,
      totalPrice,
      order.fulfillment_status || null,
      order.cancelled_at || null,
      tracking_number,
      tracking_company,
      tracking_url,
      JSON.stringify(order),
      JSON.stringify(notifications_sent),
      storeDomain,
      order.created_at || new Date().toISOString()
    ]);
  } catch (dbErr) {
    console.error('[Order Lifecycle] Error upserting shopify_orders:', dbErr.message);
  }

  // 4. Upsert customer address into network_users
  if (waPhone && order.shipping_address) {
    const { address1, address2, city, province, zip, country } = order.shipping_address;
    try {
      await poolEditor.query(`
        INSERT INTO network_users (
          phone, first_name, last_name, address1, address2, city, province, zip, country, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT (phone) DO UPDATE SET
          first_name = COALESCE(EXCLUDED.first_name, network_users.first_name),
          last_name = COALESCE(EXCLUDED.last_name, network_users.last_name),
          address1 = COALESCE(EXCLUDED.address1, network_users.address1),
          address2 = COALESCE(EXCLUDED.address2, network_users.address2),
          city = COALESCE(EXCLUDED.city, network_users.city),
          province = COALESCE(EXCLUDED.province, network_users.province),
          zip = COALESCE(EXCLUDED.zip, network_users.zip),
          country = COALESCE(EXCLUDED.country, network_users.country),
          updated_at = NOW()
      `, [`+${waPhone}`, firstName, lastName, address1, address2, city, province, zip, country]);
    } catch (uErr) {
      console.warn('[Order Lifecycle] Could not upsert network_users:', uErr.message);
    }
  }

  // 5. Mark checkout_sessions as completed in checkout database (only on fresh webhooks)
  if (triggerSource !== 'background_poller') {
    try {
      const checkoutToken = order.checkout_token || order.cart_token || null;
      const queryArgs = [];
      const whereClauses = [];

      if (checkoutToken) {
        queryArgs.push(checkoutToken);
        whereClauses.push(`cart_details->>'token' = $${queryArgs.length}`);
      }
      if (phone_last10) {
        queryArgs.push(phone_last10);
        whereClauses.push(`phone LIKE '%' || $${queryArgs.length} || '%'`);
      }

      if (whereClauses.length > 0) {
        await poolCheckout.query(`
          UPDATE checkout_sessions 
          SET status = 'completed', updated_at = NOW()
          WHERE status = 'abandoned' AND (${whereClauses.join(' OR ')})
        `, queryArgs);
      }
    } catch (chkErr) {
      console.warn('[Order Lifecycle] Note: Could not update checkout_sessions:', chkErr.message);
    }
  }

  // 6. Check workflow settings and credentials (cached for 60s)
  const settings = await getCachedSettings();

  let waToken = settings.whatsapp_token;
  let phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1189183190949431';
  let workflows = settings.workflows || {};

  // Strict store isolation: only send from 11FIT bot if order belongs to 11FIT!
  if (storeDomain !== 'i2tu0d-jc.myshopify.com') {
    try {
      const mRes = await poolEditor.query(
        `SELECT payment_settings FROM saas_merchants WHERE shopify_store_url = $1 AND is_active = true LIMIT 1`,
        [storeDomain]
      );
      const ps = mRes.rows[0]?.payment_settings || {};
      if (ps.wa_phone_number_id && ps.wa_access_token) {
        phoneId = ps.wa_phone_number_id;
        waToken = ps.wa_access_token;
      } else {
        console.log(`[Order Lifecycle] Skipping WhatsApp dispatch: Order belongs to ${storeDomain}, not 11FIT, and no dedicated WhatsApp credentials found.`);
        return { success: true, message: `Order #${order.order_number} saved for ${storeDomain}, WhatsApp dispatch skipped (isolated from 11FIT bot)` };
      }
    } catch (mErr) {
      console.warn('[Order Lifecycle] Error looking up merchant credentials for foreign store:', mErr.message);
      return { success: true, message: `Order #${order.order_number} saved, WhatsApp dispatch skipped` };
    }
  }

  if (!waToken || !waPhone) {
    return { success: true, message: 'Processed DB sync without WhatsApp dispatch (no token or phone)' };
  }

  // Do not send notifications for cancelled orders
  if (order.cancelled_at) {
    return { success: true, message: 'Order is cancelled, skipping WhatsApp workflows' };
  }

  const orderAgeHours = (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60);
  const fulfillmentDate = activeFulfillment?.created_at || order.updated_at || order.created_at;
  const fulfillmentAgeHours = (Date.now() - new Date(fulfillmentDate).getTime()) / (1000 * 60 * 60);

  let updatedNotifications = { ...notifications_sent };
  let notificationTriggered = null;

  // ── WORKFLOW A: ORDER DELIVERED ─────────────────────────────
  if (
    (shipment_status === 'delivered' || order.fulfillment_status === 'delivered') &&
    !notifications_sent.order_delivered &&
    workflows.order_delivered !== false &&
    fulfillmentAgeHours <= 48
  ) {
    console.log(`[Order Lifecycle] Triggering ORDER_DELIVERED for Order ${orderName} (${waPhone})...`);
    const sent = await sendWhatsAppTemplate({
      toPhone: waPhone,
      templateName: 'order_delivered_confirm_v1',
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: firstName },
          { type: 'text', text: orderName }
        ]
      }],
      waToken,
      phoneId,
      orderNumber: order.order_number,
      summaryText: 'Delivered successfully 🎉'
    });

    if (sent.success) {
      updatedNotifications.order_delivered = new Date().toISOString();
      notificationTriggered = 'order_delivered';
    }
  }

  // ── WORKFLOW B: OUT FOR DELIVERY ────────────────────────────
  else if (
    shipment_status === 'out_for_delivery' &&
    !notifications_sent.out_for_delivery &&
    workflows.out_for_delivery !== false &&
    fulfillmentAgeHours <= 24
  ) {
    console.log(`[Order Lifecycle] Triggering OUT_FOR_DELIVERY for Order ${orderName} (${waPhone})...`);
    const trackingMsg = tracking_url ? `Track here: ${tracking_url}` : 'Your package is arriving today.';
    const deliveryPaymentInfo = paymentType === 'cod'
      ? `₹${totalPrice.toFixed(2)} (COD - Please keep cash/UPI ready)`
      : 'Prepaid (No payment required)';

    const sent = await sendWhatsAppTemplate({
      toPhone: waPhone,
      templateName: 'out_for_delivery_v2',
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: firstName },
          { type: 'text', text: orderName },
          { type: 'text', text: trackingMsg },
          { type: 'text', text: deliveryPaymentInfo }
        ]
      }],
      waToken,
      phoneId,
      orderNumber: order.order_number,
      summaryText: `Out for Delivery • ${deliveryPaymentInfo}`
    });

    if (sent.success) {
      updatedNotifications.out_for_delivery = new Date().toISOString();
      notificationTriggered = 'out_for_delivery';
    }
  }

  // ── WORKFLOW C: ORDER SHIPPED ───────────────────────────────
  else if (
    activeFulfillment &&
    activeFulfillment.status === 'success' &&
    (tracking_number || tracking_url) &&
    !notifications_sent.order_shipped &&
    workflows.order_shipped !== false &&
    shipment_status !== 'delivered' &&
    fulfillmentAgeHours <= 48
  ) {
    console.log(`[Order Lifecycle] Triggering ORDER_SHIPPED for Order ${orderName} (${waPhone})...`);
    const courierName = tracking_company || 'Courier';
    const statusText = `Shipped / In Transit 🚚 (via ${courierName})`;
    const trackDetail = `Tracking Number: ${tracking_number || 'Available soon'}${tracking_url ? `\nTrack your package live: ${tracking_url}` : ''}`;

    const sent = await sendWhatsAppTemplate({
      toPhone: waPhone,
      templateName: 'order_status_check_v1',
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: firstName },
          { type: 'text', text: orderName },
          { type: 'text', text: statusText },
          { type: 'text', text: trackDetail }
        ]
      }],
      waToken,
      phoneId,
      orderNumber: order.order_number,
      summaryText: `Shipped via ${courierName} (${tracking_number || 'Live Track'})`
    });

    if (sent.success) {
      updatedNotifications.order_shipped = new Date().toISOString();
      notificationTriggered = 'order_shipped';
    }
  }

  // ── WORKFLOW D: ORDER CONFIRMED / PLACED ─────────────────────
  if (
    !notifications_sent.order_placed &&
    workflows.order_placed !== false &&
    orderAgeHours <= 24
  ) {
    console.log(`[Order Lifecycle] Triggering ORDER_PLACED for Order ${orderName} (${waPhone})...`);
    const sent = await sendWhatsAppTemplate({
      toPhone: waPhone,
      templateName: 'order_confirmed_v2',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: firstName },
            { type: 'text', text: orderName },
            { type: 'text', text: itemsText || 'Your activewear items' },
            { type: 'text', text: paymentInfo },
            { type: 'text', text: address }
          ]
        },
        {
          type: 'button',
          sub_type: 'quick_reply',
          index: '0',
          parameters: [
            { type: 'payload', payload: 'track_order' }
          ]
        }
      ],
      waToken,
      phoneId,
      orderNumber: order.order_number,
      summaryText: `Confirmed • ${paymentInfo}`
    });

    if (sent.success) {
      updatedNotifications.order_placed = new Date().toISOString();
      notificationTriggered = 'order_placed';
    }
  }

  // 7. Save updated notifications_sent to DB
  if (notificationTriggered) {
    try {
      await poolEditor.query(`
        UPDATE shopify_orders 
        SET notifications_sent = $1, updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify(updatedNotifications), order.id]);
    } catch (saveErr) {
      console.error('[Order Lifecycle] Error saving notifications_sent:', saveErr.message);
    }
  }

  return {
    success: true,
    notificationTriggered,
    orderId: order.id,
    orderNumber: order.order_number
  };
}
