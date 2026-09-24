import { processOrderLifecycle, poolEditor } from './order-lifecycle-service.js';

const POLL_INTERVAL_MS = 15 * 60 * 1000; // Run every 15 minutes to preserve Railway CPU & bandwidth
const processedOrderSignatures = new Map(); // Cache order.id -> signature to prevent redundant DB writes

export async function runOrderLifecycleSync() {
  try {
    const mRes = await poolEditor.query(`
      SELECT shopify_store_url, shopify_access_token 
      FROM saas_merchants 
      WHERE (shopify_store_url LIKE '%11fit%' OR shopify_store_url LIKE '%i2tu0d%' OR name ILIKE '%11fit%')
        AND is_active = true 
        AND shopify_access_token IS NOT NULL
      LIMIT 5;
    `);

    if (mRes.rows.length === 0) return;

    for (const merchant of mRes.rows) {
      const storeUrl = merchant.shopify_store_url;
      const token = merchant.shopify_access_token;
      if (!storeUrl || !token) continue;

      try {
        const res = await fetch(`https://${storeUrl}/admin/api/2024-04/orders.json?status=any&limit=10`, {
          headers: { 'X-Shopify-Access-Token': token }
        });

        if (!res.ok) {
          console.warn(`[Order Poller Worker] Shopify API returned ${res.status} for ${storeUrl}`);
          continue;
        }

        const data = await res.json();
        const orders = data.orders || [];

        let newOrUpdatedCount = 0;
        for (const order of orders) {
          try {
            // Build signature based on order id, updated_at, financial_status, fulfillment_status, shipment_status
            const fulfillment = (order.fulfillments && order.fulfillments[0]) || {};
            const signature = `${order.updated_at || ''}_${order.financial_status || ''}_${order.fulfillment_status || ''}_${fulfillment.shipment_status || ''}_${fulfillment.tracking_number || ''}`;

            const prevSignature = processedOrderSignatures.get(order.id);
            if (prevSignature === signature) {
              // No changes detected since last poll, skip DB queries & WhatsApp checks
              continue;
            }

            newOrUpdatedCount++;
            await processOrderLifecycle(order, 'background_poller');
            processedOrderSignatures.set(order.id, signature);
          } catch (itemErr) {
            console.error(`[Order Poller Worker] Error processing order #${order.order_number}:`, itemErr.message);
          }
        }

        if (newOrUpdatedCount > 0) {
          console.log(`[Order Poller Worker] Processed ${newOrUpdatedCount} updated/new orders for ${storeUrl}`);
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
  console.log('[Order Lifecycle Worker] 🚀 Starting Order Lifecycle Background Worker (Interval: 15 minutes)...');
  
  // Initial check 30 seconds after server boot
  setTimeout(() => {
    runOrderLifecycleSync().catch(console.error);
  }, 30000);

  // Recurring checks every 15 minutes
  setInterval(() => {
    runOrderLifecycleSync().catch(console.error);
  }, POLL_INTERVAL_MS);
}
