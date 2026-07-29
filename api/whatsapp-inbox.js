import axios from 'axios';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xkiukbebnntjzfilyfmh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query || {};

  // 1. GET ALL UNIQUE CHATS WITH META 24-HOUR WINDOW STATUS & AI PAUSED STATE
  if (req.method === 'GET' && (action === 'chats' || !action)) {
    try {
      // Fetch recent 200 memory logs
      const memRes = await axios.get(
        `${SUPABASE_URL}/rest/v1/whatsapp_chat_memory?select=*&order=created_at.desc&limit=250`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const rows = memRes.data || [];

      // Fetch AI settings & customer names for all phones
      let settingsMap = {};
      try {
        const setRes = await axios.get(
          `${SUPABASE_URL}/rest/v1/whatsapp_chat_settings?select=phone,ai_paused,customer_name,chat_status`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        (setRes.data || []).forEach(s => {
          settingsMap[s.phone] = {
            ai_paused: s.ai_paused || false,
            customer_name: s.customer_name || '',
            chat_status: s.chat_status || 'open'
          };
        });
      } catch (_) {
        // table might not exist yet
      }

      // Also check customer names from shopify_orders table for fast local name resolution
      let ordersNameMap = {};
      try {
        const ordRes = await axios.get(
          `${SUPABASE_URL}/rest/v1/shopify_orders?select=phone_last10,order_data&phone_last10=not.is.null&order=created_at.desc&limit=500`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        (ordRes.data || []).forEach(o => {
          const p = o.phone_last10;
          if (p && !ordersNameMap[p]) {
            const sh = o.order_data?.shipping_address || o.order_data?.customer || {};
            const name = [sh.first_name, sh.last_name].filter(Boolean).join(' ');
            if (name) ordersNameMap[p] = name;
          }
        });
      } catch (_) {}

      // Group by phone
      const chatsMap = {};
      rows.forEach(r => {
        if (!chatsMap[r.phone]) {
          const lastMsgTime = new Date(r.created_at).getTime();
          const hoursElapsed = (Date.now() - lastMsgTime) / (1000 * 3600);
          const settings = settingsMap[r.phone] || {};
          const cleanP = String(r.phone).replace(/\D/g, '').slice(-10);
          const resolvedName = settings.customer_name || ordersNameMap[cleanP] || '';

          chatsMap[r.phone] = {
            phone: r.phone,
            customer_name: resolvedName,
            last_message: r.content,
            last_role: r.role,
            created_at: r.created_at,
            is_within_24h: hoursElapsed <= 24,
            hours_elapsed: Math.round(hoursElapsed * 10) / 10,
            ai_paused: settings.ai_paused || false,
            chat_status: settings.chat_status || 'open',
            message_count: 1
          };
        } else {
          chatsMap[r.phone].message_count++;
        }
      });

      const chats = Object.values(chatsMap).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return res.status(200).json({ success: true, chats });
    } catch (err) {
      console.error('Failed to fetch chats:', err.response?.data || err.message);
      return res.status(500).json({ error: 'Failed to fetch WhatsApp chats' });
    }
  }

  // 2. GET MESSAGES FOR A SPECIFIC PHONE NUMBER
  if (req.method === 'GET' && action === 'messages') {
    const phone = req.query.phone;
    if (!phone) return res.status(400).json({ error: 'phone parameter required' });
    try {
      const memRes = await axios.get(
        `${SUPABASE_URL}/rest/v1/whatsapp_chat_memory?phone=eq.${encodeURIComponent(phone)}&select=*&order=created_at.asc&limit=100`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const messages = memRes.data || [];
      return res.status(200).json({ success: true, messages });
    } catch (err) {
      console.error('Failed to fetch messages:', err.response?.data || err.message);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  // 2B. STREAM CUSTOMER SHARED MEDIA (AUDIO, IMAGE, VIDEO) FROM META API
  if (req.method === 'GET' && action === 'media') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id required' });

    let token = process.env.WHATSAPP_TOKEN;
    try {
      const settingsRes = await axios.get(
        `${SUPABASE_URL}/rest/v1/whatsapp_settings?select=whatsapp_token&order=id.desc&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      if (settingsRes.data?.[0]?.whatsapp_token) token = settingsRes.data[0].whatsapp_token;
    } catch (_) {}

    if (!token) return res.status(500).json({ error: 'No WhatsApp token found' });

    try {
      // 1) Get private media URL from Meta
      const metaRes = await axios.get(`https://graph.facebook.com/v20.0/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const mediaUrl = metaRes.data?.url;
      const mimeType = metaRes.data?.mime_type || 'application/octet-stream';

      if (!mediaUrl) return res.status(404).json({ error: 'Media URL not found on Meta' });

      // 2) Download media binary stream from Meta
      const fileRes = await axios.get(mediaUrl, {
        headers: { 'Authorization': `Bearer ${token}` },
        responseType: 'arraybuffer'
      });

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(Buffer.from(fileRes.data));
    } catch (err) {
      console.error('Failed to stream media from Meta API:', err.message);
      return res.status(500).json({ error: 'Failed to download media' });
    }
  }

  // 3. POST ACTION: TOGGLE AI OR SEND MANUAL MESSAGE
  if (req.method === 'POST') {
    const { action: postAction, phone, ai_paused, text, media_url, template_name, type } = req.body || {};

    if (!phone) return res.status(400).json({ error: 'phone is required' });

    // 3A. Toggle AI Auto-Reply for this customer
    if (postAction === 'toggle_ai') {
      try {
        await axios.post(
          `${SUPABASE_URL}/rest/v1/whatsapp_chat_settings`,
          { phone, ai_paused: !!ai_paused, updated_at: new Date().toISOString() },
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            }
          }
        );
        return res.status(200).json({ success: true, phone, ai_paused: !!ai_paused });
      } catch (err) {
        console.error('Failed to toggle AI setting:', err.response?.data || err.message);
        return res.status(500).json({ error: 'Failed to save AI setting' });
      }
    }

    // 3A-2. Toggle Chat Open/Closed Status
    if (postAction === 'set_status') {
      const { chat_status } = req.body;
      try {
        await axios.post(
          `${SUPABASE_URL}/rest/v1/whatsapp_chat_settings`,
          { phone, chat_status: chat_status || 'open', updated_at: new Date().toISOString() },
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            }
          }
        );
        return res.status(200).json({ success: true, phone, chat_status: chat_status || 'open' });
      } catch (err) {
        console.error('Failed to update chat status:', err.response?.data || err.message);
        return res.status(500).json({ error: 'Failed to update chat status' });
      }
    }

    // 3B. Send Manual Message via WhatsApp Graph API
    if (postAction === 'send_message') {
      let token = process.env.WHATSAPP_TOKEN;
      try {
        const settingsRes = await axios.get(
          `${SUPABASE_URL}/rest/v1/whatsapp_settings?select=whatsapp_token&order=id.desc&limit=1`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        if (settingsRes.data?.[0]?.whatsapp_token) {
          token = settingsRes.data[0].whatsapp_token;
        }
      } catch (_) {}

      if (!token) {
        return res.status(500).json({ error: 'WhatsApp Graph Token not found in settings' });
      }

      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1189183190949431';
      const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;

      let payload = {
        messaging_product: 'whatsapp',
        to: phone
      };

      if (type === 'image' && media_url) {
        payload.type = 'image';
        payload.image = { link: media_url, caption: text || '' };
      } else if (type === 'audio' && media_url) {
        payload.type = 'audio';
        payload.audio = { link: media_url };
      } else if (type === 'template' && template_name) {
        payload.type = 'template';
        payload.template = {
          name: template_name,
          language: { code: 'en' }
        };
      } else {
        payload.text = { body: text || '' };
      }

      try {
        const metaRes = await axios.post(url, payload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        // Save manual reply to chat memory
        const displayContent = type === 'template'
          ? `[TEMPLATE SENT: ${template_name}]`
          : type === 'image'
          ? `[IMAGE] ${text || media_url}`
          : type === 'audio'
          ? `[AUDIO] ${media_url}`
          : text;

        try {
          await axios.post(
            `${SUPABASE_URL}/rest/v1/whatsapp_chat_memory`,
            { phone, role: 'assistant', content: displayContent },
            {
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );
          await axios.post(
            `${SUPABASE_URL}/rest/v1/whatsapp_chat_settings`,
            { phone, chat_status: 'open', updated_at: new Date().toISOString() },
            {
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
              }
            }
          );
        } catch (_) {}

        return res.status(200).json({
          success: true,
          message_id: metaRes.data?.messages?.[0]?.id || 'sent',
          content: displayContent
        });
      } catch (err) {
        const errMsg = err.response?.data?.error?.message || err.message;
        console.error('Failed to send WhatsApp manual reply:', errMsg);
        return res.status(500).json({ error: `Meta API Error: ${errMsg}` });
      }
    }

    // 3C. Direct Media Upload & Send from Phone Camera / Gallery / Mic
    if (postAction === 'upload_media') {
      let token = process.env.WHATSAPP_TOKEN;
      try {
        const settingsRes = await axios.get(
          `${SUPABASE_URL}/rest/v1/whatsapp_settings?select=whatsapp_token&order=id.desc&limit=1`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        if (settingsRes.data?.[0]?.whatsapp_token) token = settingsRes.data[0].whatsapp_token;
      } catch (_) {}

      if (!token) return res.status(500).json({ error: 'WhatsApp Graph Token not found in settings' });

      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1189183190949431';
      const { base64, media_type, caption } = req.body || {};
      if (!base64) return res.status(400).json({ error: 'base64 media data required' });

      try {
        // Parse base64
        const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const mimeType = matches ? matches[1] : (media_type === 'audio' ? 'audio/mpeg' : 'image/jpeg');
        const base64Data = matches ? matches[2] : base64;
        const buffer = Buffer.from(base64Data, 'base64');

        // Native Node 18+ Blob and FormData for Meta Media API
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        const blob = new Blob([buffer], { type: mimeType });
        form.append('file', blob, media_type === 'audio' ? 'voice_note.mp3' : 'photo.jpg');

        // 1) Upload to WhatsApp Media API
        const uploadRes = await axios.post(
          `https://graph.facebook.com/v20.0/${phoneId}/media`,
          form,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        const mediaId = uploadRes.data?.id;
        if (!mediaId) throw new Error('No media_id returned from Meta');

        // 2) Send media ID to customer via WhatsApp Messages API
        const sendUrl = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
        const payload = {
          messaging_product: 'whatsapp',
          to: phone
        };

        if (media_type === 'audio') {
          payload.type = 'audio';
          payload.audio = { id: mediaId };
        } else {
          payload.type = 'image';
          payload.image = { id: mediaId, caption: caption || '' };
        }

        const metaRes = await axios.post(sendUrl, payload, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        const displayContent = media_type === 'audio'
          ? `[AUDIO_ID:${mediaId}] [🎙️ Voice Note Sent]`
          : media_type === 'video'
            ? `[VIDEO_ID:${mediaId}] [🎥 Video Sent] ${caption || ''}`
            : `[IMAGE_ID:${mediaId}] [🖼️ Photo Sent] ${caption || ''}`;

        try {
          await axios.post(
            `${SUPABASE_URL}/rest/v1/whatsapp_chat_memory`,
            { phone, role: 'assistant', content: displayContent },
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' } }
          );
          await axios.post(
            `${SUPABASE_URL}/rest/v1/whatsapp_chat_settings`,
            { phone, chat_status: 'open', updated_at: new Date().toISOString() },
            {
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
              }
            }
          );
        } catch (_) {}

        return res.status(200).json({
          success: true,
          message_id: metaRes.data?.messages?.[0]?.id || 'sent',
          media_id: mediaId,
          content: displayContent
        });
      } catch (err) {
        const errMsg = err.response?.data?.error?.message || err.message;
        console.error('Failed to upload/send media via Meta API:', errMsg);
        return res.status(500).json({ error: `Meta Upload Error: ${errMsg}` });
      }
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
