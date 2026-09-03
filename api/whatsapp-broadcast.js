import axios from './axiosWrapper.js';
import pg from 'pg';
import FormData from 'form-data';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xkiukbebnntjzfilyfmh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';

const supabaseHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Helper to fetch Meta Token & WABA
  const fetchSettings = async () => {
    let token = process.env.WHATSAPP_TOKEN || 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
    let wabaId = '2025586748064434';
    let phoneId = '1189183190949431';
    try {
      const setRes = await axios.get(
        `${SUPABASE_URL}/rest/v1/whatsapp_settings?select=whatsapp_token,waba_id,phone_number_id&order=id.desc&limit=1`,
        { headers: supabaseHeaders }
      );
      if (setRes.data?.[0]) {
        if (setRes.data[0].whatsapp_token) token = setRes.data[0].whatsapp_token;
        if (setRes.data[0].waba_id) wabaId = setRes.data[0].waba_id;
        if (setRes.data[0].phone_number_id) phoneId = setRes.data[0].phone_number_id;
      }
    } catch (e) {}
    return { token, wabaId, phoneId };
  };

  const getValue = (dbRow, mapField) => {
    let value = '';
    if (!mapField) return 'N/A';
    if (mapField.startsWith('static_text:')) {
      value = mapField.replace('static_text:', '');
    } else if (mapField === 'customer_name') {
      value = dbRow.customer_name || dbRow.name || 'there';
    } else if (mapField === 'order_number') {
      value = dbRow.order_number ? `#${dbRow.order_number}` : 'Your Order';
    } else if (mapField === 'phone_number') {
      value = dbRow.phone_last10 || 'Your Phone';
    } else if (mapField === 'tracking_url') {
      value = dbRow.tracking_url || 'https://11fit.in';
    } else {
      value = 'N/A';
    }
    return value.substring(0, 1024);
  };

  const resolveHeaderMediaId = async (templateComponents, headerMediaUrl, token, phoneId, wabaId, templateName) => {
    // If user provided a URL AND it's NOT a Meta CDN URL (those expire), use it directly without re-upload
    const isMetaCdnUrl = headerMediaUrl && (headerMediaUrl.includes('scontent.whatsapp.net') || headerMediaUrl.includes('lookaside.fbsbx.com'));
    if (headerMediaUrl && !isMetaCdnUrl) return null; // Valid external URL - use directly
    // else: either no URL, or it's an expired Meta CDN URL - proceed to re-upload flow
    if (!templateComponents) return null;
    
    const headerComp = templateComponents.find(c => c.type === 'HEADER' && (c.format === 'IMAGE' || c.format === 'VIDEO' || c.format === 'DOCUMENT'));
    if (!headerComp) return null;
    
    // STEP 1: Fetch FRESH template data from Meta API right now (so the URL is never expired)
    let freshExampleUrl = '';
    try {
      const tplRes = await axios.get(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=name,components&name=${templateName}&limit=10`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const freshTpl = (tplRes.data?.data || []).find(t => t.name === templateName);
      if (freshTpl) {
        const freshHeader = freshTpl.components?.find(c => c.type === 'HEADER');
        if (freshHeader) {
          freshExampleUrl = freshHeader.example?.header_handle?.[0] || freshHeader.example?.header_url?.[0] || '';
        }
      }
    } catch(e) {
      console.error('Failed to fetch fresh template from Meta:', e.message);
    }

    // Fallback to the url passed in if fresh fetch failed
    const exampleUrl = freshExampleUrl || headerComp.example?.header_handle?.[0] || headerComp.example?.header_url?.[0] || '';
    if (!exampleUrl.startsWith('http')) return null;
    
    // STEP 2: Download that image and re-upload to WhatsApp Media API to get a stable Media ID
    try {
      const downloadRes = await axios.get(exampleUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(downloadRes.data);
      const contentType = downloadRes.headers['content-type'] || 'image/png';
      
      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      
      let filename = 'media.png';
      if (headerComp.format === 'VIDEO') filename = 'media.mp4';
      if (headerComp.format === 'DOCUMENT') filename = 'document.pdf';
      
      form.append('file', buffer, { filename, contentType });
      
      const uploadRes = await axios.post(`https://graph.facebook.com/v20.0/${phoneId}/media`, form, {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...form.getHeaders()
        }
      });
      console.log(`[Broadcast] Default image pre-uploaded. Media ID: ${uploadRes.data.id}`);
      return uploadRes.data.id;
    } catch (e) {
      // Log the error but don't crash — let the user-provided URL (if any) handle it
      console.error('Failed to pre-upload Meta default image:', e.response?.data || e.message);
      throw new Error(`Could not upload the default template image to WhatsApp. Please provide a valid "Header Media URL" manually before broadcasting. (Detail: ${e.response?.data?.error?.message || e.message})`);
    }
  };

  const buildTemplateComponents = (dbRow, variablesMapping, templateComponents, headerMediaUrl, preUploadedMediaId) => {
    if (!templateComponents || templateComponents.length === 0) return [];
    
    const outComponents = [];
    let globalVarIndex = 1;
    
    for (const comp of templateComponents) {
      if (comp.type === 'HEADER') {
        const exampleUrl = comp.example?.header_handle?.[0] || comp.example?.header_url?.[0] || '';
        // If exampleUrl is a handle (not a URL), we MUST rely on headerMediaUrl
        const hasValidExampleUrl = exampleUrl.startsWith('http');
        
        if (comp.format === 'IMAGE') {
           if (preUploadedMediaId) {
             // Use the pre-uploaded Media ID (most reliable - avoids expired CDN links)
             outComponents.push({ type: 'header', parameters: [ { type: 'image', image: { id: preUploadedMediaId } } ] });
           } else if (headerMediaUrl) {
             // User provided a direct URL
             outComponents.push({ type: 'header', parameters: [ { type: 'image', image: { link: headerMediaUrl } } ] });
           } else {
             throw new Error('No media available for IMAGE template header. Please provide a Header Media URL.');
           }
        } else if (comp.format === 'VIDEO') {
           if (preUploadedMediaId) {
             outComponents.push({ type: 'header', parameters: [ { type: 'video', video: { id: preUploadedMediaId } } ] });
           } else if (headerMediaUrl) {
             outComponents.push({ type: 'header', parameters: [ { type: 'video', video: { link: headerMediaUrl } } ] });
           } else {
             throw new Error('No media available for VIDEO template header. Please provide a Header Media URL.');
           }
        } else if (comp.format === 'DOCUMENT') {
           if (preUploadedMediaId) {
             outComponents.push({ type: 'header', parameters: [ { type: 'document', document: { id: preUploadedMediaId, filename: 'document.pdf' } } ] });
           } else if (headerMediaUrl) {
             outComponents.push({ type: 'header', parameters: [ { type: 'document', document: { link: headerMediaUrl, filename: 'document.pdf' } } ] });
           } else {
             throw new Error('No media available for DOCUMENT template header. Please provide a Header Media URL.');
           }
        } else if (comp.format === 'TEXT') {
           const textMatches = (comp.text || '').match(/\{\{(\d+)\}\}/g);
           if (textMatches && textMatches.length > 0) {
             const parameters = [];
             textMatches.forEach(() => {
               const mapField = variablesMapping[globalVarIndex] || 'customer_name';
               parameters.push({ type: 'text', text: getValue(dbRow, mapField) });
               globalVarIndex++;
             });
             outComponents.push({ type: 'header', parameters });
           }
        }
      } else if (comp.type === 'BODY') {
        const textMatches = (comp.text || '').match(/\{\{(\d+)\}\}/g);
        if (textMatches && textMatches.length > 0) {
          const parameters = [];
          textMatches.forEach(() => {
            const mapField = variablesMapping[globalVarIndex] || 'customer_name';
            parameters.push({ type: 'text', text: getValue(dbRow, mapField) });
            globalVarIndex++;
          });
          outComponents.push({ type: 'body', parameters });
        }
      }
    }
    
    return outComponents;
  };

  const getTemplatePreviewText = (templateName, templateComponents, renderedComponents) => {
    let previewText = `[Broadcast Template: ${templateName}]`;
    try {
      if (templateComponents) {
        const bodyComp = templateComponents.find(c => c.type === 'BODY');
        if (bodyComp && bodyComp.text) {
          let text = bodyComp.text;
          const vars = renderedComponents?.find(c => c.type === 'body')?.parameters || [];
          vars.forEach((v, i) => { text = text.replace(`{{${i+1}}}`, v.text || ''); });
          previewText = text;
        }
      }
    } catch(e) {}
    return previewText;
  };

  if (req.method === 'GET') {
    const { id } = req.query;
    try {
      if (id) {
        const bRes = await axios.get(`${SUPABASE_URL}/rest/v1/whatsapp_broadcasts?id=eq.${id}`, { headers: supabaseHeaders });
        if (!bRes.data || bRes.data.length === 0) throw new Error('Not found');
        const lRes = await axios.get(`${SUPABASE_URL}/rest/v1/whatsapp_broadcast_logs?broadcast_id=eq.${id}&order=updated_at.desc`, { headers: supabaseHeaders });
        return res.status(200).json({ success: true, broadcast: bRes.data[0], logs: lRes.data });
      } else {
        const resList = await axios.get(`${SUPABASE_URL}/rest/v1/whatsapp_broadcasts?order=created_at.desc`, { headers: supabaseHeaders });
        return res.status(200).json({ success: true, broadcasts: resList.data });
      }
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { action, segment, segment_config, template_name, template_components, category, variables_mapping, header_media_url, test_phone, scheduled_at, phones } = req.body;

    if (action === 'send_direct') {
      try {
        const { token, phoneId, wabaId } = await fetchSettings();
        if (!phones || phones.length === 0) return res.status(400).json({ success: false, error: 'No phones provided' });
        
        let sentCount = 0;
        
        // 1. Create Broadcast Record
        const bPayload = {
          name: `${template_name} Custom Broadcast`,
          segment: 'custom_selection',
          template_name,
          total_recipients: phones.length,
          status: 'completed',
          scheduled_at: new Date().toISOString()
        };
        const insertRes = await axios.post(`${SUPABASE_URL}/rest/v1/whatsapp_broadcasts`, bPayload, {
          headers: { ...supabaseHeaders, 'Prefer': 'return=representation' }
        }).catch(() => null);
        
        const broadcastId = insertRes?.data?.[0]?.id || null;
        const logPayloads = [];
        
        for (const phone of phones) {
          const fullPhone = phone.length === 10 ? '91' + phone : phone;
          const metaPayload = {
            messaging_product: 'whatsapp',
            to: fullPhone,
            type: 'template',
            template: { name: template_name, language: { code: 'en_US' } }
          };
          
          let wamid = null;
          let status = 'failed';
          
          try {
             const res = await axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`, metaPayload, {
               headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
             });
             wamid = res.data?.messages?.[0]?.id || null;
             status = 'sent';
             sentCount++;
          } catch(e) {
             console.error('Failed to send direct to', phone, e.response?.data || e.message);
          }
          
          if (broadcastId) {
             logPayloads.push({
               broadcast_id: broadcastId,
               phone: fullPhone,
               wamid: wamid,
               status: status,
               error_message: status === 'failed' ? 'API Error' : null
             });
          }
        }
        
        // 2. Insert Logs in bulk
        if (logPayloads.length > 0) {
           await axios.post(`${SUPABASE_URL}/rest/v1/whatsapp_broadcast_logs`, logPayloads, { headers: supabaseHeaders }).catch(() => null);
        }
        
        return res.status(200).json({ success: true, message: `Sent to ${sentCount} contacts` });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    const getCustomersForSegment = async (seg) => {
      // NFU Database (for abandoned carts)
      if (seg === 'abandoned_carts_30_days' || seg === 'signed_up_not_ordered') {
        const client2 = new pg.Client({
          connectionString: process.env.SUPABASE_NFU_DB_URL || 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit@202612@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 15000
        });
        await client2.connect();
        try {
          const cRes = await client2.query(`SELECT phone FROM checkout_sessions WHERE status = 'abandoned' AND created_at > NOW() - INTERVAL '30 days'`);
          
          let customers = cRes.rows.map(r => {
            const num = String(r.phone || '').replace(/\D/g, '');
            if (num.length >= 10) return {
              phone_last10: num.slice(-10),
              name: 'Customer',
              customer_name: 'Customer',
              order_number: 'Cart',
              tracking_url: ''
            };
            return null;
          }).filter(Boolean);

          const unique = [];
          const seen = new Set();
          for(let c of customers) {
            if(!seen.has(c.phone_last10)) {
              seen.add(c.phone_last10);
              unique.push(c);
            }
          }
          customers = unique;

          if (seg === 'signed_up_not_ordered') {
            const ord = await axios.get(`${SUPABASE_URL}/rest/v1/shopify_orders?select=phone_last10&phone_last10=not.is.null`, { headers: supabaseHeaders });
            const orderedPhones = new Set(ord.data.map(r => r.phone_last10));
            customers = customers.filter(c => !orderedPhones.has(c.phone_last10));
          }

          return customers;
        } finally {
          await client2.end();
        }
      }

      // Main Database (for shopify_orders)
      let data = [];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      if (seg === 'last_30_days') {
        const res = await axios.get(`${SUPABASE_URL}/rest/v1/shopify_orders?select=phone_last10,customer_name,name,order_number,tracking_url&phone_last10=not.is.null&created_at=gte.${thirtyDaysAgo}&order=created_at.desc`, { headers: supabaseHeaders });
        data = res.data;
      } else if (seg === 'custom' && segment_config) {
        // Fetch a generous chunk and filter in-memory for complex rules
        const res = await axios.get(`${SUPABASE_URL}/rest/v1/shopify_orders?select=phone_last10,customer_name,name,order_number,tracking_url,order_data,total_price&phone_last10=not.is.null&order=created_at.desc&limit=10000`, { headers: supabaseHeaders });
        data = res.data.filter(order => {
          let match = true;
          if (segment_config.minSpend && parseFloat(order.total_price) < parseFloat(segment_config.minSpend)) match = false;
          
          if (segment_config.location) {
            const prov = order.order_data?.shipping_address?.province || '';
            const city = order.order_data?.shipping_address?.city || '';
            const locString = `${prov} ${city}`.toLowerCase();
            if (!locString.includes(segment_config.location.toLowerCase())) match = false;
          }
          
          if (segment_config.productKeywords) {
            const items = order.order_data?.line_items || [];
            const itemsString = items.map(i => i.title).join(' ').toLowerCase();
            if (!itemsString.includes(segment_config.productKeywords.toLowerCase())) match = false;
          }
          return match;
        });
      } else if (seg === 'no_orders_30_days') {
        const resAll = await axios.get(`${SUPABASE_URL}/rest/v1/shopify_orders?select=phone_last10,customer_name,name,order_number,tracking_url&phone_last10=not.is.null&order=created_at.desc`, { headers: supabaseHeaders });
        const resRecent = await axios.get(`${SUPABASE_URL}/rest/v1/shopify_orders?select=phone_last10&phone_last10=not.is.null&created_at=gte.${thirtyDaysAgo}`, { headers: supabaseHeaders });
        const recentPhones = new Set(resRecent.data.map(r => r.phone_last10));
        data = resAll.data.filter(c => !recentPhones.has(c.phone_last10));
      } else {
        const res = await axios.get(`${SUPABASE_URL}/rest/v1/shopify_orders?select=phone_last10,customer_name,name,order_number,tracking_url&phone_last10=not.is.null&order=created_at.desc`, { headers: supabaseHeaders });
        data = res.data;
      }

      // Deduplicate by phone_last10
      const unique = [];
      const seen = new Set();
      for (const row of data) {
        if (!seen.has(row.phone_last10)) {
          seen.add(row.phone_last10);
          unique.push(row);
        }
      }
      return unique.filter(r => r.phone_last10 && r.phone_last10.length === 10);
    };

    if (action === 'estimate') {
      try {
        const customers = await getCustomersForSegment(segment);
        const count = customers.length;
        let rate = 0.73;
        if (category === 'UTILITY') rate = 0.11;
        if (category === 'AUTHENTICATION') rate = 0.11;
        const estimatedCost = (count * rate).toFixed(2);
        
        return res.status(200).json({ success: true, count, estimatedCost, previewCustomers: customers.slice(0, 50) });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    if (action === 'roi_stats') {
      try {
        const { broadcast_id } = req.body;
        if (!broadcast_id) throw new Error('broadcast_id is required');
        
        const bRes = await axios.get(`${SUPABASE_URL}/rest/v1/whatsapp_broadcasts?id=eq.${broadcast_id}`, { headers: supabaseHeaders });
        const broadcast = bRes.data?.[0];
        if (!broadcast) throw new Error('Broadcast not found');

        const lRes = await axios.get(`${SUPABASE_URL}/rest/v1/whatsapp_broadcast_logs?broadcast_id=eq.${broadcast_id}&select=phone`, { headers: supabaseHeaders });
        const targetedPhones = new Set(lRes.data.map(l => l.phone.slice(-10)));
        
        if (targetedPhones.size === 0) {
           return res.status(200).json({ success: true, attributedRevenue: 0, attributedOrders: 0 });
        }

        const bDate = new Date(broadcast.created_at);
        const endDate = new Date(bDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const ordersRes = await axios.get(`${SUPABASE_URL}/rest/v1/shopify_orders?select=phone_last10,total_price,order_number&created_at=gte.${bDate.toISOString()}&created_at=lte.${endDate.toISOString()}`, { headers: supabaseHeaders });
        
        let attributedRevenue = 0;
        let attributedOrders = 0;
        
        ordersRes.data.forEach(order => {
           if (order.phone_last10 && targetedPhones.has(order.phone_last10)) {
               attributedOrders++;
               attributedRevenue += parseFloat(order.total_price || 0);
           }
        });
        
        return res.status(200).json({ success: true, attributedRevenue, attributedOrders });
      } catch(e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    }

    if (action === 'test') {
      try {
        if (!test_phone) throw new Error('Test phone number is required');
        const { token, phoneId, wabaId } = await fetchSettings();
        
        const preUploadedMediaId = await resolveHeaderMediaId(template_components, header_media_url, token, phoneId, wabaId, template_name);
        
        const cRes = await axios.get(`${SUPABASE_URL}/rest/v1/shopify_orders?select=phone_last10,customer_name,name,order_number,tracking_url&limit=1`, { headers: supabaseHeaders });
        const dummyRow = cRes.data[0] || { customer_name: 'Test User', order_number: 9999, phone_last10: test_phone };
        
        const fullPhone = test_phone.length === 10 ? '91' + test_phone : test_phone;
        const components = buildTemplateComponents(dummyRow, variables_mapping, template_components, header_media_url, preUploadedMediaId);

        const metaPayload = {
          messaging_product: 'whatsapp',
          to: fullPhone,
          type: 'template',
          template: { name: template_name, language: { code: 'en_US' }, components: components || [] }
        };

        const metaRes = await axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`, metaPayload, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        
        return res.status(200).json({ success: true, message: 'Test message sent successfully!', wamid: metaRes.data.messages?.[0]?.id });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.response?.data?.error?.message || err.message });
      }
    }

    if (action === 'start') {
      try {
        const { token, phoneId, wabaId } = await fetchSettings();
        const customers = await getCustomersForSegment(segment);
        const count = customers.length;

        let rate = 0.73;
        if (category === 'UTILITY') rate = 0.11;
        if (category === 'AUTHENTICATION') rate = 0.11;
        const estimatedCost = (count * rate).toFixed(2);

        if (count === 0) {
          return res.status(400).json({ success: false, error: 'No customers found in this segment.' });
        }
        
        // Pre-upload the default image ONCE before the broadcast loop to save time and API quota
        const preUploadedMediaId = await resolveHeaderMediaId(template_components, header_media_url, token, phoneId, wabaId, template_name);

        const parsedScheduledAt = scheduled_at ? new Date(scheduled_at + '+05:30').toISOString() : null;

        const bPayload = {
          name: `Broadcast ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date())}`,
          segment: segment,
          template_name: template_name,
          status: scheduled_at ? 'scheduled' : 'running',
          scheduled_at: parsedScheduledAt,
          total_count: count,
          estimated_cost: estimatedCost,
          config: {
            template_components,
            variables_mapping,
            header_media_url,
            pre_uploaded_media_id: preUploadedMediaId,
            segment_config
          }
        };
        const bRes = await axios.post(`${SUPABASE_URL}/rest/v1/whatsapp_broadcasts`, bPayload, {
          headers: { ...supabaseHeaders, 'Prefer': 'return=representation' }
        });
        const broadcastId = bRes.data[0].id;

        if (scheduled_at) {
          return res.status(200).json({ 
            success: true, 
            broadcastId, 
            message: `Broadcast scheduled successfully for ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(parsedScheduledAt))}.` 
          });
        }

        // Synchronous sending process to avoid Vercel freezing the function and leaking connections
        let sent = 0, failed = 0;
        for (let customer of customers) {
            const p = customer.phone_last10;
            const fullPhone = p.length === 10 ? '91' + p : p;
            try {
              const components = buildTemplateComponents(customer, variables_mapping, template_components, header_media_url, preUploadedMediaId);
              const metaPayload = {
                messaging_product: 'whatsapp',
                to: fullPhone,
                type: 'template',
                template: { name: template_name, language: { code: 'en_US' }, components: components || [] }
              };
              const metaRes = await axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`, metaPayload, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
              });
              const wamid = metaRes.data.messages?.[0]?.id;
              
              await axios.post(`${SUPABASE_URL}/rest/v1/whatsapp_broadcast_logs`, {
                broadcast_id: broadcastId, phone: fullPhone, status: 'sent', wamid
              }, { headers: supabaseHeaders });
              
              const previewText = getTemplatePreviewText(template_name, template_components, components);
              await axios.post(`${SUPABASE_URL}/rest/v1/whatsapp_chat_memory`, {
                phone: fullPhone, role: 'assistant', message: previewText
              }, { headers: supabaseHeaders }).catch(() => {});
              
              sent++;
            } catch (sendErr) {
              failed++;
              await axios.post(`${SUPABASE_URL}/rest/v1/whatsapp_broadcast_logs`, {
                broadcast_id: broadcastId, phone: fullPhone, status: 'failed', error_message: sendErr.response?.data?.error?.message || sendErr.message
              }, { headers: supabaseHeaders });
            }
            
            // Rate limit self to avoid hitting Meta limits
            await new Promise(r => setTimeout(r, 100));

          // Update stats every 50 messages
          if ((sent + failed) % 50 === 0) {
            await axios.patch(`${SUPABASE_URL}/rest/v1/whatsapp_broadcasts?id=eq.${broadcastId}`, {
              sent_count: sent, failed_count: failed
            }, { headers: supabaseHeaders });
          }
        }
        
        await axios.patch(`${SUPABASE_URL}/rest/v1/whatsapp_broadcasts?id=eq.${broadcastId}`, {
          status: 'completed', sent_count: sent, failed_count: failed
        }, { headers: supabaseHeaders });

        return res.status(200).json({ success: true, broadcastId, message: `Broadcast completed. Sent: ${sent}, Failed: ${failed}.` });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    if (action === 'retry_failed') {
      try {
        const { broadcast_id } = req.body;
        if (!broadcast_id) throw new Error('broadcast_id is required');
        const { token, phoneId } = await fetchSettings();

        // 1. Fetch broadcast and config
        const bRes = await axios.get(`${SUPABASE_URL}/rest/v1/whatsapp_broadcasts?id=eq.${broadcast_id}`, { headers: supabaseHeaders });
        const broadcast = bRes.data?.[0];
        if (!broadcast) return res.status(404).json({ success: false, error: 'Broadcast not found.' });
        if (!broadcast.config) return res.status(400).json({ success: false, error: 'Cannot retry this broadcast because it was created before the Config update. Please create a new broadcast.' });
        
        const { template_components, variables_mapping, header_media_url, pre_uploaded_media_id } = broadcast.config;

        // 2. Fetch failed logs
        const lRes = await axios.get(`${SUPABASE_URL}/rest/v1/whatsapp_broadcast_logs?broadcast_id=eq.${broadcast_id}&status=eq.failed`, { headers: supabaseHeaders });
        const failedLogs = lRes.data || [];
        if (failedLogs.length === 0) return res.status(200).json({ success: true, message: 'No failed messages to retry.' });

        // 3. Setup status to 'running'
        await axios.patch(`${SUPABASE_URL}/rest/v1/whatsapp_broadcasts?id=eq.${broadcast_id}`, { status: 'running' }, { headers: supabaseHeaders });

        let retriedSent = 0;
        let retriedFailed = 0;

        for (const log of failedLogs) {
          try {
            // Need customer details. We only have the phone number, so we construct a dummy customer row
            // Ideally we query the customer again, but for now we try to map if we can or just use phone
            const customer = { phone_last10: log.phone.replace(/^91/, ''), customer_name: 'Customer', order_number: '', tracking_url: '' };
            // Let's attempt to fetch actual customer data based on phone
            const cRes = await axios.get(`${SUPABASE_URL}/rest/v1/shopify_orders?select=phone_last10,customer_name,name,order_number,tracking_url&phone_last10=eq.${customer.phone_last10}&limit=1`, { headers: supabaseHeaders });
            const actualCustomer = cRes.data?.[0] || customer;

            const components = buildTemplateComponents(actualCustomer, variables_mapping, template_components, header_media_url, pre_uploaded_media_id);
            const metaPayload = {
              messaging_product: 'whatsapp',
              to: log.phone,
              type: 'template',
              template: { name: broadcast.template_name, language: { code: 'en_US' }, components: components || [] }
            };

            const metaRes = await axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`, metaPayload, {
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            const wamid = metaRes.data.messages?.[0]?.id;

            await axios.patch(`${SUPABASE_URL}/rest/v1/whatsapp_broadcast_logs?id=eq.${log.id}`, {
              status: 'sent', wamid, error_message: null, updated_at: new Date().toISOString()
            }, { headers: supabaseHeaders });
            
            const previewText = getTemplatePreviewText(broadcast.template_name, template_components, components);
            await axios.post(`${SUPABASE_URL}/rest/v1/whatsapp_chat_memory`, {
              phone: log.phone, role: 'assistant', message: previewText
            }, { headers: supabaseHeaders }).catch(() => {});
            
            retriedSent++;
          } catch (err) {
            retriedFailed++;
            await axios.patch(`${SUPABASE_URL}/rest/v1/whatsapp_broadcast_logs?id=eq.${log.id}`, {
              error_message: err.response?.data?.error?.message || err.message, updated_at: new Date().toISOString()
            }, { headers: supabaseHeaders });
          }
          await new Promise(r => setTimeout(r, 100)); // Rate limit
        }

        // 4. Update the final counts
        const sentCount = (broadcast.sent_count || 0) + retriedSent;
        const failedCount = Math.max(0, (broadcast.failed_count || 0) - retriedSent);
        await axios.patch(`${SUPABASE_URL}/rest/v1/whatsapp_broadcasts?id=eq.${broadcast_id}`, {
          status: 'completed', sent_count: sentCount, failed_count: failedCount
        }, { headers: supabaseHeaders });

        return res.status(200).json({ success: true, message: `Retry complete. Sent: ${retriedSent}, Still Failed: ${retriedFailed}` });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    if (action === 'execute_scheduled') {
      try {
        const { broadcast_id } = req.body;
        if (!broadcast_id) throw new Error('broadcast_id is required');
        const { token, phoneId } = await fetchSettings();

        // 1. Fetch broadcast and config
        const bRes = await axios.get(`${SUPABASE_URL}/rest/v1/whatsapp_broadcasts?id=eq.${broadcast_id}`, { headers: supabaseHeaders });
        const broadcast = bRes.data?.[0];
        if (!broadcast || broadcast.status !== 'scheduled') throw new Error('Broadcast not found or not scheduled');
        
        const { template_components, variables_mapping, header_media_url, pre_uploaded_media_id } = broadcast.config;

        // 2. Setup status to 'running'
        await axios.patch(`${SUPABASE_URL}/rest/v1/whatsapp_broadcasts?id=eq.${broadcast_id}`, { status: 'running' }, { headers: supabaseHeaders });

        const customers = await getCustomersForSegment(broadcast.segment);
        let sent = 0, failed = 0;

        for (let customer of customers) {
            const p = customer.phone_last10;
            const fullPhone = p.length === 10 ? '91' + p : p;
            try {
              const components = buildTemplateComponents(customer, variables_mapping, template_components, header_media_url, pre_uploaded_media_id);
              const metaPayload = {
                messaging_product: 'whatsapp',
                to: fullPhone,
                type: 'template',
                template: { name: broadcast.template_name, language: { code: 'en_US' }, components: components || [] }
              };
              const metaRes = await axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`, metaPayload, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
              });
              const wamid = metaRes.data.messages?.[0]?.id;
              
              await axios.post(`${SUPABASE_URL}/rest/v1/whatsapp_broadcast_logs`, {
                broadcast_id, phone: fullPhone, status: 'sent', wamid
              }, { headers: supabaseHeaders });
              
              sent++;
            } catch (sendErr) {
              failed++;
              await axios.post(`${SUPABASE_URL}/rest/v1/whatsapp_broadcast_logs`, {
                broadcast_id, phone: fullPhone, status: 'failed', error_message: sendErr.response?.data?.error?.message || sendErr.message
              }, { headers: supabaseHeaders });
            }
            await new Promise(r => setTimeout(r, 100)); // Rate limit

          if ((sent + failed) % 50 === 0) {
            await axios.patch(`${SUPABASE_URL}/rest/v1/whatsapp_broadcasts?id=eq.${broadcast_id}`, {
              sent_count: sent, failed_count: failed
            }, { headers: supabaseHeaders });
          }
        }
        
        await axios.patch(`${SUPABASE_URL}/rest/v1/whatsapp_broadcasts?id=eq.${broadcast_id}`, {
          status: 'completed', sent_count: sent, failed_count: failed
        }, { headers: supabaseHeaders });

        return res.status(200).json({ success: true, message: `Executed scheduled broadcast. Sent: ${sent}, Failed: ${failed}` });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
