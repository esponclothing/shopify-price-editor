import axios from './dbWrapper.js';
import { dbFetch } from './dbFetch.js';

// api/returns.js
// Return & Exchange Request API for 11fit
// Handles: create, list (customer+admin), update status, add tracking, photo upload

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
const RETURN_WINDOW_DAYS = 7; // 7 days from delivered date

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret, x-merchant-key, Authorization, Accept, X-Requested-With');
}

async function supabaseRequest(path, options = {}) {
  const url = `/rest/v1/${path}`; // Use relative path for shim
  const res = await dbFetch(url, options);
  // dbFetch shim already returns { ok, status, data }
  return res;
}

async function dispatchWhatsAppStatusNotification(request) {
  try {
    const { status, phone, order_name, return_tracking_company, return_tracking_url, exchange_tracking_company, exchange_tracking_url } = request;
    if (!phone) return;

    let templateName = null;
    let components = [];

    // Map status to template and build components
    if (status === 'pending') {
      templateName = 'return_request_received';
      components = [ { type: 'body', parameters: [{ type: 'text', text: order_name }] } ];
    } else if (status === 'approved') {
      templateName = 'return_request_approved';
      components = [ { type: 'body', parameters: [{ type: 'text', text: order_name }] } ];
    } else if (status === 'pickup_scheduled') {
      templateName = 'return_pickup_scheduled';
      components = [ 
        { type: 'body', parameters: [
          { type: 'text', text: order_name },
          { type: 'text', text: return_tracking_company || 'our courier' },
          { type: 'text', text: return_tracking_url || 'N/A' }
        ] } 
      ];
    } else if (status === 'exchange_shipped') {
      templateName = 'exchange_shipped';
      components = [ 
        { type: 'body', parameters: [
          { type: 'text', text: order_name },
          { type: 'text', text: exchange_tracking_company || 'our courier' },
          { type: 'text', text: exchange_tracking_url || 'N/A' }
        ] } 
      ];
    } else if (status === 'completed') {
      templateName = 'return_completed';
      components = [ { type: 'body', parameters: [{ type: 'text', text: order_name }] } ];
    }

    if (!templateName) return; // No notification for this status

    const setRes = await dbFetch(`/rest/v1/whatsapp_settings?select=whatsapp_token,phone_number_id,workflows&order=id.desc&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const row = (await setRes.json())[0] || {};
    const token = row.whatsapp_token || process.env.WHATSAPP_TOKEN || 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
    const phoneId = row.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID || '1189183190949431';
    
    // Check if the workflow is enabled for this template
    const workflows = row.workflows || {};
    if (workflows[templateName] === false) {
      console.log(`WhatsApp Notification skipped (workflow disabled): ${templateName} to ${phone}`);
      return;
    }

    const cleanPhone = String(phone).replace(/[^0-9]/g, '');
    const toPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const payload = {
      messaging_product: 'whatsapp',
      to: toPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en_US' },
        components: components
      }
    };

    await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`WhatsApp Notification sent: ${templateName} to ${toPhone}`);
  } catch (err) {
    console.error('WhatsApp Notification Error:', err.message);
  }
}

async function returnsHandler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const isAdmin = Boolean(
    req.headers['x-admin-secret'] ||
    req.query.admin_secret ||
    req.query.admin === 'true'
  );

  try {
    // ─────────────────────────────────────────────────────────────
    // GET: List requests
    // ─────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { phone, id, status, store, admin } = req.query;

      // Single request by ID
      if (id) {
        const { ok, data } = await supabaseRequest(
          `return_requests?id=eq.${encodeURIComponent(id)}&limit=1`,
          { method: 'GET' }
        );
        if (!ok) return res.status(500).json({ error: 'DB error', detail: data });
        if (!data?.length) return res.status(404).json({ error: 'Request not found' });
        return res.json({ success: true, request: data[0] });
      }

      // Admin: list all requests (with optional filter)
      if (admin === 'true') {
        if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });
        let query = `return_requests?order=created_at.desc`;
        if (status && status !== 'all') query += `&status=eq.${status}`;
        if (store) query += `&store=eq.${encodeURIComponent(store)}`;
        const { ok, data } = await supabaseRequest(query, { method: 'GET' });
        if (!ok) return res.status(500).json({ error: 'DB error', detail: data });
        return res.json({ success: true, requests: data || [] });
      }

      // Customer: list by phone
      if (phone) {
        const cleanDigits = phone.replace(/\D/g, '');
        const last10 = cleanDigits.slice(-10);
        const phoneFormatted = `+91${last10}`;
        const { ok, data } = await supabaseRequest(
          `return_requests?phone=eq.${encodeURIComponent(phoneFormatted)}&order=created_at.desc`,
          { method: 'GET' }
        );
        if (!ok) return res.status(500).json({ error: 'DB error', detail: data });
        return res.json({ success: true, requests: data || [] });
      }

      return res.status(400).json({ error: 'Missing required parameter: phone, id, or admin=true' });
    }

    // ─────────────────────────────────────────────────────────────
    // POST: Create or Update
    // ─────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body;
      const { action } = body;

      // ── CREATE a new return/exchange request ──────────────────
      if (!action || action === 'create') {
        const {
          phone, customer_name, email, device_id,
          order_id, order_name, order_date,
          line_item_id, product_title, variant_title, sku,
          quantity, item_price, image_url,
          request_type, reason, reason_detail,
          exchange_size, exchange_product_id,
          store, merchant_key
        } = body;

        // Validation
        if (!phone || !order_id || !order_name || !line_item_id || !product_title || !request_type || !reason) {
          return res.status(400).json({
            error: 'Missing required fields: phone, order_id, order_name, line_item_id, product_title, request_type, reason'
          });
        }

        // 7-day return window check
        if (order_date) {
          const deliveredAt = new Date(order_date);
          const windowEnd = new Date(deliveredAt.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000);
          if (new Date() > windowEnd) {
            return res.status(400).json({
              error: `Return/exchange window has expired. Requests must be made within ${RETURN_WINDOW_DAYS} days of delivery.`,
              expired: true
            });
          }
        }

        const cleanDigits = phone.replace(/\D/g, '');
        const last10 = cleanDigits.slice(-10);
        const phoneFormatted = `+91${last10}`;

        // Check for duplicate pending request
        const { data: existing } = await supabaseRequest(
          `return_requests?phone=eq.${encodeURIComponent(phoneFormatted)}&order_id=eq.${encodeURIComponent(order_id)}&line_item_id=eq.${encodeURIComponent(line_item_id)}&status=in.(pending,approved,pickup_scheduled,in_transit)&limit=1`,
          { method: 'GET' }
        );
        if (existing?.length > 0) {
          return res.status(409).json({
            error: 'A return/exchange request for this item is already in progress.',
            existing_request: existing[0]
          });
        }

        const payload = {
          phone: phoneFormatted,
          customer_name: customer_name || null,
          email: email || null,
          device_id: device_id || null,
          order_id: String(order_id),
          order_name,
          order_date: order_date || null,
          line_item_id: String(line_item_id),
          product_title,
          variant_title: variant_title || null,
          sku: sku || null,
          quantity: parseInt(quantity) || 1,
          item_price: parseFloat(item_price) || null,
          image_url: image_url || null,
          request_type,
          reason,
          reason_detail: reason_detail || null,
          exchange_size: exchange_size || null,
          exchange_product_id: exchange_product_id || null,
          photo_url: body.photo_url || null,
          photo_expires_at: body.photo_url ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
          status: 'pending',
          refund_method: 'store_credit',
          store: store || 'i2tu0d-jc.myshopify.com',
          merchant_key: merchant_key || null
        };

        const { ok, data } = await supabaseRequest(
          'return_requests',
          {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Prefer': 'return=representation' }
          }
        );

        if (!ok) return res.status(500).json({ error: 'Failed to create request', detail: data });

        const created = Array.isArray(data) ? data[0] : data;
        
        // Fire WhatsApp notification asynchronously
        dispatchWhatsAppStatusNotification(created).catch(e => console.error(e));

        return res.status(201).json({ success: true, request: created });
      }

      // ── UPDATE STATUS (admin only) ────────────────────────────
      if (action === 'update_status') {
        if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });

        const { id, ids, status, admin_note } = body;
        const targetIds = ids && Array.isArray(ids) ? ids : (id ? [id] : []);
        
        if (targetIds.length === 0 || !status) return res.status(400).json({ error: 'Missing id(s) or status' });

        const validStatuses = ['pending','approved','rejected','pickup_scheduled','in_transit','received','exchange_shipped','completed','cancelled'];
        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const update = { status, updated_at: new Date().toISOString() };
        if (admin_note !== undefined) update.admin_note = admin_note;

        // Set stage timestamps
        if (status === 'approved') update.approved_at = new Date().toISOString();
        if (status === 'rejected') update.rejected_at = new Date().toISOString();
        if (status === 'pickup_scheduled') update.pickup_at = new Date().toISOString();
        if (status === 'received') update.received_at = new Date().toISOString();
        if (status === 'exchange_shipped') update.exchange_shipped_at = new Date().toISOString();
        if (status === 'completed') update.completed_at = new Date().toISOString();

        const idList = targetIds.map(i => encodeURIComponent(i)).join(',');
        const { ok, data } = await supabaseRequest(
          `return_requests?id=in.(${idList})`,
          { method: 'PATCH', body: JSON.stringify(update), headers: { 'Prefer': 'return=representation' } }
        );

        if (!ok) return res.status(500).json({ error: 'Failed to update status', detail: data });
        
        const updatedRequests = Array.isArray(data) ? data : [data];
        // Fire WhatsApp notifications asynchronously
        updatedRequests.forEach(req => dispatchWhatsAppStatusNotification(req).catch(e => console.error(e)));

        return res.json({ success: true, request: updatedRequests });
      }

      // ── ADD RETURN TRACKING (admin only) ─────────────────────
      if (action === 'add_tracking') {
        if (!isAdmin) return res.status(403).json({ error: 'Unauthorized' });

        const {
          id,
          return_tracking_number, return_tracking_company, return_tracking_url,
          exchange_tracking_number, exchange_tracking_company, exchange_tracking_url
        } = body;

        if (!id) return res.status(400).json({ error: 'Missing id' });

        const cleanUrl = (url) => {
          if (!url || typeof url !== 'string' || !url.trim()) return url;
          const t = url.trim();
          return t.startsWith('http://') || t.startsWith('https://') ? t : `https://${t}`;
        };

        const update = { updated_at: new Date().toISOString() };
        if (return_tracking_number) update.return_tracking_number = return_tracking_number;
        if (return_tracking_company) update.return_tracking_company = return_tracking_company;
        if (return_tracking_url) update.return_tracking_url = cleanUrl(return_tracking_url);
        if (exchange_tracking_number) update.exchange_tracking_number = exchange_tracking_number;
        if (exchange_tracking_company) update.exchange_tracking_company = exchange_tracking_company;
        if (exchange_tracking_url) update.exchange_tracking_url = cleanUrl(exchange_tracking_url);

        const { ok, data } = await supabaseRequest(
          `return_requests?id=eq.${encodeURIComponent(id)}`,
          { method: 'PATCH', body: JSON.stringify(update), headers: { 'Prefer': 'return=representation' } }
        );

        if (!ok) return res.status(500).json({ error: 'Failed to add tracking', detail: data });
        return res.json({ success: true, request: Array.isArray(data) ? data[0] : data });
      }

      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Returns API Error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}


export default async function handler(req, res) {
  if (
    req.query.action === 'returns' || 
    req.body?.action === 'returns_init' || 
    req.body?.action === 'create' || 
    req.body?.request_type === 'return' || 
    req.body?.request_type === 'exchange'
  ) {
    return returnsHandler(req, res);
  }
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

  if (req.query.recover_id) {
    const sessionId = req.query.recover_id;
    const dbUrl = process.env.SUPABASE_NFU_DB_URL || 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit@202612@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres';
    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });
    try {
      await client.connect();
      const queryRes = await client.query('SELECT cart_details FROM checkout_sessions WHERE id = $1 LIMIT 1', [sessionId]);
      await client.end();
      if (queryRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Cart session not found.' });
      const cartDetails = queryRes.rows[0].cart_details;
      if (!cartDetails || !cartDetails.items) return res.status(404).json({ success: false, error: 'Cart items not found in session.' });
      return res.status(200).json({ success: true, items: cartDetails.items });
    } catch (error) {
      try { await client.end(); } catch (_) {}
      console.error('Recover Cart API Error:', error);
      return res.status(500).json({ success: false, error: 'Failed to recover cart.' });
    }
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

          return dbFetch(`/rest/v1/shopify_orders`, {
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
      const dbRes = await dbFetch(`/rest/v1/shopify_orders?or=(phone_last10.eq.${last10},alt_phone_last10.eq.${last10})&order=created_at.desc`,
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
