import { processOrderLifecycle, poolEditor } from './order-lifecycle-service.js';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // Run every 5 minutes

export async function runOrderLifecycleSync() {
  try {
    const mRes = await poolEditor.query(`
      SELECT shopify_store_url, shopify_access_token 
      FROM saas_merchants 
      WHERE (shopify_store_url LIKE '%11fit%' OR shopify_store_url LIKE '%i2tu0d%' OR name ILIKE '%11fit%')
        AND is_active = true 
        AND shopify_access_token IS NOT NULL
    `);

    console.log('[Poller] Merchants found:', mRes.rows.length);
    for (const merchant of mRes.rows) {
      const storeUrl = merchant.shopify_store_url;
      const token = merchant.shopify_access_token;
      if (!storeUrl || !token) continue;

      try {
        console.log(`[Poller] Fetching recent orders from ${storeUrl}...`);
        const res = await fetch(`https://${storeUrl}/admin/api/2024-04/orders.json?status=any&limit=15`, {
          headers: { 'X-Shopify-Access-Token': token }
        });

        if (!res.ok) {
          console.warn(`[Order Poller Worker] Shopify API returned ${res.status} for ${storeUrl}`);
          continue;
        }

        const data = await res.json();
        const orders = data.orders || [];
        console.log(`[Poller] Got ${orders.length} orders from ${storeUrl}`);

        for (const order of orders) {
          try {
            console.log(`[Poller] Processing #${order.order_number}...`);
            await processOrderLifecycle(order, 'background_poller');
          } catch (itemErr) {
            console.error(`[Order Poller Worker] Error processing order #${order.order_number}:`, itemErr.message);
          }
        }
      } catch (shopErr) {
        console.error(`[Order Poller Worker] Error checking orders for ${storeUrl}:`, shopErr.message);
      }
    }
  } catch (err) {
    console.error('[Order Poller Worker] Unexpected error:', err.message);
  }
}

export function startOrderLifecycleWorker() {
  console.log('[Order Lifecycle Worker] 🚀 Starting Order Lifecycle Background Worker (runs every 5m)...');
  
  // Initial check 10 seconds after server boot
  setTimeout(() => {
    runOrderLifecycleSync().catch(console.error);
  }, 10000);

  // Recurring checks every 5 minutes
  setInterval(() => {
    runOrderLifecycleSync().catch(console.error);
  }, POLL_INTERVAL_MS);
}
