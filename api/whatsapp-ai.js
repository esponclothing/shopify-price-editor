import axios from './dbWrapper.js';

// Permanent Credentials
const SHOPIFY_STORE_URL = process.env.VITE_SHOPIFY_STORE_URL || 'i2tu0d-jc.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.VITE_SHOPIFY_ACCESS_TOKEN || '';
const GROQ_API_KEY = process.env.VITE_GROQ_API_KEY || '';

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';

const PROCESSED_WEBHOOK_IDS = new Set();

// Helper: Call AI APIs with Fallback Chain (Supports Groq and Gemini)
async function callGeminiAPI(messages, apiKey, jsonMode = false, maxTokens = 250) {
  // 3 Dynamically Verified Active Fallback models for Gemini (As requested)
  const geminiModels = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.1-pro'];
  let lastError = null;
  
  let systemInstruction = null;
  const contents = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = { parts: [{ text: msg.content }] };
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }
  
  for (const model of geminiModels) {
    try {
      console.log(`[AI Fallback] Testing Gemini model: ${model}`);
      const payload = {
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens }
      };
      if (systemInstruction) payload.systemInstruction = systemInstruction;
      if (jsonMode) payload.generationConfig.responseMimeType = "application/json";

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
      
      if (res.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return res.data.candidates[0].content.parts[0].text;
      }
    } catch (err) {
      console.error(`[AI Fallback] Gemini model ${model} failed:`, err.response?.data?.error?.message || err.message);
      lastError = err;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error('All Gemini fallback models failed: ' + (lastError?.message || 'Unknown error'));
}
// Log execution to whatsapp_executions table via Supabase REST API
async function logExecution({ phone, user_message, ai_reply, status, tools_called, error_message, duration_ms }) {
  try {
    await axios.post(
      `/rest/v1/whatsapp_executions`,
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
      `/rest/v1/whatsapp_chat_memory`,
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
      `/rest/v1/push_subscriptions?select=subscription`,
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
              `/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`,
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


// --- FLOW MESSAGE DISPATCHER ---
async function dispatchFlowMessage(toPhone, node, variables) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1189183190949431';
  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  
  let token = process.env.WHATSAPP_TOKEN || '';
  try {
    const settingsRes = await axios.get(
      `/rest/v1/whatsapp_settings?select=whatsapp_token&order=id.desc&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (settingsRes.data?.[0]?.whatsapp_token) token = settingsRes.data[0].whatsapp_token;
  } catch (_) {}

  if (!token) {
    console.log('[DRY RUN] Would send flow node:', node.type, 'to', toPhone);
    return;
  }

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const payload = { messaging_product: 'whatsapp', recipient_type: 'individual', to: toPhone };

  // Interpolate variables helper
  const inter = (str) => {
    if (!str) return '';
    let s = str;
    for (const [k, v] of Object.entries(variables || {})) {
      s = s.replace(new RegExp(`{{${k}}}`, 'g'), v || '');
    }
    return s;
  };

  try {
    if (node.type === 'text' || node.type === 'input_capture') {
      payload.type = 'text';
      payload.text = { body: inter(node.type === 'text' ? node.data?.text : node.data?.question) };
    } else if (node.type === 'image') {
      payload.type = 'image';
      payload.image = { link: inter(node.data?.url) };
      if (node.data?.caption) payload.image.caption = inter(node.data.caption);
    } else if (node.type === 'video') {
      payload.type = 'video';
      payload.video = { link: inter(node.data?.url) };
      if (node.data?.caption) payload.video.caption = inter(node.data.caption);
    } else if (node.type === 'document') {
      payload.type = 'document';
      payload.document = { link: inter(node.data?.url), filename: (node.data?.filename || 'Document') };
      if (node.data?.caption) payload.document.caption = inter(node.data.caption);
    } else if (node.type === 'quick_reply') {
      payload.type = 'interactive';
      const btns = [node.data?.button1, node.data?.button2, node.data?.button3].filter(Boolean).slice(0,3);
      payload.interactive = {
        type: 'button',
        body: { text: inter(node.data?.text || 'Please select:') },
        action: {
          buttons: btns.map((b, i) => ({ type: 'reply', reply: { id: `qr_${node.id}_${i}`, title: String(b).slice(0,20) } }))
        }
      };
    } else if (node.type === 'url_button' || node.type === 'call_button') {
       payload.type = 'interactive';
       payload.interactive = {
         type: 'cta_url',
         body: { text: inter(node.data?.text || 'Click below') },
         action: {
           name: 'cta_url',
           parameters: {
             display_text: String(node.data?.btnText || 'Click Here').slice(0,20),
             url: node.type === 'call_button' ? `tel:${node.data?.phone || ''}` : inter(node.data?.url || 'https://11fit.in')
           }
         }
       };
    } else if (node.type === 'list_message') {
      payload.type = 'interactive';
      const items = [node.data?.item1, node.data?.item2, node.data?.item3, node.data?.item4, node.data?.item5].filter(Boolean).slice(0,10);
      payload.interactive = {
        type: 'list',
        header: { type: 'text', text: String(node.data?.title || 'Options').slice(0,60) },
        body: { text: inter(node.data?.text || 'Please choose an option:') },
        action: {
          button: String(node.data?.btnText || 'Menu').slice(0,20),
          sections: [{ title: 'Options', rows: items.map((t, i) => ({ id: `list_${node.id}_${i}`, title: String(t).slice(0,24) })) }]
        }
      };
    } else if (node.type === 'delay') {
      const ms = (parseInt(node.data?.seconds) || 1) * 1000;
      await new Promise(r => setTimeout(r, Math.min(ms, 3000))); // Max 3s delay for serverless functions
      return;
    } else {
      return; // unsupported or logical node
    }

    await axios.post(url, payload, { headers });
  } catch (e) {
    console.error(`Flow Engine Dispatch Error for node ${node.id}:`, e.response?.data || e.message);
  }
}

// ─── WORKFLOW EXECUTION ENGINE ───
async function executeFlowEngine(senderPhone, userText) {
  try {
    // 1. Check if user is currently IN A FLOW
    const stateRes = await axios.get(
      `/rest/v1/whatsapp_flow_states?phone=eq.${senderPhone}&select=*,whatsapp_flows(flow_json)`, 
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const userState = stateRes.data?.[0];

    // Helper to traverse and execute nodes
    const runNodes = async (flow, startNodeId, variables) => {
      let nextNodeId = startNodeId;
      let ended = false;
      while(nextNodeId) {
        const node = flow.nodes.find(n => n.id === nextNodeId);
        if (!node) { ended = true; break; }

        // ─── ADVANCED LOGICAL & DATA NODES ───
        try {
          const inter = (str) => {
            if (!str) return ''; let s = str;
            for (const [k, v] of Object.entries(variables || {})) { s = s.replace(new RegExp(`{{${k}}}`, 'g'), v || ''); }
            return s;
          };

          if (node.type === 'tag') {
            const tagsArr = inter(node.data.tags || '').split(',').map(t => t.trim()).filter(Boolean);
            if (tagsArr.length > 0) {
              const { data: currSet } = await axios.get(`/rest/v1/whatsapp_chat_settings?phone=eq.${senderPhone}&select=tags`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
              let currentTags = currSet?.[0]?.tags || [];
              let newTags = [...new Set([...currentTags, ...tagsArr])];
              await axios.patch(`/rest/v1/whatsapp_chat_settings?phone=eq.${senderPhone}`, { tags: newTags }, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
            }
          } else if (node.type === 'api_webhook') {
            const method = node.data.method || 'POST';
            const url = inter(node.data.url);
            let payload = {};
            try { payload = JSON.parse(inter(node.data.payload || '{}')); } catch(e) {}
            if (url) {
              const res = await axios({ method, url, data: payload }).catch(e => e.response);
              if (node.data.outputVariable) variables[node.data.outputVariable] = typeof res?.data === 'object' ? JSON.stringify(res.data) : String(res?.data || '');
            }
          } else if (node.type === 'ai_prompt') {
            const prompt = inter(node.data.prompt);
            const groqKey = process.env.GROQ_API_KEY || '';
            if (groqKey && prompt) {
              let aiText = 'AI unavailable';
              try {
                aiText = await callGeminiAPI([{ role: "system", content: prompt }], groqKey);
              } catch (err) {
                console.error("AI Prompt error:", err.message);
              }
              if (node.data.outputVariable) {
                 variables[node.data.outputVariable] = aiText;
              } else {
                 node = { ...node, type: 'text', data: { text: aiText } }; // send immediately
              }
            }
          } else if (node.type === 'shopify_order') {
            const orderNum = inter(node.data.orderVar || '').replace(/#/g, '').trim();
            if (orderNum) {
               // mock a simple order lookup string if lookupOrder is not easily callable (it relies on Shopify API which is already in this file)
               // The lookupOrder function is below in the file, we can just call it
               // Wait, lookupOrder doesn't return a clean string, it returns an object with messages. 
               // We will format it manually.
               try {
                 const res = await axios.get(`https://${process.env.SHOPIFY_STORE_URL || 'esponclothing.myshopify.com'}/admin/api/2024-10/orders.json?name=${orderNum}&status=any`, { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || '' }});
                 const order = res.data?.orders?.[0];
                 let output = `Order not found.`;
                 if (order) {
                   output = `Order #${order.order_number} is currently ${order.fulfillment_status || 'unfulfilled'}. Total: ₹${order.total_price}.`;
                 }
                 if (node.data.outputVariable) variables[node.data.outputVariable] = output;
               } catch(e) {}
            }
          } else if (node.type === 'shopify_product') {
            // Shopify Carousel - mutate node to text since Meta Catalog ID isn't configured
            const keyword = inter(node.data.keyword);
            let outputText = `Searching for ${keyword}...`;
            try {
              // we can use the local searchShopifyProducts if it was hoisted, but it's not. We'll do a quick query.
              const res = await axios.post(`https://${process.env.SHOPIFY_STORE_URL || 'esponclothing.myshopify.com'}/admin/api/2024-10/graphql.json`, 
                { query: `{ products(first: 3, query: "status:active ${keyword}") { edges { node { title variants(first:1){edges{node{price}}} } } } }` },
                { headers: { 'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN || '', 'Content-Type': 'application/json' } }
              );
              const edges = res.data?.data?.products?.edges || [];
              if (edges.length > 0) {
                 outputText = `Here are some products matching "${keyword}":\n\n` + edges.map(e => `👕 *${e.node.title}* - ₹${e.node.variants?.edges?.[0]?.node?.price || 'N/A'}`).join('\n');
              } else {
                 outputText = `No products found for "${keyword}".`;
              }
            } catch(e) {}
            node = { ...node, type: 'text', data: { text: outputText } };
          } else if (node.type === 'delay') {
            const delayVal = parseInt(inter(node.data.amount)) || 1;
            const unit = node.data.unit || 'minutes';
            let ms = delayVal * 1000;
            if (unit === 'minutes') ms *= 60;
            if (unit === 'hours') ms *= 3600;
            if (unit === 'days') ms *= 86400;

            if (ms > 5000) {
               // LONG DELAY - SCHEDULE IT (Needs `whatsapp_scheduled_messages` table to exist)
               await axios.post(`/rest/v1/whatsapp_scheduled_messages`, {
                 phone: senderPhone,
                 flow_json: flow,
                 current_node_id: node.id,
                 variables,
                 send_after: new Date(Date.now() + ms).toISOString()
               }, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }).catch(e => console.error('Schedule Failed', e));
               
               // Exit flow completely for now
               return { status: 'paused', node };
            } else {
               // short delay
               await new Promise(r => setTimeout(r, ms));
            }
          }
        } catch (e) { console.error('Advanced Node Error:', e); }

        // Execute visual UI node
        await dispatchFlowMessage(senderPhone, node, variables);

        if (node.type === 'quick_reply' || node.type === 'input_capture' || node.type === 'list_message') {
          // Interactive! Pause execution here and wait for next user message
          await axios.patch(`/rest/v1/whatsapp_flow_states?phone=eq.${senderPhone}`, {
            current_node_id: node.id,
            variables,
            updated_at: new Date().toISOString()
          }, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
          
          return { status: 'paused', node };
        }
        
        // Proceed to next node
        let nextE = flow.edges.find(e => e.source === node.id);
        if (nextE) {
          nextNodeId = nextE.target;
        } else {
          ended = true;
          break;
        }
      }
      return { status: 'ended' };
    };

    if (userState) {
      // User is stuck in a flow node (like Input or Quick Reply)
      const flow = userState.whatsapp_flows?.flow_json;
      if (!flow) {
        await axios.delete(`/rest/v1/whatsapp_flow_states?phone=eq.${senderPhone}`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
        return false;
      }

      let currentNode = flow.nodes.find(n => n.id === userState.current_node_id);
      let variables = userState.variables || {};

      // If the current node was an Input Node, save their answer
      if (currentNode && currentNode.type === 'input_capture' && currentNode.data?.variable) {
        variables[currentNode.data.variable] = userText;
      }

      // If Quick Reply or List Message, find which button they clicked to route the edge
      let nextEdge = null;
      if (currentNode && (currentNode.type === 'quick_reply' || currentNode.type === 'list_message')) {
        let items = [];
        if (currentNode.type === 'quick_reply') {
          items = [currentNode.data.button1, currentNode.data.button2, currentNode.data.button3];
        } else {
          items = [currentNode.data.item1, currentNode.data.item2, currentNode.data.item3, currentNode.data.item4, currentNode.data.item5];
        }
        
        const btnIndex = items.findIndex(b => b && (userText.toLowerCase().includes(b.toLowerCase()) || userText === String(arguments.length)));
        if (btnIndex !== -1) {
          nextEdge = flow.edges.find(e => e.source === currentNode.id && e.sourceHandle === `btn-${btnIndex+1}`);
        }
      }
      
      // Fallback edge finder
      if (!nextEdge) {
        nextEdge = flow.edges.find(e => e.source === currentNode.id);
      }

      if (!nextEdge) {
        // Flow finished! Clear state
        await axios.delete(`/rest/v1/whatsapp_flow_states?phone=eq.${senderPhone}`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
        return true; // We handled the message, flow ended.
      } else {
        const result = await runNodes(flow, nextEdge.target, variables);
        if (result.status === 'ended') {
          await axios.delete(`/rest/v1/whatsapp_flow_states?phone=eq.${senderPhone}`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
        }
        return true; // Handled
      }
    } else {
      // User NOT in a flow. Check triggers.
      const activeFlowsRes = await axios.get(`/rest/v1/whatsapp_flows?is_active=eq.true&select=id,flow_json`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
      const activeFlows = activeFlowsRes.data || [];

      for (const f of activeFlows) {
        const flow = f.flow_json;
        if (!flow || !flow.nodes) continue;
        
        const triggers = flow.nodes.filter(n => n.type === 'trigger');
        for (const t of triggers) {
           if (t.data?.keyword && userText.toLowerCase().trim() === t.data.keyword.toLowerCase().trim()) {
             // START THE FLOW
             await axios.post(`/rest/v1/whatsapp_flow_states`, {
                phone: senderPhone,
                flow_id: f.id,
                current_node_id: t.id,
                variables: {}
             }, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });

             let nextEdge = flow.edges.find(e => e.source === t.id);
             if (nextEdge) {
                const result = await runNodes(flow, nextEdge.target, {});
                if (result.status === 'ended') {
                  await axios.delete(`/rest/v1/whatsapp_flow_states?phone=eq.${senderPhone}`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
                }
             } else {
                await axios.delete(`/rest/v1/whatsapp_flow_states?phone=eq.${senderPhone}`, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
             }
             return true; // Flow intercepted message
           }
        }
      }
    }
  } catch (err) {
    console.error('Flow Engine Error:', err);
  }
  return false;
}

// Get recent chat history via REST API
async function getChatHistory(phone) {
  try {
    const res = await axios.get(
      `/rest/v1/whatsapp_chat_memory?phone=eq.${encodeURIComponent(phone)}&select=role,content&order=created_at.desc&limit=6`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );
    const rows = res.data || [];
    const filtered = rows.filter(r => r.role !== 'internal_note');
    return filtered.reverse().map(r => `${r.role.toUpperCase()}: ${r.content}`).join('\n');
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
          queryUrl = `/rest/v1/shopify_orders?or=(name.eq.%23${pureNum},order_number.eq.${pureNum})&limit=1`;
        } else if (cleanSender && cleanSender.length === 10) {
          queryUrl = `/rest/v1/shopify_orders?or=(phone_last10.eq.${cleanSender},alt_phone_last10.eq.${cleanSender})&order=created_at.desc&limit=1`;
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
        `/rest/v1/shopify_combos?is_active=eq.true&order=updated_at.desc`,
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
            featuredImage { url }
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

    const productLines = [];
    const carouselCards = [];
    
    edges.slice(0, 10).forEach((e, idx) => {
      const p = e.node;
      const rawId = String(p.id).replace(/\D/g, '');
      const singlePrice = p.variants.edges[0]?.node?.price || 'N/A';
      
      const matchingCombo = dbCombos.find(c => String(c.product_id) === rawId || (c.product_title && p.title.toLowerCase().includes(c.product_title.toLowerCase())));
      let comboLine = '';
      let cardPrice = `₹${singlePrice}`;
      let buttonId = `buy_${p.handle}`.slice(0, 256);

      let productUrl = `https://${SHOPIFY_STORE_URL || 'www.11fit.in'}/products/${p.handle}`;
      if (matchingCombo && Number(matchingCombo.combo_count) > 0) {
        comboLine = ` | 🔥 *COMBO OFFER:* Pack of ${matchingCombo.combo_count} @ *₹${matchingCombo.combo_price}* (Coupon: *${matchingCombo.discount_code}*)`;
        cardPrice = `COMBO: Pack of ${matchingCombo.combo_count} @ ₹${matchingCombo.combo_price}`;
        productUrl = `https://${SHOPIFY_STORE_URL || 'www.11fit.in'}/products/${p.handle}?discount=${matchingCombo.discount_code}`;
      }

      if (idx < 5) { // Enforce max 5 products
        productLines.push(`Product: ${p.title} - Price: ₹${singlePrice} ${comboLine}`);
        
        carouselCards.push({
          title: p.title.slice(0, 60),
          price: cardPrice.slice(0, 160),
          image_url: p.featuredImage?.url || 'https://cdn.shopify.com/s/files/1/0661/7723/7187/files/11fit_logo_black.png',
          url: productUrl
        });
      }
    });

    let textLines = productLines;
    if (isComboSearch && dbCombos.length > 0) {
      const summaryList = dbCombos.map(c => 
        `🔥 *${c.product_title}* — Pack of ${c.combo_count} @ *₹${c.combo_price}* (Coupon: *${c.discount_code}*)`
      );
      textLines = [...summaryList, '', ...productLines];
    }

    return { textLines, carouselCards };
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

// Send WhatsApp Interactive Product Cards (Vertical)
async function sendWhatsAppProductCards(toPhone, cards) {
  let token = process.env.WHATSAPP_TOKEN || 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
  try {
    const settingsRes = await axios.get(
      `/rest/v1/whatsapp_settings?select=whatsapp_token&order=id.desc&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (settingsRes.data?.[0]?.whatsapp_token) {
      token = settingsRes.data[0].whatsapp_token;
    }
  } catch (_) {}

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1189183190949431';
  if (!token) return { success: true, dry_run: true };

  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  
  // WhatsApp doesn't support free-form Carousels. Send up to 5 individual interactive cards instead.
  const cardsToSend = cards.slice(0, 5);
  
  for (const c of cardsToSend) {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: toPhone,
      type: "interactive",
      interactive: {
        type: "cta_url",
        header: {
          type: "image",
          image: { link: c.image_url }
        },
        body: {
          text: `*${c.title}*\nPrice: ${c.price}`.slice(0, 160)
        },
        action: {
          name: "cta_url",
          parameters: {
            display_text: "🛍️ Buy Now",
            url: c.url
          }
        }
      }
    };

    try {
      await axios.post(url, payload, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }});
      await new Promise(resolve => setTimeout(resolve, 500)); // Delay between messages
    } catch (err) {
      console.error('Failed to send product card:', err.response?.data || err.message);
    }
  }
}

// Send WhatsApp Reply via Meta Graph API
async function sendWhatsAppMessage(toPhone, textBody) {
  let token = process.env.WHATSAPP_TOKEN || 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
  try {
    const settingsRes = await axios.get(
      `/rest/v1/whatsapp_settings?select=whatsapp_token&order=id.desc&limit=1`,
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

// Send Typing Indicator via Meta Graph API (if supported)
async function sendWhatsAppTyping(toPhone) {
  let token = process.env.WHATSAPP_TOKEN || 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
  try {
    const settingsRes = await axios.get(
      `/rest/v1/whatsapp_settings?select=whatsapp_token&order=id.desc&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (settingsRes.data?.[0]?.whatsapp_token) {
      token = settingsRes.data[0].whatsapp_token;
    }
  } catch (_) {}

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1189183190949431';
  if (!token) return;
  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  return axios.post(
    url,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      sender_action: 'typing_on'
    },
    { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
  ).catch(() => {}); // silently catch if typing_on is unsupported by Meta
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
    // --- INTERNAL API FOR AI CO-PILOT REWRITE ---
    if (req.query.action === 'rewrite' || req.body?.action === 'rewrite') {
      const text = req.body?.text;
      if (!text) return res.status(400).json({ success: false, error: 'Text required' });
      try {
        let activeGroqKey = process.env.VITE_GROQ_API_KEY || 'AQ.Ab8RN6J-54eZLqYDuD80EuP-nzMFBgC4gFxwFw74oCeCsfiUHA';
        try {
          const settingsRes = await axios.get(
            `/rest/v1/whatsapp_settings?select=groq_api_key&order=id.desc&limit=1`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
          );
          if (settingsRes.data?.[0]?.groq_api_key && 
             (settingsRes.data[0].groq_api_key.startsWith('AQ.') || settingsRes.data[0].groq_api_key.startsWith('AIza'))) {
            activeGroqKey = settingsRes.data[0].groq_api_key;
          }
        } catch (_) {}

        const prompt = `You are a professional customer support assistant for a Shopify brand.
Rewrite the following raw, short, or casually-written note from an agent into a polite, professional, and empathetic message ready to be sent to a customer.
Make it sound human and helpful. Do not just copy the note—expand it into a proper sentence or two.

CRITICAL RULES:
1. DO NOT invent discounts, offers, or coupon codes.
2. DO NOT hallucinate facts, prices, or policies. Only use facts implied in the note.
3. Keep it concise (under 3 sentences).
4. Output ONLY the final message. No introductory or closing remarks like 'Here is the rewritten text:'.

Agent's Note: "${text}"`;

        const rewrittenText = await callGeminiAPI([{ role: 'user', content: prompt }], activeGroqKey, false, 600);
        let aiRes = { data: { choices: [{ message: { content: rewrittenText } }] } };

        let rewritten = aiRes.data.choices[0].message.content.trim();
        if (rewritten.startsWith('"') && rewritten.endsWith('"')) {
          rewritten = rewritten.slice(1, -1).trim();
        }
        return res.status(200).json({ success: true, rewritten });
      } catch (err) {
        console.error('Co-pilot error:', err.response?.data || err.message);
        return res.status(500).json({ success: false, error: 'Failed to rewrite text' });
      }
    }

    // --- INTERNAL API FOR AI CO-PILOT SUGGESTIONS ---
    if (req.query.action === 'suggest' || req.body?.action === 'suggest') {
      const text = req.body?.text;
      if (!text) return res.status(400).json({ success: false, error: 'Text required' });
      try {
        let activeGroqKey = process.env.VITE_GROQ_API_KEY || 'AQ.Ab8RN6J-54eZLqYDuD80EuP-nzMFBgC4gFxwFw74oCeCsfiUHA';
        try {
          const settingsRes = await axios.get(
            `/rest/v1/whatsapp_settings?select=groq_api_key&order=id.desc&limit=1`,
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
          );
          if (settingsRes.data?.[0]?.groq_api_key && 
             (settingsRes.data[0].groq_api_key.startsWith('AQ.') || settingsRes.data[0].groq_api_key.startsWith('AIza'))) {
            activeGroqKey = settingsRes.data[0].groq_api_key;
          }
        } catch (_) {}

        if (!activeGroqKey) {
            return res.status(500).json({ success: false, error: 'Groq API Key not found' });
        }

        const prompt = `You are a professional customer support assistant for a Shopify brand.
Here is the recent conversation context (latest messages at the bottom):
---
${text}
---

Task: Generate exactly 3 highly relevant, concise, and professional reply options for a human agent to send back to the customer next.
Each option MUST be under 15 words and directly address the customer's last question or concern.
DO NOT offer discounts. DO NOT ask for order ID if they already provided it. 
Output ONLY a JSON object containing a "suggestions" array. Example: {"suggestions": ["Hello! Let me check on that.", "Could you provide your order ID?", "Your order is on the way!"]}`;

        const suggestText = await callGeminiAPI([{ role: 'user', content: prompt }], activeGroqKey, false, 800);
        let aiRes = { data: { choices: [{ message: { content: suggestText } }] } };

        let content = aiRes.data.choices[0].message.content.trim();
        content = content.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '').trim();

        // Fallback cleanup if AI wraps it in json object instead of raw array
        let suggestions = [];
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) suggestions = parsed;
          else if (parsed.suggestions && Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions;
          else if (parsed.options && Array.isArray(parsed.options)) suggestions = parsed.options;
          else suggestions = Object.values(parsed).flat().filter(x => typeof x === 'string');
        } catch(e) {
           // extract array using regex
           const match = content.match(/\[([\s\S]*?)\]/);
           if (match) {
             try { suggestions = JSON.parse(`[${match[1]}]`); } catch(e) {}
           }
        }
        
        if (suggestions.length === 0) {
           suggestions = ["Let me check your order details right away.", "Could you provide your Order ID?", "I'm checking this for you now."];
        }

        return res.status(200).json({ success: true, suggestions: suggestions.slice(0,3) });
      } catch (err) {
        console.error('Co-pilot suggest error:', err.response?.data || err.message);
        return res.status(500).json({ success: false, error: 'Failed to generate suggestions' });
      }
    }
    // ---------------------------------------------

    const startTime = Date.now();
    let senderPhone = 'Unknown';
    let userText = '';
    const toolsCalledList = [];
    try {
      const entry = req.body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      // ENFORCE BUSINESS PHONE ID MATCH (Only process messages for 11FIT)
      const targetPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1189183190949431';
      const incomingPhoneId = value?.metadata?.phone_number_id;

      if (incomingPhoneId && incomingPhoneId !== targetPhoneId) {
        console.log(`[IGNORE] Webhook received for other number (ID: ${incomingPhoneId}). Ignored.`);
        return res.status(200).json({ status: 'ignored_different_business_number' });
      }

      // AUTO-CAPTURE WABA_ID: Save WhatsApp Business Account ID to settings whenever a webhook arrives
      const wabaId = entry?.id;
      if (wabaId && SUPABASE_KEY) {
        axios.patch(
          `/rest/v1/whatsapp_settings?id=eq.1`,
          { waba_id: String(wabaId) },
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' } }
        ).catch(() => {});
      }

      // ─── HANDLE WEBRTC WHATSAPP CALLS ───
      const statusObj = value?.statuses?.[0];
      const isCallMessage = message && (message.type === 'call' || message.type === 'webrtc' || message.call || message.webrtc);
      const isCallStatus = statusObj && (statusObj.type === 'call' || statusObj.type === 'webrtc' || statusObj.call || statusObj.webrtc);
      
      if (isCallMessage || isCallStatus) {
         const eventObj = isCallMessage ? message : statusObj;
         const callObj = eventObj.call || eventObj.webrtc || {};
         const callSession = callObj.session || {};
         const sdpType = callSession.sdp_type || callSession.type;
         const sdp = callSession.sdp;
         const phone = eventObj.recipient_id || eventObj.from || value?.contacts?.[0]?.wa_id || statusObj?.recipient_id;
         
         if (sdpType === 'offer') {
             // Incoming Call from Customer
             const callId = eventObj.id || callSession.id || Date.now().toString();
             await axios.post(
               `/rest/v1/whatsapp_calls`,
               { id: callId, phone: phone, direction: 'inbound', status: 'ringing', started_at: new Date().toISOString(), sdp_offer: sdp },
               { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' } }
             ).catch(()=>{});
             
             // Trigger Ringing UI on Frontend
             const baseUrl = 'https://' + (req.headers.host || 'shopify-price-editor.vercel.app');
             axios.post(`${baseUrl}/api/11fit-analytics?action=webpush`, {
               action: 'notify',
               title: `📞 Incoming Call`,
               body: `Incoming WhatsApp call from +${phone}`,
               tag: `incoming-call-${phone}`
             }).catch(()=>{});

             return res.status(200).json({ status: 'call_offer_processed' });
             
         } else if (sdpType === 'answer') {
             // Customer Answered Our Outbound Call
             await axios.patch(
               `/rest/v1/whatsapp_calls?phone=eq.${phone}&status=eq.calling`,
               { status: 'answered', sdp_answer: sdp, answered_at: new Date().toISOString() },
               { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' } }
             ).catch(()=>{});
             return res.status(200).json({ status: 'call_answer_processed' });
         } else if (callObj.action === 'reject' || callObj.action === 'terminate' || eventObj.status === 'failed' || callObj.status === 'rejected') {
             // Customer declined/ended the call
             await axios.patch(
               `/rest/v1/whatsapp_calls?phone=eq.${phone}&order=created_at.desc&limit=1`,
               { status: 'ended', ended_at: new Date().toISOString() },
               { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' } }
             ).catch(()=>{});
             return res.status(200).json({ status: 'call_ended_processed' });
         }
      }

      // CRITICAL STATUS FILTER: Ignore sent / delivered / read receipts, but accept text, audio, image, video, interactive!
      if (!message || (message.type !== 'text' && message.type !== 'audio' && message.type !== 'image' && message.type !== 'video' && message.type !== 'interactive')) {
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
      if (senderPhone && SUPABASE_KEY) {
        const upsertPayload = {
          phone: senderPhone,
          chat_status: 'open',
          updated_at: new Date().toISOString()
        };
        if (senderName) upsertPayload.customer_name = senderName;
        axios.post(
          `/rest/v1/whatsapp_chat_settings`,
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
      } else if (message.type === 'interactive') {
        const buttonId = message.interactive?.button_reply?.id;
        const buttonTitle = message.interactive?.button_reply?.title || 'Button Clicked';
        if (buttonId && buttonId.startsWith('buy_')) {
          let checkoutLink;
          let quickReply;

          if (buttonId.startsWith('buy_|')) {
            const parts = buttonId.split('|');
            const handle = parts[1];
            const discount = parts[2];
            checkoutLink = `https://11fit.in/products/${handle}?discount=${discount}`;
            quickReply = `Awesome choice! 🛍️ Here is the direct link to buy this combo:\n${checkoutLink}\n\n💡 *Tip:* The ${discount} discount is auto-applied! Just select your sizes on the page and checkout.`;
          } else {
            const productHandle = buttonId.replace('buy_', '');
            checkoutLink = `https://11fit.in/products/${productHandle}`;
            quickReply = `Awesome choice! 🛍️ Here is the direct link to buy this item:\n${checkoutLink}`;
          }
          
          await saveChatMessage(senderPhone, 'user', `[Clicked Buy Now]: ${buttonTitle}`);
          await sendPushNotificationToAll(`💬 New WhatsApp: +${senderPhone}`, `[Clicked Buy Now]: ${buttonTitle}`, { url: '/' });
          await saveChatMessage(senderPhone, 'assistant', quickReply);
          await sendWhatsAppMessage(senderPhone, quickReply);
          
          await logExecution({
            phone: senderPhone,
            user_message: `[Clicked Buy Now]: ${buttonTitle}`,
            ai_reply: quickReply,
            status: 'SUCCESS',
            tools_called: 'Interactive Carousel Link',
            duration_ms: Date.now() - startTime
          });
          return res.status(200).json({ status: 'carousel_button_handled' });
        } else {
          userText = buttonTitle;
        }
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

      // ─── EXECUTE FLOW ENGINE (INTERCEPT MESSAGE IF FLOW IS ACTIVE OR TRIGGERED) ───
      const flowHandled = await executeFlowEngine(senderPhone, userText);
      if (flowHandled) {
         console.log(`[FLOW ENGINE] Message handled completely by visual workflow for ${senderPhone}`);
         await logExecution({
           phone: senderPhone,
           user_message: userText,
           ai_reply: '🤖 Executed via Visual Chatbot Flow Engine',
           status: 'FLOW_EXECUTED',
           tools_called: 'Flow Builder Engine',
           duration_ms: Date.now() - startTime
         });
         return res.status(200).json({ status: 'handled_by_flow_engine' });
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
          `/rest/v1/whatsapp_chat_settings?phone=eq.${encodeURIComponent(senderPhone)}&select=ai_paused&limit=1`,
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

      // ─── ANGRY CUSTOMER ESCALATION (SENTIMENT CHECK) ───
      const angryKeywords = /scam|fraud|where the hell|wtf|refund now|idiot|stupid|police|case|consumer court/i;
      if (angryKeywords.test(userText)) {
        console.log(`[ESCALATION] Angry customer detected for ${senderPhone}. Pausing AI.`);
        try {
          await axios.post(
            `/rest/v1/whatsapp_chat_settings`,
            { phone: senderPhone, ai_paused: true },
            { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'resolution=merge-duplicates' } }
          );
        } catch (_) {}

        await sendPushNotificationToAll(
          `🚨 ANGRY CUSTOMER ALERT`, 
          `Manual takeover required for +${senderPhone}. AI has been paused.`, 
          { url: '/' }
        );

        await logExecution({
          phone: senderPhone,
          user_message: userText,
          ai_reply: '🚨 AI Paused due to Angry Customer Sentiment Detection.',
          status: 'ESCALATED',
          tools_called: 'Sentiment Analysis',
          duration_ms: Date.now() - startTime
        });
        return res.status(200).json({ status: 'escalated_angry_customer' });
      }

      // Execute AI reasoning & Tool checks
      let toolContext = '';
      let orderNumToLookup = null;
      let carouselCards = [];
      
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
      const productKeywords = /short|combo|trio|pack|t\-?shirt|shirt|oversize|tee|pant|track|lower|trouser|clothes|kuch|dikhao|price|offer|deal|discount|buy|link|item|product|collection|catalog|sell|shop|store|show/i;
      if (productKeywords.test(userText)) {
        toolsCalledList.push(`Product & Combo Search (${extractProductKeyword(userText)})`);
        const productsInfo = await searchProducts(userText);
        if (productsInfo && productsInfo.textLines) {
           toolContext += `\n[SHOPIFY GRAPHQL PRODUCTS & COMBOS RESULT]: ${JSON.stringify(productsInfo.textLines)}`;
           carouselCards = productsInfo.carouselCards || [];
        } else {
           toolContext += `\n[SHOPIFY GRAPHQL PRODUCTS & COMBOS RESULT]: ${JSON.stringify(productsInfo)}`;
        }
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
      let knowledgeBase = '';
      try {
        const { data: setRows } = await axios.get(
          `/rest/v1/whatsapp_settings?select=*&order=id.desc&limit=1`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        const sr = setRows?.[0] || {};
        instLanguage = sr.inst_language || '';
        instOrderSecurity = sr.inst_order_security || '';
        instSizeAdvisor = sr.inst_size_advisor || '';
        instBrandPolicies = sr.inst_brand_policies || '';
        instCustom = sr.inst_custom || '';
        knowledgeBase = sr.knowledge_base || '';
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
  * Har product ke saath uska live combo status checked hai.
  * **SIRF WAHI products ko "Combo Offer" bolkar batao jinke saath \`| 🔥 *COMBO OFFER:* Pack of X @ ₹...\` likha hua hai!**
  * **EXACT PRICING MANDATORY:** Agar product combo mein hai, toh EXACTLY wahi combo price (jaise ₹899 ya ₹1199) batao jo toolContext mein likha hai. Single t-shirt ka price (e.g. ₹599) assume karke apne man se 3 t-shirt ka price calculate MAT karo. Jo database ne Pack of 3 ki price di hai, wahi batao.
  * KABHI BHI bina combo wale product ko combo bolkar MAT BECHO aur KABHI BHI yeh MAT BOLO ki "Aur bhi combos hain" agar toolContext mein koi aur combo listed na ho!

=== 🚨 CRITICAL CHAT RULE: NEVER PRINT TOOL LOGS OR BRACKETED TEXT ===
- KABHI BHI "[SHOPIFY ORDER RESULT...]" ya "[SHOPIFY GRAPHQL...]" ya koi JSON/bracket text customer ke message mein MAT LIKHO! Sirf natural friendly text reply bhejho.
- **DYNAMIC CAROUSEL RULE**: Agar tum customer ko products suggest kar rahe ho (aur [SHOPIFY GRAPHQL PRODUCTS & COMBOS RESULT] mein products mile hain), toh apne reply ke EXACTLY END MEIN yeh tag likho: \`[SEND_PRODUCT_CAROUSEL]\`. Is tag se hamara system automatically ek swipeable product carousel bhej dega! Raw links share karne ki zaroorat nahi hai.

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
- Shipping: 3-5 business days across India. COD & Prepaid available. 7-Day Return/Exchange policy.`}${knowledgeBase ? `\n\n=== 📚 KNOWLEDGE BASE (STORE POLICIES & FAQS) ===\n- INSTRUCTION: Use the following knowledge base strictly to answer customer queries. Do not hallucinate policies.\n\n${knowledgeBase}` : ''}${instCustom ? `\n\n=== ⭐ CUSTOM AI INSTRUCTIONS ===\n` + instCustom : ''}

RECENT CONVERSATION HISTORY:
${history}

TOOLS DATA:
${toolContext}

CUSTOMER NEW MESSAGE:
${userText}`;
      // Simulate human typing indicator on WhatsApp (if supported)
      await sendWhatsAppTyping(senderPhone);

      // Fallback model list removed; using Gemini directly

      // Fetch dynamic Gemini API key from database
      let activeGeminiKey = process.env.VITE_GEMINI_API_KEY || '';
      try {
        const settingsRes = await axios.get(
          `/rest/v1/whatsapp_settings?select=gemini_api_key&limit=1`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        if (settingsRes.data?.[0]?.gemini_api_key) {
          activeGeminiKey = settingsRes.data[0].gemini_api_key;
        }
      } catch (_) { /* fallback to env key */ }

      // Parallel Urgency Detection using Gemini (extremely fast)
      let urgencyPromise = Promise.resolve();
      if (userText.split(' ').length > 2) {
        const urgencyPrompt = 'You are an urgency detector. If the user message is angry, complaining, threatening, asking for a refund, missing order, fraud, or claiming a delay, output "URGENT". Otherwise output "NORMAL". Output ONLY that single word.';
        urgencyPromise = callGeminiAPI(
          [{ role: 'system', content: urgencyPrompt }, { role: 'user', content: userText }],
          activeGeminiKey, false, 10
        ).then(async urgency => {
          if (urgency?.trim() === 'URGENT') {
             await axios.post(
               `/rest/v1/whatsapp_chat_settings`,
               { phone: senderPhone, chat_status: 'urgent', updated_at: new Date().toISOString() },
               { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' } }
             );
          }
        }).catch(() => {});
      }

      let aiReply = null;
      let usedModel = 'gemini-3.7-flash';
      try {
        aiReply = await callGeminiAPI(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText }
          ],
          activeGeminiKey, false, 600
        );
      } catch (modelErr) {
        console.error(`Gemini model failed:`, modelErr.message);
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

      // Extract carousel trigger
      let finalReplyText = aiReply;
      let sendCarousel = carouselCards.length > 0;
      if (finalReplyText.includes('[SEND_PRODUCT_CAROUSEL]')) {
         finalReplyText = finalReplyText.replace(/\[SEND_PRODUCT_CAROUSEL\]/g, '').trim();
      }

      // Send reply via WhatsApp
      if (finalReplyText) {
        await sendWhatsAppMessage(senderPhone, finalReplyText);
      }

      // Background AI Tagging (Non-blocking)
      callGeminiAPI(
        [
          { role: 'system', content: 'You are a customer segmentation bot. Analyze the customer message and output EXACTLY ONE tag from this list that best describes their intent/status: [VIP, Angry, Bargain Hunter, Needs Big Sizes, Return/Exchange, General Inquiry, Looking to Buy]. Output NOTHING ELSE. Just the tag.' },
          { role: 'user', content: userText }
        ],
        activeGeminiKey, false, 15
      ).then(async tagRes => {
         let tag = tagRes;
         if (tag) {
           tag = tag.replace(/[^a-zA-Z\s\/]/g, '').trim(); // sanitize
           await axios.post(
             `/rest/v1/whatsapp_chat_settings`,
             { phone: senderPhone, tags: [tag], updated_at: new Date().toISOString() },
             { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' } }
           );
         }
      }).catch(e => console.error('Tagging failed', e.message));
      
      if (sendCarousel && carouselCards.length > 0) {
        try {
           await sendWhatsAppProductCards(senderPhone, carouselCards);
           toolsCalledList.push('Interactive Product Cards Sent');
        } catch(e) {
           console.error('Product cards send failed', e);
        }
      }
      
      // Wait for urgency detection to complete
      await urgencyPromise;

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
