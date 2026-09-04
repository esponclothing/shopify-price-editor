import { dbFetch } from './dbFetch.js';
// api/whatsapp-calling.js
// WhatsApp Business Calling API handler for 11FIT
// Handles: incoming call webhooks, answer, decline, end, call logs

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';
const WA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '1189183190949431';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret');
}

async function getWAToken() {
  try {
    const res = await dbFetch(`/rest/v1/whatsapp_settings?select=whatsapp_token&order=id.desc&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const rows = await res.json();
    return rows?.[0]?.whatsapp_token || process.env.WHATSAPP_TOKEN || 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
  } catch { return process.env.WHATSAPP_TOKEN || ''; }
}

async function supabase(path, method = 'GET', body = null, extra = {}) {
  const url = `/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...extra
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function getCustomerName(phone) {
  try {
    const clean = String(phone).replace(/\D/g, '').slice(-10);
    const { data } = await supabase(`whatsapp_chat_settings?phone=like.*${clean}*&select=customer_name&limit=1`);
    return data?.[0]?.customer_name || null;
  } catch { return null; }
}

async function logCallToChatMemory(phone, callId, status, duration) {
  try {
    const clean = String(phone).replace(/\D/g, '');
    const fullPhone = clean.length === 10 ? `91${clean}` : clean;
    let msg = '';
    if (status === 'answered') msg = `📞 Inbound call · ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')} · Answered`;
    else if (status === 'missed') msg = `📵 Missed call`;
    else if (status === 'declined') msg = `🚫 Call declined`;
    else msg = `📞 Call ended`;

    await supabase('whatsapp_chat_memory', 'POST', {
      phone: fullPhone,
      role: 'call_log',
      content: msg,
      metadata: JSON.stringify({ call_id: callId, status, duration })
    });
  } catch (err) {
    console.error('Failed to log call to chat memory:', err.message);
  }
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, phone, call_id, device_id } = req.query;

  try {
    // ─── GET: Fetch call logs for a phone ──────────────────────────
    if (req.method === 'GET' && action === 'logs') {
      if (phone) {
        const clean = String(phone).replace(/\D/g, '').slice(-10);
        const { data } = await supabase(
          `whatsapp_calls?phone=like.*${clean}*&order=created_at.desc&limit=50`
        );
        return res.json({ success: true, calls: data || [] });
      }
      // All recent calls
      const { data } = await supabase('whatsapp_calls?order=created_at.desc&limit=100');
      return res.json({ success: true, calls: data || [] });
    }

    // ─── GET: Active ringing calls ─────────────────────────────────
    if (req.method === 'GET' && action === 'ringing') {
      const { data } = await supabase('whatsapp_calls?status=eq.ringing&order=created_at.desc&limit=5');
      return res.json({ success: true, calls: data || [] });
    }

    // ─── POST: Answer a call ───────────────────────────────────────
    if (req.method === 'POST' && action === 'answer') {
      const { call_id: cid, sdp_answer, device_id: did } = req.body || {};
      if (!cid || !sdp_answer) return res.status(400).json({ error: 'call_id and sdp_answer required' });

      // Check not already answered by another device
      const { data: existing } = await supabase(`whatsapp_calls?id=eq.${cid}&limit=1`);
      const call = existing?.[0];
      if (!call) return res.status(404).json({ error: 'Call not found' });
      if (call.status === 'answered' && call.answered_by !== did) {
        return res.status(409).json({ error: 'Call already answered on another device', answered_by: call.answered_by });
      }

      // Send SDP answer to Meta
      const token = await getWAToken();
      const metaRes = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_NUMBER_ID}/calls`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          call_id: cid,
          action: 'pre_accept',
          session: {
            sdp_type: 'answer',
            sdp: sdp_answer
          }
        })
      });
      const metaData = await metaRes.json();
      if (!metaRes.ok) {
        console.error('Meta answer error:', metaData);
        return res.status(500).json({ error: 'Meta API error', detail: metaData });
      }

      // Update call record in Supabase
      await supabase(`whatsapp_calls?id=eq.${cid}`, 'PATCH', {
        status: 'answered',
        answered_by: did || 'unknown_device',
        answered_at: new Date().toISOString(),
        sdp_answer
      });

      // Clear ringing notification on other devices
      const baseUrl = 'https://' + (req.headers.host || 'shopify-price-editor.vercel.app');
      await fetch(`${baseUrl}/api/webpush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify',
          title: '📞 Call Answered',
          body: 'Answered on another device',
          tag: `call-${cid}`,
          requireInteraction: false,
          silent: true,
          renotify: false
        })
      }).catch(() => {});

      return res.json({ success: true, message: 'Call answered' });
    }

    // ─── POST: Decline a call ──────────────────────────────────────
    if (req.method === 'POST' && action === 'decline') {
      const { call_id: cid } = req.body || {};
      if (!cid) return res.status(400).json({ error: 'call_id required' });

      const token = await getWAToken();
      await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_NUMBER_ID}/calls`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', call_id: cid, action: 'reject' })
      });

      const { data: existing } = await supabase(`whatsapp_calls?id=eq.${cid}&limit=1`);
      const call = existing?.[0];

      await supabase(`whatsapp_calls?id=eq.${cid}`, 'PATCH', {
        status: 'declined',
        ended_at: new Date().toISOString()
      });

      // Clear ringing notification
      const baseUrl = 'https://' + (req.headers.host || 'shopify-price-editor.vercel.app');
      await fetch(`${baseUrl}/api/webpush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify',
          title: '📞 Call Declined',
          body: 'Call was declined',
          tag: `call-${cid}`,
          requireInteraction: false,
          silent: true,
          renotify: false
        })
      }).catch(() => {});

      if (call?.phone) await logCallToChatMemory(call.phone, cid, 'declined', 0);
      return res.json({ success: true, message: 'Call declined' });
    }

    // ─── POST: End a call ──────────────────────────────────────────
    if (req.method === 'POST' && action === 'end') {
      const { call_id: cid, duration_seconds } = req.body || {};
      if (!cid) return res.status(400).json({ error: 'call_id required' });

      const token = await getWAToken();
      await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_NUMBER_ID}/calls`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', call_id: cid, action: 'terminate' })
      }).catch(() => {});

      const { data: existing } = await supabase(`whatsapp_calls?id=eq.${cid}&limit=1`);
      const call = existing?.[0];
      const dur = parseInt(duration_seconds) || 0;

      await supabase(`whatsapp_calls?id=eq.${cid}`, 'PATCH', {
        status: 'ended',
        ended_at: new Date().toISOString(),
        duration_seconds: dur
      });

      // Clear ringing notification
      const baseUrl = 'https://' + (req.headers.host || 'shopify-price-editor.vercel.app');
      await fetch(`${baseUrl}/api/webpush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify',
          title: '📞 Call Ended',
          body: 'The call has ended',
          tag: `call-${cid}`,
          requireInteraction: false,
          silent: true,
          renotify: false
        })
      }).catch(() => {});

      if (call?.phone) await logCallToChatMemory(call.phone, cid, 'answered', dur);
      return res.json({ success: true, message: 'Call ended' });
    }

    // ─── POST: Mark missed ─────────────────────────────────────────
    if (req.method === 'POST' && action === 'missed') {
      const { call_id: cid } = req.body || {};
      if (!cid) return res.status(400).json({ error: 'call_id required' });

      const { data: existing } = await supabase(`whatsapp_calls?id=eq.${cid}&limit=1`);
      const call = existing?.[0];

      await supabase(`whatsapp_calls?id=eq.${cid}`, 'PATCH', {
        status: 'missed',
        ended_at: new Date().toISOString()
      });

      if (call?.phone) await logCallToChatMemory(call.phone, cid, 'missed', 0);
      return res.json({ success: true });
    }

    // ─── POST: Initiate Outbound Call ─────────────────────────────
    if (req.method === 'POST' && action === 'initiate_outbound') {
      const { phone, sdp_offer } = req.body || {};
      if (!phone || !sdp_offer) return res.status(400).json({ error: 'phone and sdp_offer required' });

      const cleanPhone = String(phone).replace(/\D/g, '');
      const toPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      
      const token = await getWAToken();
      
      try {
        // Attempt to create outbound call via Meta API
        const metaRes = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_NUMBER_ID}/calls`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: toPhone,
            session: {
              sdp_type: 'offer',
              sdp: sdp_offer
            }
          })
        });
        
        const metaData = await metaRes.json();
        
        if (!metaRes.ok) {
           console.error('[META CALL ERROR]', JSON.stringify(metaData));
           const errStr = JSON.stringify(metaData);
           
           let errorMsg = 'Meta API rejected the call. The customer might not have a valid WhatsApp account, or the 24-hour window expired.';
           if (errStr.includes('window') || errStr.includes('131047')) {
              errorMsg = 'Cannot call: The 24-hour customer service window has expired. The customer must message you first.';
           } else if (errStr.includes('138006') || errStr.includes('permission')) {
              errorMsg = 'Cannot call: Customer has not granted call permissions. They must call you first, or tap a "Call" button on a WhatsApp template.';
           }
           
           return res.status(500).json({ error: errorMsg, detail: metaData });
        }
        
        const callId = metaData.id || ('out_' + Date.now());
        
        await supabase('whatsapp_calls', 'POST', {
          id: callId,
          phone: toPhone,
          direction: 'outbound',
          status: 'calling',
          started_at: new Date().toISOString()
        });

        return res.json({ success: true, call_id: callId });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to initiate outbound call', detail: err.message });
      }
    }

    // ─── GET: Outbound Call Status ───────────────────────────────
    if (req.method === 'GET' && action === 'outbound_status') {
      const { call_id, phone } = req.query;
      if (!call_id) return res.status(400).json({ error: 'call_id required' });

      let { data } = await supabase(`whatsapp_calls?id=eq.${call_id}&limit=1`);
      
      // Fallback: Webhook might have changed the ID to Meta's wacid. Use phone to find the latest outbound call.
      if ((!data || data.length === 0) && phone) {
        const cleanPhone = String(phone).replace(/\D/g, '');
        const toPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const res = await supabase(`whatsapp_calls?phone=eq.${toPhone}&direction=eq.outbound&order=created_at.desc&limit=1`);
        data = res.data;
      }

      if (!data || data.length === 0) return res.json({ status: 'not_found' });

      return res.json({
        status: data[0].status,
        sdp_answer: data[0].sdp_answer || null
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('WhatsApp Calling Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

