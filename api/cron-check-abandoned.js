import pg from 'pg';
import webpush from 'web-push';
import axios from 'axios';

const { Client } = pg;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xkiukbebnntjzfilyfmh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BIqLUY30-N9qSJrCz4tF1C65XgCRVyr-1TmiCTG2MNFL2_8_EAC4o626ehSdKSM5uUpNPJvpcNCjwOen8evAjRU';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'MJiZ0ppPI4Jx1RM43ryneCtprRbgnsaSGnBmCooFqN0';

webpush.setVapidDetails(
  'mailto:admin@11fit.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const supabaseHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

const get10Digit = (ph) => {
  const s = String(ph || '').replace(/\D/g, '');
  return s.length >= 10 ? s.slice(-10) : s;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const dbUrl = process.env.SUPABASE_NFU_DB_URL || 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit@202612@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    await client.connect();

    // 1. Ensure notified_abandoned_carts table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS notified_abandoned_carts (
        id TEXT PRIMARY KEY,
        phone TEXT,
        amount TEXT,
        notified_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Check if table is currently empty (first run initialization)
    const countRes = await client.query('SELECT COUNT(*) as cnt FROM notified_abandoned_carts');
    const existingCount = parseInt(countRes.rows[0]?.cnt || '0', 10);

    // 3. Query latest abandoned checkouts from checkout_sessions
    const sessionsRes = await client.query(`
      SELECT * FROM checkout_sessions 
      WHERE status = 'abandoned' AND created_at < NOW() - INTERVAL '5 minutes'
      ORDER BY created_at DESC 
      LIMIT 25;
    `);
    const sessions = sessionsRes.rows || [];

    // If notified_abandoned_carts is empty, seed it with current checkouts silently so we don't spam old notifications
    if (existingCount === 0) {
      for (const s of sessions) {
        const sid = String(s.id || s.cart_details?.token || '');
        if (!sid) continue;
        const rawPhone = s.phone || s.customer_phone || '';
        const phone10 = get10Digit(rawPhone);
        if (!phone10 || phone10.length < 10) continue;
        const priceVal = s.cart_details?.total_price || s.amount || 0;
        await client.query(
          'INSERT INTO notified_abandoned_carts (id, phone, amount) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
          [sid, rawPhone, String(priceVal)]
        );
      }
      await client.end();
      return res.status(200).json({
        success: true,
        message: 'Initialized notified_abandoned_carts with existing checkouts (no push sent).',
        seededCount: sessions.length
      });
    }

    // 4. Check for newly added checkouts not in notified_abandoned_carts
    const newCartsToNotify = [];
    const notifiedPhonesInThisRun = new Set();

    for (const s of sessions) {
      const sid = String(s.id || s.cart_details?.token || '');
      if (!sid) continue;
      const rawPhone = s.phone || s.customer_phone || '';
      const phone10 = get10Digit(rawPhone);
      if (!phone10 || phone10.length < 10) continue;

      // Skip if we already added a notification for this phone number in this loop
      if (notifiedPhonesInThisRun.has(phone10)) continue;

      // Check if this session ID OR this phone number was already notified within the last 24 hours
      const checkRes = await client.query(
        `SELECT id FROM notified_abandoned_carts 
         WHERE id = $1 OR (phone LIKE '%' || $2 || '%' AND notified_at > NOW() - INTERVAL '24 hours')`,
        [sid, phone10]
      );
      if (checkRes.rows.length === 0) {
        notifiedPhonesInThisRun.add(phone10);

        let priceVal = s.cart_details?.total_price || s.cart_details?.items_subtotal_price || s.amount || 0;
        let numPrice = Number(priceVal);
        let formattedPrice = '0.00';
        if (numPrice > 1000 && !String(priceVal || '').includes('.')) {
          formattedPrice = (numPrice / 100).toFixed(2);
        } else {
          formattedPrice = numPrice.toFixed(2);
        }

        newCartsToNotify.push({
          id: sid,
          phone: rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`,
          amount: formattedPrice,
          first_name: (s.cart_details?.customer?.first_name || s.cart_details?.shipping_address?.first_name || '').trim() || 'there'
        });

        // Record in table so we only notify once
        await client.query(
          'INSERT INTO notified_abandoned_carts (id, phone, amount) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
          [sid, rawPhone, formattedPrice]
        );
      }
    }

    await client.end();

    // -----------------------------------------------------------------------
    // 5. For each new cart: send WhatsApp template + Web Push admin notification
    // -----------------------------------------------------------------------
    let notifResults = [];

    if (newCartsToNotify.length > 0) {
      // Fetch WA settings (token, phone_number_id) from Supabase
      let waToken = null;
      let workflows = { abandoned_cart: true };
      try {
        const settingsRes = await axios.get(
          `${SUPABASE_URL}/rest/v1/whatsapp_settings?select=whatsapp_token,workflows&order=id.desc&limit=1`,
          { headers: supabaseHeaders }
        );
        const row = settingsRes.data?.[0] || {};
        waToken = row.whatsapp_token || null;
        workflows = row.workflows || { abandoned_cart: true };
      } catch (err) {
        console.warn('Could not load WA settings for cron:', err.message);
      }

      const WA_PHONE_ID = '1189183190949431'; // 11FIT verified +91 74949 61428

      // Fetch push subscriptions for admin notification
      let subs = [];
      try {
        const subRes = await axios.get(
          `${SUPABASE_URL}/rest/v1/push_subscriptions?select=subscription`,
          { headers: supabaseHeaders }
        );
        subs = subRes.data || [];
      } catch (err) {
        console.warn('Could not load push subscriptions:', err.message);
      }

      for (const cart of newCartsToNotify) {
        const cartResult = { id: cart.id, phone: cart.phone, waSent: false, waError: null, pushSent: 0 };

        // --- A. Send WhatsApp abandoned_cart_v2 to CUSTOMER ---
        if (waToken && workflows?.abandoned_cart !== false) {
          try {
            // Format phone: remove all non-digits, ensure starts with 91
            let rawDigits = String(cart.phone || '').replace(/\D/g, '');
            if (rawDigits.length === 10) rawDigits = '91' + rawDigits;
            if (rawDigits.length === 12 && !rawDigits.startsWith('91')) rawDigits = '91' + rawDigits.slice(-10);

            // Extract customer name
            const firstName = cart.first_name || 'there';

            await axios.post(
              `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`,
              {
                messaging_product: 'whatsapp',
                to: rawDigits,
                type: 'template',
                template: {
                  name: 'abandoned_cart_v2',
                  language: { code: 'en_US' },
                  components: [
                    {
                      type: 'body',
                      parameters: [
                        { type: 'text', text: firstName },
                        { type: 'text', text: cart.amount }
                      ]
                    }
                  ]
                }
              },
              {
                headers: {
                  'Authorization': `Bearer ${waToken}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            cartResult.waSent = true;
            console.log(`[WA] Sent abandoned_cart_v2 to ${rawDigits} (Cart ID: ${cart.id})`);
          } catch (err) {
            cartResult.waError = err.response?.data?.error?.message || err.message;
            console.warn(`[WA] Failed to send to ${cart.phone}:`, cartResult.waError);
          }
        }

        // --- B. Web Push admin notification ---
        const pushPayload = JSON.stringify({
          title: '🛒 New 11FIT Abandoned Cart!',
          body: `Customer ${cart.phone} • ₹${cart.amount}${cartResult.waSent ? ' • ✅ WA Sent' : ''}`,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: `cart-${cart.id}`,
          renotify: true,
          requireInteraction: true,
          vibrate: [300, 100, 300, 100, 300],
          data: { url: '/?tab=abandoned' }
        });

        let pushCount = 0;
        await Promise.allSettled(
          subs.map(async ({ subscription }) => {
            try {
              await webpush.sendNotification(subscription, pushPayload);
              pushCount++;
            } catch (err) {
              if (err.statusCode === 410) {
                await axios.delete(
                  `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`,
                  { headers: supabaseHeaders }
                ).catch(() => {});
              }
            }
          })
        );
        cartResult.pushSent = pushCount;
        notifResults.push(cartResult);
      }
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      newCartsCount: newCartsToNotify.length,
      newCarts: newCartsToNotify,
      results: notifResults
    });
  } catch (error) {
    try { await client.end(); } catch (_) {}
    console.error('Cron Check Abandoned Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

