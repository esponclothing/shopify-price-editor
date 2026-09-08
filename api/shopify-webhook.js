import { processOrderLifecycle, poolEditor } from './order-lifecycle-service.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let order = req.body;
  const topic = req.headers['x-shopify-topic'] || 'orders/create';

  if (!order || (!order.id && !order.order_id)) {
    return res.status(200).json({ message: 'No valid order payload found, ignoring' });
  }

  try {
    // If webhook received a fulfillment event with order_id, fetch the order from DB
    if (!order.line_items && order.order_id) {
      const parentOrderId = order.order_id;
      const dbRow = await poolEditor.query(
        'SELECT order_data FROM shopify_orders WHERE id = $1',
        [parentOrderId]
      );
      if (dbRow.rows.length > 0 && dbRow.rows[0].order_data) {
        let parentOrder = dbRow.rows[0].order_data;
        if (typeof parentOrder === 'string') {
          try { parentOrder = JSON.parse(parentOrder); } catch (_) {}
        }
        // Merge this fulfillment into parent fulfillments array
        if (!parentOrder.fulfillments) parentOrder.fulfillments = [];
        const existingFIdx = parentOrder.fulfillments.findIndex(f => f.id === order.id);
        if (existingFIdx >= 0) {
          parentOrder.fulfillments[existingFIdx] = { ...parentOrder.fulfillments[existingFIdx], ...order };
        } else {
          parentOrder.fulfillments.push(order);
        }
        order = parentOrder;
      }
    }

    const result = await processOrderLifecycle(order, topic);
    return res.status(200).json({ success: true, topic, result });
  } catch (err) {
    console.error('[Shopify Webhook] Error processing event:', err);
    return res.status(500).json({ error: 'Failed to process webhook', message: err.message });
  }
}
