import axios from './axiosWrapper.js';
import pg from 'pg';
const { Client } = pg;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nfubnpgfwgrlpfhcbjlg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mdWJucGdmd2dybHBmaGNiamxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2OTE5NTMsImV4cCI6MjEwMDI2Nzk1M30.MPdzBAtkh39IgOR9ANzFGBt5SoJbZNcEChEU0nowePk';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

const DEFAULT_INST_LANGUAGE = `- AUTOMATIC LANGUAGE SWITCHING: Customer jis language mein message kare, tum AUTOMATICALLY ussi language mein reply karo! (English, Hinglish, Hindi, regional languages)
- AUTOMATIC TONE MIRRORING: Casual / Bro Tone -> Cool shopping buddy ("Haan bhai, bilkul! 🔥"). Formal -> Polite executive. Frustrated / Worried -> Empathetic & fast solution.
- SHORT & CRISP REPLIES: MAXIMUM 2 TO 4 LINES PER REPLY! Never tell customer to contact us on WhatsApp (+91 74949 61428) because they are already chatting on WhatsApp!`;

const DEFAULT_INST_ORDER_SECURITY = `1. ORDER NUMBER FORMAT: 11FIT ke order numbers "#" se start hote hain (jaise #1129, #1039). Customer "1039" bole ya "#1039", tum hamesha recognize karo.
2. AUTO-VERIFICATION & 10-DIGIT VERIFICATION FLOW (MANDATORY):
   - Current WhatsApp Number aur Order ke registered_mobile_10_digits ko compare karo.
   - ✅ AGAR MATCH HO JAYE: Short 2-3 line reply mein full order details do (Status, Tracking link). 🎉
   - ❌ AGAR MATCH NAHI HOTA: Politely 10-digit registered number pucho ("Aapka yeh WhatsApp number order ke saath attached nahi hai...").
   - AGAR 10-DIGIT NUMBER MATCH HO JAYE: Verification successful bolo aur order details bata do!
   - AGAR MATCH NA HO: Hamesha decline karo aur support@11fit.com do.`;

const DEFAULT_INST_SIZE_ADVISOR = `- Har size/height/weight enquiry ke liye [11FIT SIZE & FIT RECOMMENDATION] ya [11FIT GENERAL SIZE & FIT GUIDE] ka data use karke confident size recommend karo!
- Reassure customer: "11FIT tees mein pehle se drop-shoulder oversized cut hota hai, toh apna normal size hi lein!"
- 4-Way Lycra shorts/track pants ke liye L aur XL dono stretch comfortably hote hain.`;

const DEFAULT_INST_BRAND_POLICIES = `- Oversized Tees & Track Pants: Combed cotton & 4-Way Lycra. Size Guide available on our website.
- Shipping: 3-5 business days across India. COD & Prepaid available.
- Returns & Exchanges: 7-Day Return/Exchange policy. Customers must process returns via our website (www.11fit.in) on the returns portal.
- Recruitment/HR: For jobs or CV submissions, strictly tell them to email careers@11fit.com. Do not ask for CVs on WhatsApp.
- Support: For escalations or detailed support, email support@11fit.com.
- Website: www.11fit.in`;

const DEFAULT_INST_CUSTOM = ``;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Handle 'flows' endpoints
  if (req.query.type === 'flows') {
    try {
      if (req.method === 'GET') {
        const { data } = await axios.get(
          `${SUPABASE_URL}/rest/v1/whatsapp_flows?select=*&order=created_at.desc`,
          { headers }
        );
        return res.status(200).json(data || []);
      }
      if (req.method === 'POST') {
        const { name, flow_json, is_active } = req.body;
        const { data } = await axios.post(
          `${SUPABASE_URL}/rest/v1/whatsapp_flows`,
          { name, flow_json, is_active },
          { headers: { ...headers, 'Prefer': 'return=representation' } }
        );
        return res.status(200).json(data?.[0] || { success: true });
      }
      if (req.method === 'PUT') {
        const { id, name, flow_json, is_active } = req.body;
        const { data } = await axios.patch(
          `${SUPABASE_URL}/rest/v1/whatsapp_flows?id=eq.${id}`,
          { name, flow_json, is_active, updated_at: new Date().toISOString() },
          { headers: { ...headers, 'Prefer': 'return=representation' } }
        );
        return res.status(200).json(data?.[0] || { success: true });
      }
      if (req.method === 'DELETE') {
        const { id } = req.body;
        await axios.delete(
          `${SUPABASE_URL}/rest/v1/whatsapp_flows?id=eq.${id}`,
          { headers }
        );
        return res.status(200).json({ success: true });
      }
      return res.status(405).json({ error: 'Method not allowed for flows' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Handle 'quick_replies' endpoints
  if (req.query.type === 'quick_replies' || req.query.action === 'quick_replies') {
    try {
      if (req.method === 'GET') {
        const { data } = await axios.get(
          `${SUPABASE_URL}/rest/v1/whatsapp_quick_replies?select=*&order=id.asc`,
          { headers }
        );
        return res.status(200).json({ success: true, replies: data || [] });
      }
      if (req.method === 'POST') {
        const { label, text } = req.body || {};
        if (!label || !text) return res.status(400).json({ error: 'Missing label or text' });
        const { data } = await axios.post(
          `${SUPABASE_URL}/rest/v1/whatsapp_quick_replies`,
          { label, text },
          { headers: { ...headers, 'Prefer': 'return=representation' } }
        );
        return res.status(200).json({ success: true, reply: data?.[0] });
      }
      if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'Missing id' });
        await axios.delete(`${SUPABASE_URL}/rest/v1/whatsapp_quick_replies?id=eq.${id}`, { headers });
        return res.status(200).json({ success: true });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Database error' });
    }
  }

  // Handle 'toggle_ai' action
  if (req.query.action === 'toggle_ai') {
    if (req.method === 'POST') {
      try {
        const { phone, ai_paused } = req.body;
        if (!phone) return res.status(400).json({ error: 'Missing phone' });
        const { data } = await axios.post(
          `${SUPABASE_URL}/rest/v1/whatsapp_chat_settings`,
          { phone, ai_paused, updated_at: new Date().toISOString() },
          { headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' } }
        );
        return res.status(200).json({ success: true, settings: data?.[0] });
      } catch (error) {
        return res.status(500).json({ success: false, error: 'Database error' });
      }
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // GET: Read current WhatsApp AI settings, Contacts, or run Cron
  if (req.method === 'GET') {
    try {
      if (req.query.action === 'cron_delays') {
        const nowIso = new Date().toISOString();
        const { data: messages } = await axios.get(`${SUPABASE_URL}/rest/v1/whatsapp_scheduled_messages?send_after=lte.${nowIso}&limit=50`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
        if (!messages || messages.length === 0) return res.status(200).json({ status: 'ok', processed: 0 });

        const selfUrl = `https://${req.headers.host}/api/whatsapp-ai`;
        let processedCount = 0;
        for (const msg of messages) {
          await axios.delete(`${SUPABASE_URL}/rest/v1/whatsapp_scheduled_messages?id=eq.${msg.id}`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
          const flow = msg.flow_json;
          const nextEdge = (flow?.edges || []).find(e => e.source === msg.current_node_id);
          if (nextEdge) {
            await axios.post(`${SUPABASE_URL}/rest/v1/whatsapp_flow_states`, {
              phone: msg.phone, flow_id: msg.flow_id || flow.id || '00000000-0000-0000-0000-000000000000',
              current_node_id: nextEdge.target, variables: msg.variables, updated_at: new Date().toISOString()
            }, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'resolution=merge-duplicates' } }).catch(() => null);

            await axios.post(selfUrl, { entry: [{ changes: [{ value: { messages: [{ from: msg.phone, type: 'text', text: { body: "RESUME_DELAY_FLOW" } }] } }] }] }, { headers: { 'Content-Type': 'application/json' } }).catch(() => null);
            processedCount++;
          }
        }
        return res.status(200).json({ status: 'ok', processed: processedCount });
      }

      if (req.query.action === 'contacts') {
        try {
          const contactsMap = new Map();
          
          const [chatRes, orderRes] = await Promise.allSettled([
            axios.get(`${SUPABASE_URL}/rest/v1/whatsapp_chat_settings?select=phone,customer_name,updated_at,tags&order=updated_at.desc`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }),
            axios.get(`${SUPABASE_URL}/rest/v1/shopify_orders?select=phone_last10,customer_name,fulfillment_status,cancelled_at,created_at&order=created_at.desc&limit=1000`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } })
          ]);
          
          if (chatRes.status === 'fulfilled' && chatRes.value.data) {
            chatRes.value.data.forEach(chat => {
              contactsMap.set(chat.phone, { phone: chat.phone, customer_name: chat.customer_name || 'Unknown', tags: new Set(['WhatsApp Contact']), updated_at: chat.updated_at });
              if (chat.tags && Array.isArray(chat.tags)) chat.tags.forEach(t => contactsMap.get(chat.phone).tags.add(t));
            });
          }
          
          if (orderRes.status === 'fulfilled' && orderRes.value.data) {
            orderRes.value.data.forEach(order => {
              if (!order.phone_last10) return;
              const phone = '91' + order.phone_last10;
              if (!contactsMap.has(phone)) contactsMap.set(phone, { phone, customer_name: order.customer_name || 'Customer', tags: new Set(), updated_at: order.created_at });
              const c = contactsMap.get(phone);
              c.tags.add('Shopify Customer');
              if (order.cancelled_at) c.tags.add('Cancelled');
              else if (order.fulfillment_status === 'fulfilled') c.tags.add('Fulfilled');
              else c.tags.add('Purchased');
            });
          }
          
          // Fetch NFU users & abandoned carts
          const nfuUrls = [
            process.env.SUPABASE_NFU_DB_URL || 'postgres://postgres.nfubnpgfwgrlpfhcbjlg:11fit@202612@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
            'postgres://postgres:11fit@202612@db.nfubnpgfwgrlpfhcbjlg.supabase.co:6543/postgres'
          ];
          for (const url of nfuUrls) {
            const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
            try {
              await client.connect();
              const resUsers = await client.query('SELECT phone, created_at FROM network_users ORDER BY created_at DESC LIMIT 1000');
              const resSessions = await client.query("SELECT customer_phone, created_at FROM checkout_sessions WHERE status = 'abandoned' ORDER BY created_at DESC LIMIT 500");
              
              resUsers.rows.forEach(u => {
                if (!u.phone) return;
                const p = '91' + String(u.phone).replace(/\D/g, '').slice(-10);
                if (!contactsMap.has(p)) contactsMap.set(p, { phone: p, customer_name: 'Store Visitor', tags: new Set(), updated_at: u.created_at });
                contactsMap.get(p).tags.add('OTP Verified');
              });
              
              resSessions.rows.forEach(s => {
                if (!s.customer_phone) return;
                const p = '91' + String(s.customer_phone).replace(/\D/g, '').slice(-10);
                if (!contactsMap.has(p)) contactsMap.set(p, { phone: p, customer_name: 'Cart Abandoneer', tags: new Set(), updated_at: s.created_at });
                contactsMap.get(p).tags.add('Abandoned Cart');
              });
              
              await client.end();
              break;
            } catch (e) { try { await client.end(); } catch(_) {} }
          }
          
          const mergedContacts = Array.from(contactsMap.values()).map(c => ({
            ...c, tags: Array.from(c.tags)
          })).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
          
          return res.status(200).json({ contacts: mergedContacts });
        } catch (err) {
          console.error(err);
          return res.status(500).json({ contacts: [], error: err.message });
        }
      }

      const { data } = await axios.get(
        `${SUPABASE_URL}/rest/v1/whatsapp_settings?select=*&order=id.desc&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const row = data?.[0] || {};
      return res.status(200).json({
        groq_api_key: row.groq_api_key || '',
        groq_model: row.groq_model || 'llama-3.3-70b-versatile',
        whatsapp_token: row.whatsapp_token ? '••••••' + row.whatsapp_token.slice(-8) : '',
        waba_id: row.waba_id || '2025586748064434',
        has_groq_key: !!row.groq_api_key,
        has_whatsapp_token: !!row.whatsapp_token,
        has_waba_id: !!(row.waba_id || '2025586748064434'),
        inst_language: row.inst_language || DEFAULT_INST_LANGUAGE,
        inst_order_security: row.inst_order_security || DEFAULT_INST_ORDER_SECURITY,
        inst_size_advisor: row.inst_size_advisor || DEFAULT_INST_SIZE_ADVISOR,
        inst_brand_policies: row.inst_brand_policies || DEFAULT_INST_BRAND_POLICIES,
        inst_custom: row.inst_custom || DEFAULT_INST_CUSTOM,
        workflows: row.workflows || {
          abandoned_cart: true,
          order_placed: true,
          order_shipped: true,
          out_for_delivery: true,
          order_delivered: true
        }
      });
    } catch (err) {
      return res.status(200).json({
        groq_api_key: '', groq_model: 'llama-3.3-70b-versatile', waba_id: '2025586748064434', has_groq_key: false, has_whatsapp_token: false, has_waba_id: true,
        inst_language: DEFAULT_INST_LANGUAGE,
        inst_order_security: DEFAULT_INST_ORDER_SECURITY,
        inst_size_advisor: DEFAULT_INST_SIZE_ADVISOR,
        inst_brand_policies: DEFAULT_INST_BRAND_POLICIES,
        inst_custom: DEFAULT_INST_CUSTOM,
        workflows: { abandoned_cart: true, order_placed: true, order_shipped: true, out_for_delivery: true, order_delivered: true }
      });
    }
  }

  // POST: Save WhatsApp AI settings
  if (req.method === 'POST') {
    try {
      const {
        groq_api_key, groq_model, whatsapp_token, waba_id,
        inst_language, inst_order_security, inst_size_advisor, inst_brand_policies, inst_custom,
        workflows
      } = req.body;

      // Check if settings row exists
      const { data: existing } = await axios.get(
        `${SUPABASE_URL}/rest/v1/whatsapp_settings?select=id&order=id.desc&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );

      const payload = {};
      if (groq_api_key !== undefined && groq_api_key !== '') payload.groq_api_key = groq_api_key;
      if (groq_model !== undefined) payload.groq_model = groq_model;
      if (whatsapp_token !== undefined && whatsapp_token !== '') payload.whatsapp_token = whatsapp_token;
      if (waba_id !== undefined && waba_id !== '') payload.waba_id = waba_id;
      if (inst_language !== undefined) payload.inst_language = inst_language;
      if (inst_order_security !== undefined) payload.inst_order_security = inst_order_security;
      if (inst_size_advisor !== undefined) payload.inst_size_advisor = inst_size_advisor;
      if (inst_brand_policies !== undefined) payload.inst_brand_policies = inst_brand_policies;
      if (inst_custom !== undefined) payload.inst_custom = inst_custom;
      if (workflows !== undefined) payload.workflows = workflows;
      payload.updated_at = new Date().toISOString();

      if (existing && existing.length > 0) {
        // Update existing row
        await axios.patch(
          `${SUPABASE_URL}/rest/v1/whatsapp_settings?id=eq.${existing[0].id}`,
          payload,
          { headers }
        );
      } else {
        // Insert new row
        await axios.post(
          `${SUPABASE_URL}/rest/v1/whatsapp_settings`,
          payload,
          { headers }
        );
      }

      return res.status(200).json({ success: true, message: 'WhatsApp AI settings saved!' });
    } catch (err) {
      console.error('Failed to save WhatsApp settings:', err.response?.data || err.message);
      return res.status(500).json({ error: err.response?.data || err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
