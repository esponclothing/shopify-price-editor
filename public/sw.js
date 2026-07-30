// 11FIT WhatsApp AI — Service Worker
// Handles background PUSH events sent from the server via Web Push API
// This works even when the app is completely closed on PC and mobile

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ─── PUSH EVENT ─────────────────────────────────────────────────────────────
// This fires when the SERVER sends a Web Push notification.
// It works even if the browser/app is fully closed.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch (_) {
    payload = { title: '💬 11FIT: New WhatsApp Message', body: event.data?.text() || '' };
  }

  const title = payload.title || '💬 11FIT: New WhatsApp Message';
  const options = {
    body: payload.body || 'A customer sent you a message',
    icon: payload.icon || '/favicon.svg',
    badge: payload.badge || '/favicon.svg',
    tag: payload.tag || 'wa-new-msg',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: payload.vibrate || [300, 100, 300, 100, 300],
    data: payload.data || { url: '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── NOTIFICATION CLICK ──────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If app is already open in a tab, focus it
      const existing = clients.find(c => c.url.startsWith(self.location.origin));
      if (existing) {
        return existing.focus();
      }
      // Otherwise open a new window
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ─── MESSAGE FROM APP ────────────────────────────────────────────────────────
// The app can ask the SW to send a test notification (for permission check)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'TEST_NOTIFICATION') {
    self.registration.showNotification('✅ 11FIT Alerts Active', {
      body: '🔔 You will receive notifications even when this app is closed!',
      icon: '/favicon.svg',
      tag: 'test-notif',
      data: { url: '/' }
    });
  }
});
