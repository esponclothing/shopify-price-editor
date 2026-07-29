export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(200).json({ summary: {} });
  }

  try {
    const dbRes = await fetch(
      `${supabaseUrl}/rest/v1/shopify_orders?select=phone_last10,name,fulfillment_status,order_data&phone_last10=not.is.null&order=created_at.desc`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!dbRes.ok) {
      return res.status(200).json({ summary: {} });
    }

    const rows = await dbRes.json();
    const summary = {};

    for (const row of rows) {
      const p = String(row.phone_last10 || '').replace(/\D/g, '');
      if (!p || p.length !== 10) continue;

      const oData = row.order_data || {};
      const isCancelled = !!(oData.cancelled_at);
      const rawStatus = row.fulfillment_status || oData.fulfillment_status || 'unfulfilled';
      const status = isCancelled ? 'cancelled' : (rawStatus === 'fulfilled' ? 'fulfilled' : 'unfulfilled');

      if (!summary[p]) {
        summary[p] = {
          has_order: true,
          latest_status: status,
          statuses: [status],
          cancelled: isCancelled,
          order_count: 1,
          latest_order: row.name || ''
        };
      } else {
        summary[p].order_count += 1;
        if (!summary[p].statuses.includes(status)) {
          summary[p].statuses.push(status);
        }
        if (isCancelled) {
          summary[p].cancelled = true;
        }
      }
    }

    return res.status(200).json({ summary });
  } catch (err) {
    console.error('shopify-orders-summary error:', err);
    return res.status(200).json({ summary: {}, error: err.message });
  }
}
