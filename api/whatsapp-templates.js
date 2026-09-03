import axios from './axiosWrapper.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xkiukbebnntjzfilyfmh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';

const DEFAULT_META_TOKEN = process.env.WHATSAPP_TOKEN || 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Fetch WhatsApp Token and WABA ID from Supabase settings
  let token = DEFAULT_META_TOKEN;
  let wabaId = req.query.waba_id || req.body?.waba_id || null;

  try {
    const setRes = await axios.get(
      `${SUPABASE_URL}/rest/v1/whatsapp_settings?select=whatsapp_token,waba_id&order=id.desc&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const row = setRes.data?.[0] || {};
    if (row.whatsapp_token) token = row.whatsapp_token;
    if (!wabaId && row.waba_id) wabaId = row.waba_id;
    if (!wabaId) wabaId = '2025586748064434';
  } catch (err) {
    console.error('Error fetching settings:', err.message);
  }

  if (!token) {
    return res.status(400).json({ success: false, error: 'WhatsApp Graph API token not found.' });
  }

  if (!wabaId) {
    return res.status(400).json({
      success: false,
      error: 'WhatsApp Business Account (WABA) ID is not set. Please enter your WABA ID in settings or send any WhatsApp message to your number to auto-detect it.'
    });
  }

  // 2. GET: List all message templates from Meta Cloud API
  if (req.method === 'GET') {
    try {
      const graphRes = await axios.get(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=name,status,language,category,components,id&limit=100`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      return res.status(200).json({
        success: true,
        waba_id: wabaId,
        templates: graphRes.data?.data || []
      });
    } catch (err) {
      const metaErr = err.response?.data?.error?.message || err.message;
      console.error('Meta Get Templates Error:', metaErr);
      return res.status(err.response?.status || 500).json({
        success: false,
        error: metaErr,
        details: err.response?.data || null
      });
    }
  }

  // 3. POST: Create and submit a new Message Template to Meta
  if (req.method === 'POST') {
    const { name, language, category, components, allow_category_change } = req.body || {};

    if (!name || !components || !Array.isArray(components)) {
      return res.status(400).json({
        success: false,
        error: 'Required fields missing: name and components array.'
      });
    }

    // Format template name to lowercase with underscores
    const formattedName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const payload = {
      name: formattedName,
      language: language || 'en_US',
      category: category || 'MARKETING',
      components,
      allow_category_change: allow_category_change !== undefined ? allow_category_change : true
    };

    try {
      const graphRes = await axios.post(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return res.status(201).json({
        success: true,
        message: 'Template successfully submitted to Meta for review!',
        data: graphRes.data
      });
    } catch (err) {
      const metaErr = err.response?.data?.error?.message || err.message;
      const metaErrUserTitle = err.response?.data?.error?.error_user_title;
      const metaErrUserMsg = err.response?.data?.error?.error_user_msg;
      let displayErr = metaErrUserMsg || metaErrUserTitle || metaErr;
      if (String(displayErr).includes('(#100)') || String(displayErr).includes('Need permission')) {
        displayErr = "Meta Permission Error (#100): Your WhatsApp Access Token needs 'whatsapp_business_management' permission to create/delete templates. In Meta Business Manager -> System Users, generate a token with 'whatsapp_business_management' enabled.";
      }
      return res.status(err.response?.status || 500).json({
        success: false,
        error: displayErr,
        details: err.response?.data || null
      });
    }
  }

  // 4. DELETE: Delete a Message Template from Meta
  if (req.method === 'DELETE') {
    const templateName = req.query.name || req.body?.name;
    if (!templateName) {
      return res.status(400).json({ success: false, error: 'Template name is required to delete.' });
    }

    try {
      const graphRes = await axios.delete(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates?name=${encodeURIComponent(templateName)}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      return res.status(200).json({
        success: true,
        message: `Template "${templateName}" deleted successfully.`,
        data: graphRes.data
      });
    } catch (err) {
      const metaErr = err.response?.data?.error?.message || err.message;
      const metaErrUserTitle = err.response?.data?.error?.error_user_title;
      const metaErrUserMsg = err.response?.data?.error?.error_user_msg;
      const subcode = err.response?.data?.error?.error_subcode;

      let displayErr = metaErrUserMsg || metaErrUserTitle || metaErr;
      if (subcode === 2388094 || String(displayErr).includes('सेंपल') || String(displayErr).toLowerCase().includes('sample')) {
        displayErr = "Meta Policy: Sample or default WhatsApp templates (like 'hello_world') cannot be deleted or edited.";
      } else if (String(displayErr).includes('(#100)') || String(displayErr).includes('Need permission')) {
        displayErr = "Meta Permission Error (#100): Your WhatsApp Access Token needs 'whatsapp_business_management' permission to create/delete templates. In Meta Business Manager -> System Users, generate a token with 'whatsapp_business_management' enabled.";
      }
      console.error('Meta Delete Template Error:', displayErr);
      return res.status(err.response?.status || 500).json({
        success: false,
        error: displayErr,
        details: err.response?.data || null
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
