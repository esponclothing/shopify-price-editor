import axios from 'axios';

// Permanent Credentials
const SHOPIFY_STORE_URL = process.env.VITE_SHOPIFY_STORE_URL || 'i2tu0d-jc.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.VITE_SHOPIFY_ACCESS_TOKEN || '';
const GROQ_API_KEY = process.env.VITE_GROQ_API_KEY || '';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xkiukbebnntjzfilyfmh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';

const PROCESSED_WEBHOOK_IDS = new Set();

// Log execution to whatsapp_executions table via Supabase REST API
async function logExecution({ phone, user_message, ai_reply, status, tools_called, error_message, duration_ms }) {
  try {
    await axios.post(
      `${SUPABASE_URL}/rest/v1/whatsapp_executions`,
      { phone: phone || 'N/A', user_message: user_message || '', ai_reply: ai_reply || '', status, tools_called: tools_called || 'None', error_message: error_message || null, duration_ms: duration_ms || 0 },
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('Failed to log execution:', err.response?.data || err.message);
  }
}

// Save chat message to Supabase via REST API
async function saveChatMessage(phone, role, content) {
  try {
    await axios.post(
      `${SUPABASE_URL}/rest/v1/whatsapp_chat_memory`,
      { phone, role, content },
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('Failed to save chat message:', err.response?.data || err.message);
  }
}

// ─── WEB PUSH NOTIFICATIONS (For Closed-App Alerts) ───
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BIqLUY30-N9qSJrCz4tF1C65XgCRVyr-1TmiCTG2MNFL2_8_EAC4o626ehSdKSM5uUpNPJvpcNCjwOen8evAjRU';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'MJiZ0ppPI4Jx1RM43ryneCtprRbgnsaSGnBmCooFqN0';

try {
  import('web-push').then((webpush) => {
    webpush.default.setVapidDetails('mailto:admin@11fit.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    global.webpush = webpush.default;
  }).catch(() => {});
} catch (_) {}

async function sendPushNotificationToAll(title, body, data = { url: '/' }) {
  if (!global.webpush) return;
  try {
    const subRes = await axios.get(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?select=subscription`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const subs = subRes.data || [];
    if (subs.length === 0) return;

    const vibrate = data.vibrate;
    if (vibrate) delete data.vibrate;

    const payload = JSON.stringify({
      title: title || '💬 11FIT: New WhatsApp Message',
      body: body || 'A customer sent you a message',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'wa-new-msg',
      vibrate,
      data
    });

    await Promise.allSettled(
      subs.map(async ({ subscription }) => {
        try {
          await global.webpush.sendNotification(subscription, payload);
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await axios.delete(
              `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`,
              { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
            ).catch(() => {});
          }
        }
      })
    );
  } catch (err) {
    console.error('Failed to broadcast Web Push notification:', err.message);
  }
}


// Get recent chat history via REST API
async function getChatHistory(phone) {
  try {
    const res = await axios.get(
      `${SUPABASE_URL}/rest/v1/whatsapp_chat_memory?phone=eq.${encodeURIComponent(phone)}&select=role,content&order=created_at.desc&limit=6`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const rows = res.data || [];
    return rows.reverse().map(r => `${r.role.toUpperCase()}: ${r.content}`).join('\n');
  } catch (err) {
    console.error('Failed to get chat history:', err.response?.data || err.message);
    return '';
  }
}

// Tool 1: Shopify Order Lookup with 10-Digit Mobile Verification & Exact Location (DB + Live)
async function lookupOrder(orderNumber, senderPhone = '', userText = '', history = '') {
  const pureNum = String(orderNumber || '').replace(/[^0-9]/g, '');
  const cleanSender = String(senderPhone || '').replace(/\D/g, '').slice(-10);

  try {
    let order = null;

    // STEP 1: Always check our fast Supabase shopify_orders DB table first
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        let queryUrl = '';
        if (pureNum) {
          queryUrl = `${SUPABASE_URL}/rest/v1/shopify_orders?or=(name.eq.%23${pureNum},order_number.eq.${pureNum})&limit=1`;
        } else if (cleanSender && cleanSender.length === 10) {
          queryUrl = `${SUPABASE_URL}/rest/v1/shopify_orders?or=(phone_last10.eq.${cleanSender},alt_phone_last10.eq.${cleanSender})&order=created_at.desc&limit=1`;
        }

        if (queryUrl) {
          const dbRes = await axios.get(queryUrl, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          const rows = dbRes.data || [];
          if (rows.length > 0) {
            const row = rows[0];
            const oData = row.order_data || {};
            order = {
              name: row.name || `#${row.order_number}`,
              phone: row.phone_last10 || oData.phone || oData.customer?.phone || oData.shipping_address?.phone || '',
              shipping_address: oData.shipping_address || {},
              fulfillments: [{
                tracking_company: row.tracking_company || oData.fulfillments?.[0]?.tracking_company || '11FIT Express Delivery',
                tracking_number: row.tracking_number || oData.fulfillments?.[0]?.tracking_number,
                tracking_url: row.tracking_url || oData.fulfillments?.[0]?.tracking_url || oData.fulfillments?.[0]?.tracking_urls?.[0] || 'https://www.icarry.in'
              }],
              fulfillment_status: row.fulfillment_status || oData.fulfillment_status || 'unfulfilled',
              financial_status: oData.financial_status || 'paid',
              total_price: row.total_price || oData.total_price || '0'
            };
          }
        }
      } catch (err) {
        console.error('DB order lookup warning:', err.message);
      }
    }

    // STEP 2: Fallback to Shopify API if order number provided and not in DB
    if (!order && pureNum) {
      const url = `https://${SHOPIFY_STORE_URL}/admin/api/2024-10/orders.json?status=any&name=${pureNum}`;
      const res = await axios.get(url, {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      });
      const orders = res.data.orders || [];
      if (orders.length > 0) {
        order = orders[0];
      }
    }

    if (!order) {
      return { error: `No matching order found in 11FIT store for ${pureNum ? '#' + pureNum : cleanSender}.` };
    }

    const registeredPhone = order.phone || order.customer?.phone || order.shipping_address?.phone || cleanSender || '';
    const order10Digits = String(registeredPhone).replace(/[^0-9]/g, '').slice(-10);

    const destination_location = `${order.shipping_address?.city || 'India'}, ${order.shipping_address?.province || ''} - ${order.shipping_address?.zip || ''}`.replace(/^[,\s-]+|[,\s-]+$/g, '') || 'India';
    const courier_company = order.fulfillments?.[0]?.tracking_company || '11FIT Express Delivery';
    const tracking_url = order.fulfillments?.[0]?.tracking_url || order.fulfillments?.[0]?.tracking_urls?.[0] || 'https://www.icarry.in';
    const rawStatus = order.fulfillment_status || 'unfulfilled';
    const readableStatus = rawStatus === 'fulfilled' ? 'FULFILLED / SHIPPED (In Transit)' : rawStatus.toUpperCase();

    const finStatus = (order.financial_status || '').toLowerCase();
    const totalAmount = `₹${order.total_price || 0}`;
    const payment_status = finStatus === 'paid'
      ? `💳 PAID ONLINE (Prepaid - ${totalAmount})`
      : finStatus === 'partially_paid'
      ? `🪙 PARTIALLY PAID (Advance Paid | Balance to Pay on COD: ${totalAmount})`
      : `💵 CASH ON DELIVERY (COD | Please Pay ${totalAmount} on Delivery)`;

    return {
      order_number: order.name,
      registered_mobile_10_digits: order10Digits || 'No mobile registered',
      status: readableStatus,
      payment_status,
      financial_status: order.financial_status,
      total_price: totalAmount,
      destination_location,
      courier_company,
      tracking_url,
      CRITICAL_INSTRUCTION_TO_AI: `You MUST compare Customer ka Current WhatsApp Number or Customer ka bataya hua 10-digit number with registered_mobile_10_digits (${order10Digits}). If they DO NOT MATCH exactly, DO NOT reveal status or tracking_url! When answering order status, ALWAYS clearly state the payment_status (${payment_status}) and order status. Never output '[SHOPIFY ORDER RESULT...]' or any JSON in your reply!`
    };
  } catch (err) {
    return { error: err.message };
  }
}

// Smart keyword extractor for Shopify GraphQL search
function extractProductKeyword(text) {
  if (/combo|trio|pack|offer|deal|discount/i.test(text)) {
    if (!/short|oversize|t\-?i?shirt|shirt|tee|pant|track/i.test(text)) {
      return '';
    }
  }
  const terms = [];
  if (/short/i.test(text)) terms.push('shorts');
  if (/oversize|t\-?i?shirt|shirt|tee/i.test(text)) terms.push('shirt');
  if (/pant|track|lower|trouser/i.test(text)) terms.push('pant');
  return terms.join(' ');
}

// Tool 2: Shopify GraphQL Dynamic Product & Combo Search (Direct from shopify_combos DB table)
async function searchProducts(userText) {
  const cleanKeyword = extractProductKeyword(userText);
  const isComboSearch = /combo|trio|pack|offer|deal|discount/i.test(userText);

  // 1. Fetch active combos created by our app directly from Supabase DB shopify_combos
  let dbCombos = [];
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const dbRes = await axios.get(
        `${SUPABASE_URL}/rest/v1/shopify_combos?is_active=eq.true&order=updated_at.desc`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      dbCombos = dbRes.data || [];
    } catch (e) {
      console.warn('DB combos lookup warning:', e.message);
    }
  }

  // 2. Fetch products from Shopify GraphQL
  const query = `
    query SearchProducts($query: String!) {
      products(first: 50, query: $query) {
        edges {
          node {
            id
            title
            handle
            variants(first: 1) {
              edges {
                node { price }
              }
            }
          }
        }
      }
    }
  `;
  try {
    const res = await axios.post(
      `https://${SHOPIFY_STORE_URL}/admin/api/2024-10/graphql.json`,
      { query, variables: { query: `status:active ${cleanKeyword}` } },
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    let edges = res.data?.data?.products?.edges || [];

    // Prioritize products that have a matching active DB combo
    edges.sort((a, b) => {
      const aId = String(a.node.id).replace(/\D/g, '');
      const bId = String(b.node.id).replace(/\D/g, '');
      const aCombo = dbCombos.find(c => String(c.product_id) === aId || (c.product_title && a.node.title.toLowerCase().includes(c.product_title.toLowerCase())));
      const bCombo = dbCombos.find(c => String(c.product_id) === bId || (c.product_title && b.node.title.toLowerCase().includes(c.product_title.toLowerCase())));
      return (bCombo ? 1 : 0) - (aCombo ? 1 : 0);
    });

    const productLines = edges.slice(0, 6).map(e => {
      const p = e.node;
      const rawId = String(p.id).replace(/\D/g, '');
      const singlePrice = p.variants.edges[0]?.node?.price || 'N/A';
      
      const matchingCombo = dbCombos.find(c => String(c.product_id) === rawId || (c.product_title && p.title.toLowerCase().includes(c.product_title.toLowerCase())));
      let comboLine = '';
      if (matchingCombo && Number(matchingCombo.combo_count) > 0) {
        comboLine = ` | 🔥 *COMBO OFFER:* Pack of ${matchingCombo.combo_count} @ *₹${matchingCombo.combo_price}* (Coupon: *${matchingCombo.discount_code}*)`;
      }

      return `👕 *${p.title}*\n💰 *Single:* ₹${singlePrice}${comboLine}\n🔗 *Buy Now:* https://11fit.in/products/${p.handle}`;
    });

    // If customer asked about combos, prepend all active store combos from DB at the very top
    if (isComboSearch && dbCombos.length > 0) {
      const summaryList = dbCombos.map(c => 
        `🔥 *${c.product_title}* — Pack of ${c.combo_count} @ *₹${c.combo_price}* (Coupon: *${c.discount_code}*)`
      );
      return [...summaryList, '', ...productLines];
    }

    return productLines;
  } catch (err) {
    return { error: err.message };
  }
}

// Tool 3: 11FIT AI Size & Fit Advisor Tool
function recommendSize(userText) {
  const weightMatch = userText.match(/(?:weight\s*is\s*|weight\s*|wt\s*|@\s*|^|\D)(\d{2,3})\s*(?:kg|kilo|k)\b/i) || userText.match(/\b(\d{2,3})\s*(?:kg|kilo)\b/i);
  const waistMatch = userText.match(/(?:waist|kamar)\s*(?:is\s*|of\s*|=|-|:)?\s*(\d{2})\b/i) || userText.match(/\b(\d{2})\s*(?:waist|kamar|inch|in)\b/i);

  if (weightMatch) {
    const kg = parseInt(weightMatch[1], 10);
    let teeSize = 'M (Medium)';
    let teeChest = '44"';
    let bottomSize = 'L (30-32" waist)';
    if (kg < 60) {
      teeSize = 'S (Small)'; teeChest = '42"'; bottomSize = 'M (28-30" waist)';
    } else if (kg <= 72) {
      teeSize = 'M (Medium)'; teeChest = '44"'; bottomSize = 'M or L (29-31" waist)';
    } else if (kg <= 84) {
      teeSize = 'L (Large)'; teeChest = '46"'; bottomSize = 'L or XL (31-33" waist)';
    } else if (kg <= 95) {
      teeSize = 'XL (Extra Large)'; teeChest = '48"'; bottomSize = 'XL or XXL (33-35" waist)';
    } else {
      teeSize = 'XXL (Double XL)'; teeChest = '50"'; bottomSize = 'XXL (35-37" waist)';
    }

    return `[11FIT SIZE & FIT RECOMMENDATION FOR WEIGHT ~${kg} KG]:\n` +
      `👕 Oversized T-Shirts: Recommended Size **${teeSize}** (Chest ${teeChest} | Premium Boxy Drop-Shoulder Fit)\n` +
      `🩳 Shorts & Track Pants: Recommended Size **${bottomSize}** (4-Way Lycra stretchable waistband with drawstring)\n` +
      `💡 Note: 11FIT tees already have a stylish drop-shoulder oversized streetwear cut — no need to size up for an oversized look!`;
  }

  if (waistMatch) {
    const waist = parseInt(waistMatch[1], 10);
    let bottomSize = 'M (Medium - 28-30")';
    if (waist >= 35) bottomSize = 'XXL (Double XL - 34-36"+)';
    else if (waist >= 33) bottomSize = 'XL (Extra Large - 32-34")';
    else if (waist >= 31) bottomSize = 'L (Large - 30-32")';

    return `[11FIT SIZE RECOMMENDATION FOR ~${waist}" WAIST]:\n` +
      `🩳 Recommended Bottom Size: **${bottomSize}** (4-Way Lycra stretchable waistband + adjustable drawstring for perfect comfort)\n` +
      `👕 For Oversized Tees: Choose based on chest/weight (M for 65-75kg, L for 75-85kg, XL for 85-95kg).`;
  }

  return `[11FIT GENERAL SIZE & FIT GUIDE]:\n` +
    `👕 Oversized T-Shirts (Combed Cotton Drop-Shoulder Boxy Fit):\n` +
    `   • S: Chest 42" (~50-63 kg)\n` +
    `   • M: Chest 44" (~63-73 kg)\n` +
    `   • L: Chest 46" (~74-84 kg)\n` +
    `   • XL: Chest 48" (~85-95 kg)\n` +
    `   • XXL: Chest 50" (~96-110 kg)\n` +
    `🩳 4-Way Lycra Shorts & Track Pants (Stretchable Waistband):\n` +
    `   • M (28-30"), L (30-32"), XL (32-34"), XXL (34-36"+)\n` +
    `💡 Advice: Our tees are already oversized streetwear fit — take your normal size!`;
}

// Send WhatsApp Reply via Meta Graph API
async function sendWhatsAppMessage(toPhone, textBody) {
  let token = process.env.WHATSAPP_TOKEN || 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
  try {
    const settingsRes = await axios.get(
      `${SUPABASE_URL}/rest/v1/whatsapp_settings?select=whatsapp_token&order=id.desc&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (settingsRes.data?.[0]?.whatsapp_token) {
      token = settingsRes.data[0].whatsapp_token;
    }
  } catch (_) { /* fallback to env token */ }

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1189183190949431';
  if (!token) {
    console.log('[DRY RUN - No WHATSAPP_TOKEN in env/db] Would send to:', toPhone, 'Text:', textBody);
    return { success: true, dry_run: true };
  }
  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  return await axios.post(
    url,
    {
      messaging_product: 'whatsapp',
      to: toPhone,
      text: { body: textBody }
    },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
}

export default async function handler(req, res) {
  const startTime = Date.now();

  // 1. Meta Webhook Verification
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === (process.env.WHATSAPP_VERIFY_TOKEN || '11fit_webhook_2026')) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verification failed' });
  }

  // 2. Handle POST messages from WhatsApp
  if (req.method === 'POST') {
    let senderPhone = 'Unknown';
    let userText = '';
    const toolsCalledList = [];
    try {
      const entry = req.body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      // AUTO-CAPTURE WABA_ID: Save WhatsApp Business Account ID to settings whenever a webhook arrives
      const wabaId = entry?.id;
      if (wabaId && SUPABASE_URL && SUPABASE_KEY) {
        axios.patch(
          `${SUPABASE_URL}/rest/v1/whatsapp_settings?id=eq.1`,
          { waba_id: String(wabaId) },
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' } }
        ).catch(() => {});
      }

      // CRITICAL STATUS FILTER: Ignore sent / delivered / read receipts, but accept text, audio, image, and video!
      if (!message || (message.type !== 'text' && message.type !== 'audio' && message.type !== 'image' && message.type !== 'video')) {
        await logExecution({
          phone: value?.contacts?.[0]?.wa_id || 'System Status',
          user_message: 'Status update (sent/delivered/read receipt)',
          ai_reply: 'Ignored — no action taken.',
          status: 'IGNORED',
          tools_called: 'None',
          duration_ms: Date.now() - startTime
        });
        return res.status(200).json({ status: 'ignored_non_text_or_receipt' });
      }

      senderPhone = message.from;
      const senderName = value?.contacts?.[0]?.profile?.name || '';
      if (senderPhone && SUPABASE_URL && SUPABASE_KEY) {
        const upsertPayload = {
          phone: senderPhone,
          chat_status: 'open',
          updated_at: new Date().toISOString()
        };
        if (senderName) upsertPayload.customer_name = senderName;
        axios.post(
          `${SUPABASE_URL}/rest/v1/whatsapp_chat_settings`,
          upsertPayload,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates'
            }
          }
        ).catch(() => {});
      }

      if (message.type === 'audio') {
        const audioId = message.audio?.id;
        userText = audioId ? `[AUDIO_ID:${audioId}] [🎙️ Voice Note / Audio Received]` : '[🎙️ Voice Note Received]';
      } else if (message.type === 'image') {
        const imageId = message.image?.id;
        const caption = message.image?.caption || '';
        userText = imageId ? `[IMAGE_ID:${imageId}] [🖼️ Image]: ${caption}` : `[🖼️ Image]: ${caption}`;
      } else if (message.type === 'video') {
        const videoId = message.video?.id;
        const caption = message.video?.caption || '';
        userText = videoId ? `[VIDEO_ID:${videoId}] [🎥 Video]: ${caption}` : `[🎥 Video]: ${caption}`;
      } else {
        userText = message.text?.body || '';
      }

      // CRITICAL DEDUPLICATION: Ignore duplicate webhook retries from WhatsApp Meta Cloud API
      const messageId = message.id;
      if (messageId && PROCESSED_WEBHOOK_IDS.has(messageId)) {
        console.log(`[DEDUPE] Ignoring duplicate WhatsApp webhook retry for message ID: ${messageId}`);
        return res.status(200).json({ status: 'ignored_duplicate_webhook' });
      }
      if (messageId) {
        PROCESSED_WEBHOOK_IDS.add(messageId);
        if (PROCESSED_WEBHOOK_IDS.size > 500) {
          const first = PROCESSED_WEBHOOK_IDS.values().next().value;
          PROCESSED_WEBHOOK_IDS.delete(first);
        }
      }

      // Read last 6 messages from Supabase Memory via REST API
      const history = await getChatHistory(senderPhone);

      // Save user message to Supabase
      await saveChatMessage(senderPhone, 'user', userText);

      // ─── BROADCAST PUSH NOTIFICATION ───
      // Send Web Push notification to all subscribed devices (PC & Mobile, even when app is closed)
      await sendPushNotificationToAll(`💬 New WhatsApp: +${senderPhone}`, userText, { url: '/' });

      // DO NOT send automated AI replies for audio, image, or video messages
      if (message.type === 'audio' || message.type === 'image' || message.type === 'video') {
        console.log(`[MEDIA RECEIVED] Skipping automated AI reply for ${message.type} from ${senderPhone}`);
        await logExecution({
          phone: senderPhone,
          user_message: userText,
          ai_reply: `[Media Received: ${message.type.toUpperCase()}] — No automated reply sent.`,
          status: 'MEDIA_RECEIVED',
          tools_called: 'None',
          duration_ms: Date.now() - startTime
        });
        return res.status(200).json({ status: 'ignored_media_auto_reply', phone: senderPhone });
      }

      // CHECK IF AI IS PAUSED / MANUAL MODE IS ACTIVE FOR THIS PHONE NUMBER
      try {
        const setRes = await axios.get(
          `${SUPABASE_URL}/rest/v1/whatsapp_chat_settings?phone=eq.${encodeURIComponent(senderPhone)}&select=ai_paused&limit=1`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        if (setRes.data?.[0]?.ai_paused) {
          console.log(`[AI PAUSED] Manual takeover mode active for ${senderPhone}. Skipping auto-reply.`);
          await logExecution({
            phone: senderPhone,
            user_message: userText,
            ai_reply: '⏸️ AI Paused — User message received in Manual Mode.',
            status: 'MANUAL_MODE',
            tools_called: 'None',
            duration_ms: Date.now() - startTime
          });
          return res.status(200).json({ status: 'ai_paused_manual_mode', phone: senderPhone });
        }
      } catch (_) {
        // Table might not exist yet, continue normally
      }

      // Execute AI reasoning & Tool checks
      let toolContext = '';
      let orderNumToLookup = null;
      const digitsOnly = userText.replace(/[^0-9]/g, '');
      if (digitsOnly.length >= 10) {
        // Customer is providing a 10-digit mobile number (even with spaces or dashes like '91587 09012')
        const historyOrderMatch = history.match(/(?:#|order\s*)([12]\d{3})\b/i) || history.match(/\b([12]\d{3})\b/);
        if (historyOrderMatch) {
          orderNumToLookup = historyOrderMatch[1];
        }
      } else {
        const explicitOrderMatch = userText.match(/(?:order|#)\s*([12]\d{3})\b/i);
        if (explicitOrderMatch) {
          orderNumToLookup = explicitOrderMatch[1];
        } else {
          const standaloneMatch = userText.match(/(?:^|\D)([12]\d{3})(?:\D|$)/);
          if (standaloneMatch) {
            orderNumToLookup = standaloneMatch[1];
          }
        }
      }

      if (orderNumToLookup) {
        toolsCalledList.push(`Order Lookup (#${orderNumToLookup})`);
        const orderInfo = await lookupOrder(orderNumToLookup, senderPhone, userText, history);
        toolContext += `\n[SHOPIFY ORDER RESULT FOR #${orderNumToLookup}]: ${JSON.stringify(orderInfo)}`;
      }
      if (!orderNumToLookup || /short|combo|trio|pack|t\-?shirt|shirt|oversize|tee|pant|track|lower|trouser|clothes|kuch|dikhao|price|offer|deal|discount|buy|link|item|product|collection/i.test(userText)) {
        toolsCalledList.push(`Product & Combo Search (${extractProductKeyword(userText)})`);
        const productsInfo = await searchProducts(userText);
        toolContext += `\n[SHOPIFY GRAPHQL PRODUCTS & COMBOS RESULT]: ${JSON.stringify(productsInfo)}`;
      }
      if (/size|fit|height|weight|wt\b|lamba|inch|cm|kg|kilo|medium|large|small|xl|xxl|5['']?\d|6['']?\d|waist|kamar|seena|chest/i.test(userText)) {
        toolsCalledList.push('11FIT AI Size & Fit Advisor');
        const sizeInfo = recommendSize(userText);
        toolContext += `\n${sizeInfo}`;
      }

      // Fetch dynamic editable AI instructions from whatsapp_settings table
      let instLanguage = '';
      let instOrderSecurity = '';
      let instSizeAdvisor = '';
      let instBrandPolicies = '';
      let instCustom = '';
      try {
        const { data: setRows } = await axios.get(
          `${SUPABASE_URL}/rest/v1/whatsapp_settings?select=*&order=id.desc&limit=1`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        const sr = setRows?.[0] || {};
        instLanguage = sr.inst_language || '';
        instOrderSecurity = sr.inst_order_security || '';
        instSizeAdvisor = sr.inst_size_advisor || '';
        instBrandPolicies = sr.inst_brand_policies || '';
        instCustom = sr.inst_custom || '';
      } catch (_) {}

      // Prepare system prompt exactly matching 100% of n8n workflow + editable instructions
      const systemPrompt = `Tum "11FIT AI Stylist & Sales Assistant" ho — India ke premium men's sportswear aur streetwear brand 11FIT (www.11fit.in) ke official WhatsApp shopping & support buddy!

=== 🗣️ DYNAMIC LANGUAGE & TONE MIRRORING (AUTOMATIC SWITCHING) ===
${instLanguage || `- **AUTOMATIC LANGUAGE SWITCHING:** Customer jis language mein message kare, tum AUTOMATICALLY ussi language mein reply karo!
- **AUTOMATIC TONE MIRRORING:** Customer ke tone aur mood ko instantly mirror karo.
- **SHORT & CRISP REPLIES:** Maximum 2 to 4 lines per reply! WhatsApp par lambe paragraphs KABHI MAT likho.`}

=== 🚨 CRITICAL WHATSAPP RULE: SHORT & CRISP REPLIES ONLY! ===
- **MAXIMUM 2 TO 4 LINES PER REPLY!** WhatsApp par lambe paragraphs, essays ya boring filler lines KABHI MAT likho.
- Directly mudde ki baat karo. Unnecessary preamble mat likho.
- **NEVER tell customer to contact us on WhatsApp (+91 74949 61428)** because they are ALREADY chatting with us on this WhatsApp number!

=== 🔐 CUSTOMER LIVE WHATSAPP NUMBER ===
Customer ka Current WhatsApp Number: ${senderPhone}

=== 🛍️ LIVE SHOPIFY PRODUCTS & DYNAMIC COMBOS (100% REAL-TIME FROM SHOPIFY STORE) ===
- Jab bhi customer products, prices, combos, ya offers maange, check [SHOPIFY GRAPHQL PRODUCTS & COMBOS RESULT].
- **DYNAMIC COMBO AWARENESS & STRICT ANTI-HALLUCINATION RULE (VERY IMPORTANT!):**
  * Har product ke saath uska **live \`combo_config\` metafield** checked hai.
  * **SIRF WAHI products ko "Combo Offer" bolkar batao jinke saath \`| *Combo Offer:* Pack of X @ ₹...\` likha hua hai!**
  * Agar toolContext mein sirf 1 ya 2 products par hi combo offer hai, toh SACH BOLO: *"Bhai, abhi humare paas is product par super hit combo offer active hai: [Card]. Baaki tees aur track pants single unit mein available hain!"*
  * **KABHI BHI bina combo wale product ko combo bolkar MAT BECHO aur KABHI BHI yeh MAT BOLO ki "Aur bhi combos hain" agar toolContext mein koi aur combo listed na ho!**

=== 🚨 CRITICAL CHAT RULE: NEVER PRINT TOOL LOGS OR BRACKETED TEXT ===
- KABHI BHI "[SHOPIFY ORDER RESULT...]" ya "[SHOPIFY GRAPHQL...]" ya koi JSON/bracket text customer ke message mein MAT LIKHO! Sirf natural friendly text reply bhejho.

=== 🚨 CRITICAL SECURITY & 10-DIGIT MOBILE VERIFICATION FLOW (EXACT N8N WORKFLOW) ===
${instOrderSecurity || `1. ORDER NUMBER FORMAT: 11FIT ke order numbers "#" se start hote hain (jaise #1129, #1039). Customer "1039" bole ya "#1039", tum hamesha order number recognize karo.
2. AUTO-VERIFICATION & 10-DIGIT VERIFICATION FLOW (MANDATORY):
   - Current WhatsApp Number aur Order ke registered_mobile_10_digits ko compare karo.
   - ✅ AGAR MATCH HO JAYE: Short 2-3 line reply mein full order details do (Status, Tracking link). 🎉
   - ❌ AGAR MATCH NAHI HOTA: Politely 10-digit registered number pucho.
   - AGAR 10-DIGIT NUMBER MATCH HO JAYE: Verification successful bolo aur order details bata do!
   - AGAR MATCH NA HO: Decline karo aur support@11fit.com do.`}

=== 📏 11FIT AI SIZE & FIT ADVISOR RULE ===
${instSizeAdvisor || `- Jab customer height, weight, waist, ya size ke baare mein puche:
  * [11FIT SIZE & FIT RECOMMENDATION] ya [11FIT GENERAL SIZE & FIT GUIDE] ka data use karke confident, friendly size recommend karo!
  * Always reassure customer: "11FIT tees mein pehle se drop-shoulder oversized cut hota hai, toh apna normal size hi lein!"`}

=== 🏆 11FIT BRAND & POLICIES (www.11fit.in) ===
${instBrandPolicies || `- Oversized Tees & Track Pants: Combed cotton & 4-Way Lycra. Check swipe Size Guide on 11fit.in!
- Shipping: 3-5 business days across India. COD & Prepaid available. 7-Day Return/Exchange policy.`}${instCustom ? `\n\n=== ⭐ CUSTOM AI INSTRUCTIONS ===\n` + instCustom : ''}

RECENT CONVERSATION HISTORY:
${history}

TOOLS DATA:
${toolContext}

CUSTOMER NEW MESSAGE:
${userText}\`;

      // === FALLBACK MODEL CHAIN: Try 3 models in order ===
      // 1. llama-3.3-70b-versatile (best quality, ~300ms)
      // 2. llama-3.1-8b-instant (fast fallback, ~120ms)
      // 3. compound-beta (Groq compound AI, ~900ms)
      const FALLBACK_MODELS = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'compound-beta'
      ];

      // Try to load dynamic Groq API key from Supabase settings (allows changing from app UI)
      let activeGroqKey = GROQ_API_KEY;
      try {
        const settingsRes = await axios.get(
          `${SUPABASE_URL}/rest/v1/whatsapp_settings?select=groq_api_key&order=id.desc&limit=1`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        if (settingsRes.data?.[0]?.groq_api_key) {
          activeGroqKey = settingsRes.data[0].groq_api_key;
        }
      } catch (_) { /* fallback to env key */ }

      let aiReply = null;
      let usedModel = '';
      for (const modelName of FALLBACK_MODELS) {
        try {
          const llmResponse = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              model: modelName,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userText }
              ],
              temperature: 0.5,
              max_tokens: 300
            },
            {
              headers: {
                'Authorization': `Bearer ${activeGroqKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 15000
            }
          );
          aiReply = llmResponse.data?.choices?.[0]?.message?.content;
          if (aiReply) {
            usedModel = modelName;
            break; // Success! Stop trying fallbacks
          }
        } catch (modelErr) {
          console.error(`Model ${modelName} failed:`, modelErr.response?.data?.error?.message || modelErr.message);
          // Continue to next fallback model
        }
      }

      if (!aiReply) {
        aiReply = "Abhi humara AI system busy hai. Aapki query note ho gayi hai — humari team jaldi reply karegi! Help ke liye support@11fit.com par email karein 😊";
        usedModel = 'fallback_static';
        
        // Trigger critical API limit alert!
        await sendPushNotificationToAll(
          `🚨 AI API LIMIT HIT!`,
          `Could not reply to +${senderPhone}. Models failed! Manual takeover required immediately!`,
          { url: '/', vibrate: [800, 200, 800, 200, 1000, 200, 1000, 200, 1000] }
        );
      }

      toolsCalledList.push(`AI Model: ${usedModel}`);

      // Save AI reply to Supabase Memory
      await saveChatMessage(senderPhone, 'assistant', aiReply);

      // Send reply via WhatsApp
      await sendWhatsAppMessage(senderPhone, aiReply);

      const durationMs = Date.now() - startTime;

      // Log successful execution
      await logExecution({
        phone: senderPhone,
        user_message: userText,
        ai_reply: aiReply,
        status: 'SUCCESS',
        tools_called: toolsCalledList.length ? toolsCalledList.join(', ') : 'Direct AI Reply',
        duration_ms: durationMs
      });

      return res.status(200).json({ success: true, reply: aiReply });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      console.error('WhatsApp AI Webhook Error:', err.message);
      await logExecution({
        phone: senderPhone,
        user_message: userText || 'Webhook parse error',
        ai_reply: 'Execution Error',
        status: 'ERROR',
        tools_called: toolsCalledList.join(', ') || 'None',
        error_message: err.message,
        duration_ms: durationMs
      });
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
