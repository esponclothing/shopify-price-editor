import pg from 'pg';
const { Pool } = pg;

// Database connection to Shopify-Price-Editor DB (whatsapp_settings, shopify_orders, whatsapp_chat_memory)
const poolEditor = new Pool({
  connectionString: process.env.RAILWAY_DATABASE_URL || 'postgresql://postgres:gEeINngvmFomRYZljhTrKNkKrrjlcrfQ@altaria.proxy.rlwy.net:33107/railway',
  ssl: { rejectUnauthorized: false }
});

// Database connection to checkout-app DB (checkout_sessions, network_users)
const poolCheckout = new Pool({
  connectionString: process.env.CHECKOUT_DATABASE_URL || 'postgresql://postgres:zXuyDwmBoMwdHnUqoFMUIkkKILuEcaas@reseau.proxy.rlwy.net:12168/railway',
  ssl: { rejectUnauthorized: false }
});

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '1189183190949431';

let isProcessing = false;

export async function processAbandonedCarts() {
  if (isProcessing) {
    console.log('[Auto Ab Cart] Previous run still in progress. Skipping...');
    return;
  }

  isProcessing = true;

  try {
    // 1. Check whatsapp_settings to see if workflow is enabled and get token
    const sRes = await poolEditor.query('SELECT whatsapp_token, waba_id, workflows FROM whatsapp_settings LIMIT 1');
    const settings = sRes.rows[0];

    if (!settings || !settings.whatsapp_token) {
      console.log('[Auto Ab Cart] WhatsApp token not configured in whatsapp_settings. Skipping.');
      return;
    }

    const workflows = settings.workflows || {};
    if (workflows.abandoned_cart === false) {
      console.log('[Auto Ab Cart] Abandoned cart workflow is disabled in settings. Skipping.');
      return;
    }

    const metaToken = settings.whatsapp_token;

    // 2. Query eligible abandoned sessions (older than 15 mins, newer than 24 hours, not yet sent)
    const sessionsRes = await poolCheckout.query(`
      SELECT id, draft_order_id, phone, cart_details, created_at, updated_at 
      FROM checkout_sessions 
      WHERE status = 'abandoned' 
        AND phone IS NOT NULL 
        AND phone != '' 
        AND phone != 'MASKED'
        AND (cart_details->>'recovery_sent' IS NULL OR cart_details->>'recovery_sent' = 'false')
        AND updated_at <= NOW() - INTERVAL '15 minutes'
        AND updated_at >= NOW() - INTERVAL '24 hours'
      ORDER BY updated_at DESC 
      LIMIT 10;
    `);

    const sessions = sessionsRes.rows || [];
    if (sessions.length === 0) {
      return;
    }

    console.log(`[Auto Ab Cart] Found ${sessions.length} eligible abandoned carts to process.`);

    for (const session of sessions) {
      try {
        let cleanPhone = String(session.phone).replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
        if (cleanPhone.startsWith('0') && cleanPhone.length === 11) cleanPhone = '91' + cleanPhone.slice(1);

        if (cleanPhone.length < 10) {
          await markSession(session.id, 'invalid_phone');
          continue;
        }

        const phoneLast10 = cleanPhone.slice(-10);

        // 3. Check if customer placed an order after abandonment
        const orderCheck = await poolEditor.query(
          'SELECT id, name FROM shopify_orders WHERE (phone_last10 = $1 OR alt_phone_last10 = $1) AND created_at >= $2 LIMIT 1',
          [phoneLast10, session.created_at]
        );

        if (orderCheck.rows.length > 0) {
          console.log(`[Auto Ab Cart] Customer ${cleanPhone} already placed order ${orderCheck.rows[0].name} afterwards. Skipping.`);
          await markSession(session.id, 'already_ordered');
          continue;
        }

        // 4. Resolve customer name
        let customerName = session.cart_details?.customer_name 
          || session.cart_details?.shipping_address?.first_name 
          || null;

        if (!customerName) {
          try {
            const userRes = await poolCheckout.query(
              'SELECT first_name FROM network_users WHERE phone LIKE $1 LIMIT 1',
              [`%${phoneLast10}%`]
            );
            if (userRes.rows.length > 0 && userRes.rows[0].first_name) {
              customerName = userRes.rows[0].first_name;
            }
          } catch (e) {}
        }

        const firstName = (customerName || 'there').trim().split(' ')[0];

        // 5. Resolve amount
        const rawAmount = session.cart_details?.total_price || session.cart_details?.order_amount || 0;
        let formattedAmount = 'your items';
        if (rawAmount) {
          if (String(rawAmount).includes('.')) {
            formattedAmount = Math.round(parseFloat(rawAmount)).toLocaleString('en-IN');
          } else if (rawAmount > 10000) {
            formattedAmount = Math.round(rawAmount / 100).toLocaleString('en-IN');
          } else {
            formattedAmount = Math.round(rawAmount).toLocaleString('en-IN');
          }
        }

        // 6. Resolve product handle for button URL
        const items = session.cart_details?.items || session.cart_details?.line_items || [];
        let productHandle = 'all';
        if (items.length > 0) {
          if (items[0].handle) {
            productHandle = items[0].handle;
          } else if (items[0].title) {
            const rawTitle = items[0].title.split(' - ')[0];
            productHandle = rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'all';
          }
        }

        // 7. Send WhatsApp Meta Template: abandoned_cart_v4
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'template',
          template: {
            name: 'abandoned_cart_v4',
            language: { code: 'en_US' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: firstName },
                  { type: 'text', text: formattedAmount }
                ]
              },
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [
                  { type: 'text', text: productHandle }
                ]
              }
            ]
          }
        };

        const metaRes = await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${metaToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const metaData = await metaRes.json();

        if (metaRes.ok && metaData.messages && metaData.messages[0]?.id) {
          const msgId = metaData.messages[0].id;
          console.log(`[Auto Ab Cart] ✓ Sent abandoned_cart_v4 to ${cleanPhone} (₹${formattedAmount}) → MsgID: ${msgId}`);

          // Mark session as sent in checkout DB
          await markSession(session.id, 'true', msgId);

          // Log in whatsapp_chat_memory so it appears in WhatsApp AI Inbox
          try {
            const memoryText = `🛒 *[Auto Template: abandoned_cart_v4]*\nAbandoned Cart Recovery sent for cart value ₹${formattedAmount}\nProduct: /products/${productHandle}`;
            await poolEditor.query(`
              INSERT INTO whatsapp_chat_memory (phone, role, content, created_at)
              VALUES ($1, 'assistant', $2, NOW())
            `, [cleanPhone, memoryText]);
          } catch (memErr) {
            console.warn('[Auto Ab Cart] Failed to log chat memory:', memErr.message);
          }

        } else {
          console.error(`[Auto Ab Cart] ✗ Meta API error for ${cleanPhone}:`, JSON.stringify(metaData));
          await markSession(session.id, 'failed', null, metaData.error?.message || 'Meta error');
        }

      } catch (itemErr) {
        console.error(`[Auto Ab Cart] Error processing session ${session.id}:`, itemErr);
      }
    }

  } catch (err) {
    console.error('[Auto Ab Cart] Global worker error:', err);
  } finally {
    isProcessing = false;
  }
}

async function markSession(sessionId, recoveryStatus, msgId = null, errorMsg = null) {
  try {
    await poolCheckout.query(`
      UPDATE checkout_sessions 
      SET cart_details = jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(cart_details, '{}'::jsonb), 
            '{recovery_sent}', 
            to_jsonb($2::text)
          ),
          '{recovery_sent_at}',
          to_jsonb(NOW()::text)
        ),
        '{recovery_msg_id}',
        to_jsonb($3::text)
      ),
      updated_at = NOW()
      WHERE id = $1
    `, [sessionId, recoveryStatus, msgId || errorMsg || '']);
  } catch (e) {
    console.warn(`[Auto Ab Cart] Error updating session ${sessionId}:`, e.message);
  }
}

export function startAbandonedCartWorker() {
  console.log('[Auto Ab Cart] Initializing Abandoned Cart Background Worker (Interval: 2 minutes)...');
  // Initial run after 15 seconds of server boot
  setTimeout(() => {
    processAbandonedCarts().catch(err => console.error('[Auto Ab Cart] Boot run error:', err));
  }, 15000);

  // Recurring run every 2 minutes
  setInterval(() => {
    processAbandonedCarts().catch(err => console.error('[Auto Ab Cart] Interval run error:', err));
  }, 120000);
}
