import webpush from 'web-push';
import axios from 'axios';

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

// Ensure the push_subscriptions table exists
async function ensureTable() {
  try {
    await axios.post(
      `${SUPABASE_URL}/rest/v1/rpc/exec`,
      { query: `CREATE TABLE IF NOT EXISTS push_subscriptions (id BIGSERIAL PRIMARY KEY, endpoint TEXT UNIQUE NOT NULL, subscription JSONB NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())` },
      { headers: supabaseHeaders }
    );
  } catch (_) {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/webpush?action=vapid-public-key — return public key to client
  if (req.method === 'GET' && req.query.action === 'vapid-public-key') {
    return res.status(200).json({ publicKey: VAPID_PUBLIC_KEY });
  }

  // POST /api/webpush — save a push subscription
  if (req.method === 'POST' && req.body?.action === 'subscribe') {
    const { subscription } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ error: 'No subscription' });

    try {
      await axios.post(
        `${SUPABASE_URL}/rest/v1/push_subscriptions`,
        { endpoint: subscription.endpoint, subscription },
        { headers: { ...supabaseHeaders, 'Prefer': 'resolution=merge-duplicates' } }
      );
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Save subscription error:', err.response?.data || err.message);
      return res.status(500).json({ error: 'Failed to save subscription' });
    }
  }

  // POST /api/webpush — send notification to all subscribers
  if (req.method === 'POST' && req.body?.action === 'notify') {
    const { title, body, data } = req.body;
    try {
      const subRes = await axios.get(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?select=subscription`,
        { headers: supabaseHeaders }
      );
      const subs = subRes.data || [];
      if (subs.length === 0) return res.status(200).json({ sent: 0 });

      const payload = JSON.stringify({
        title: title || '💬 11FIT: New WhatsApp Message',
        body: body || 'A customer sent you a message',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: data || { url: '/' }
      });

      const results = await Promise.allSettled(
        subs.map(async ({ subscription }) => {
          try {
            await webpush.sendNotification(subscription, payload);
          } catch (err) {
            // 410 Gone = subscription expired, remove it
            if (err.statusCode === 410) {
              await axios.delete(
                `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`,
                { headers: supabaseHeaders }
              ).catch(() => {});
            }
          }
        })
      );

      return res.status(200).json({ sent: subs.length, results: results.length });
    } catch (err) {
      console.error('Notify error:', err.response?.data || err.message);
      return res.status(500).json({ error: 'Failed to send notifications' });
    }
  }

  // DELETE /api/webpush — unsubscribe
  if (req.method === 'POST' && req.body?.action === 'unsubscribe') {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'No endpoint' });
    try {
      await axios.delete(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
        { headers: supabaseHeaders }
      );
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to unsubscribe' });
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
}
