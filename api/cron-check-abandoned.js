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
      WHERE status = 'abandoned'
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
    for (const s of sessions) {
      const sid = String(s.id || s.cart_details?.token || '');
      if (!sid) continue;
      const rawPhone = s.phone || s.customer_phone || '';
      const phone10 = get10Digit(rawPhone);
      if (!phone10 || phone10.length < 10) continue;

      const checkRes = await client.query('SELECT id FROM notified_abandoned_carts WHERE id = $1', [sid]);
      if (checkRes.rows.length === 0) {
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
          amount: formattedPrice
        });

        // Record in table so we only notify once
        await client.query(
          'INSERT INTO notified_abandoned_carts (id, phone, amount) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
          [sid, rawPhone, formattedPrice]
        );
      }
    }

    await client.end();

    // 5. Send Web Push to all subscribers for each new abandoned cart
    let notifResults = [];
    if (newCartsToNotify.length > 0) {
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
        const payload = JSON.stringify({
          title: '🛒 New 11FIT Abandoned Cart!',
          body: `Customer ${cart.phone} just added order worth ₹${cart.amount}!`,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: `cart-${cart.id}`,
          renotify: true,
          requireInteraction: true,
          vibrate: [300, 100, 300, 100, 300],
          data: { url: '/?tab=abandoned' }
        });

        const results = await Promise.allSettled(
          subs.map(async ({ subscription }) => {
            try {
              await webpush.sendNotification(subscription, payload);
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
        notifResults.push({ id: cart.id, phone: cart.phone, totalSubscribers: subs.length, results: results.length });
      }
    }

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      newCartsCount: newCartsToNotify.length,
      newCarts: newCartsToNotify,
      pushResults: notifResults
    });
  } catch (error) {
    try { await client.end(); } catch (_) {}
    console.error('Cron Check Abandoned Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
