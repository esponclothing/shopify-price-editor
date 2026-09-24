import webpush from 'web-push';
import { dbFetch } from './dbFetch.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BIqLUY30-N9qSJrCz4tF1C65XgCRVyr-1TmiCTG2MNFL2_8_EAC4o626ehSdKSM5uUpNPJvpcNCjwOen8evAjRU';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'MJiZ0ppPI4Jx1RM43ryneCtprRbgnsaSGnBmCooFqN0';

try {
  webpush.setVapidDetails(
    'mailto:admin@11fit.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} catch (e) {
  console.warn('[Push Service] VAPID initialization warning:', e.message);
}

export async function broadcastPushNotification({ title, body, tag = '11fit-alert', data = { url: '/' }, vibrate = [300, 100, 300, 100, 300] }) {
  try {
    const subRes = await dbFetch('/rest/v1/push_subscriptions?select=subscription');
    const subs = subRes.data || [];
    if (subs.length === 0) {
      return { success: true, delivered: 0, total: 0 };
    }

    const payload = JSON.stringify({
      title: title || '🔔 11FIT Alert',
      body: body || 'New update available',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag,
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate,
      data
    });

    const results = await Promise.allSettled(
      subs.map(async ({ subscription }) => {
        try {
          const subObj = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
          await webpush.sendNotification(subObj, payload);
          return true;
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription expired or unregistered -> remove from Railway DB
            const ep = typeof subscription === 'string' ? JSON.parse(subscription)?.endpoint : subscription?.endpoint;
            if (ep) {
              await dbFetch(`/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(ep)}`, {
                method: 'DELETE'
              }).catch(() => {});
            }
          }
          throw err;
        }
      })
    );

    const delivered = results.filter(r => r.status === 'fulfilled').length;
    console.log(`[Push Service] Broadcast "${title}" -> ${delivered}/${subs.length} delivered to PC & Mobile`);
    return { success: true, delivered, total: subs.length };
  } catch (err) {
    console.error('[Push Service] Broadcast error:', err.message);
    return { success: false, error: err.message };
  }
}
