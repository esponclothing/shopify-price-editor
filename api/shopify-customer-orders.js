import axios from 'axios';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-client-store-url, x-client-access-token'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const phone = req.query.phone;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }

  const cleanDigits = phone.toString().replace(/\D/g, '');
  const last10 = cleanDigits.slice(-10);

  if (!last10 || last10.length < 10) {
    return res.status(200).json({ orders: [] });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  const clientStore = req.headers['x-client-store-url'] || process.env.VITE_SHOPIFY_STORE_URL || 'i2tu0d-jc.myshopify.com';
  const clientToken = req.headers['x-client-access-token'] || process.env.VITE_SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ACCESS_TOKEN || '';

  let cleanStore = clientStore.trim();
  if (cleanStore.startsWith('https://')) cleanStore = cleanStore.replace('https://', '');
  if (cleanStore.startsWith('http://')) cleanStore = cleanStore.replace('http://', '');

  // STEP 1: ALWAYS TRY LIVE SHOPIFY API FIRST (~700ms) FOR 100% FRESH TRACKING & STATUS
  try {
    const custRes = await axios.get(
      `https://${cleanStore}/admin/api/2024-04/customers/search.json?query=${encodeURIComponent(last10)}`,
      {
        headers: {
          'X-Shopify-Access-Token': clientToken.trim(),
          'Content-Type': 'application/json'
        },
        timeout: 4500
      }
    ).catch(() => ({ data: { customers: [] } }));

    const customers = custRes.data?.customers || [];

    const orderPromises = customers.map(c =>
      axios.get(
        `https://${cleanStore}/admin/api/2024-04/customers/${c.id}/orders.json?status=any`,
        {
          headers: {
            'X-Shopify-Access-Token': clientToken.trim(),
            'Content-Type': 'application/json'
          },
          timeout: 4500
        }
      ).catch(() => ({ data: { orders: [] } }))
    );

    const results = await Promise.all(orderPromises);
    const orderMap = new Map();
    results.forEach(resObj => {
      (resObj.data?.orders || []).forEach(o => {
        orderMap.set(o.id, o);
      });
    });

    const finalOrders = Array.from(orderMap.values());
    finalOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (finalOrders.length > 0) {
      // Save/update live fetched orders into Supabase DB asynchronously
      if (supabaseUrl && supabaseKey) {
        Promise.all(finalOrders.map(o => {
          const customer_name = o.shipping_address
            ? `${o.shipping_address.first_name || ''} ${o.shipping_address.last_name || ''}`.trim()
            : (o.customer ? `${o.customer.first_name || ''} ${o.customer.last_name || ''}`.trim() : null);

          const fulfillment = (o.fulfillments && o.fulfillments.length > 0) ? o.fulfillments[0] : null;
          const tracking_number = fulfillment?.tracking_number || null;
          const tracking_company = fulfillment?.tracking_company || null;
          const tracking_url = fulfillment?.tracking_url || (fulfillment?.tracking_urls && fulfillment.tracking_urls[0]) || null;

          return fetch(`${supabaseUrl}/rest/v1/shopify_orders`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify({
              id: o.id,
              order_number: o.order_number,
              name: o.name || `#${o.order_number}`,
              phone_last10: last10,
              alt_phone_last10: null,
              customer_name,
              total_price: o.total_price || 0,
              fulfillment_status: o.fulfillment_status || null,
              cancelled_at: o.cancelled_at || null,
              tracking_number,
              tracking_company,
              tracking_url,
              order_data: o,
              created_at: o.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          }).catch(() => {});
        })).catch(() => {});
      }

      return res.status(200).json({ orders: finalOrders, source: 'shopify_live' });
    }
  } catch (err) {
    console.error('Live Shopify fetch error, falling back to database:', err.message);
  }

  // STEP 2: FALLBACK TO SUPABASE POSTGRES DATABASE IF SHOPIFY IS UNREACHABLE OR HAS NO MATCH
  if (supabaseUrl && supabaseKey) {
    try {
      const dbRes = await fetch(
        `${supabaseUrl}/rest/v1/shopify_orders?or=(phone_last10.eq.${last10},alt_phone_last10.eq.${last10})&order=created_at.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (dbRes.ok) {
        const rows = await dbRes.json();
        if (rows && rows.length > 0) {
          const orders = rows.map(r => {
            let data = r.order_data;
            if (typeof data === 'string') {
              try { data = JSON.parse(data); } catch (_) {}
            }
            if (data && typeof data === 'object') {
              data.id = data.id || r.id;
              data.created_at = data.created_at || r.created_at;
              data.name = data.name || r.name || (r.order_number ? `#${r.order_number}` : '#Order');
              data.order_number = data.order_number || r.order_number;
              data.total_price = data.total_price || r.total_price || 0;
              return data;
            }
            return r;
          });
          return res.status(200).json({ orders, source: 'database_fallback' });
        }
      }
    } catch (err) {
      console.error('Error reading shopify_orders from DB:', err);
    }
  }

  return res.status(200).json({ orders: [], source: 'empty' });
}
