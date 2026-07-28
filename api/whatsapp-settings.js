import axios from 'axios';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xkiukbebnntjzfilyfmh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: Read current WhatsApp AI settings
  if (req.method === 'GET') {
    try {
      const { data } = await axios.get(
        `${SUPABASE_URL}/rest/v1/whatsapp_settings?select=*&order=id.desc&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const row = data?.[0] || {};
      return res.status(200).json({
        groq_api_key: row.groq_api_key || '',
        groq_model: row.groq_model || 'llama-3.3-70b-versatile',
        whatsapp_token: row.whatsapp_token ? '••••••' + row.whatsapp_token.slice(-8) : '',
        has_groq_key: !!row.groq_api_key,
        has_whatsapp_token: !!row.whatsapp_token
      });
    } catch (err) {
      return res.status(200).json({ groq_api_key: '', groq_model: 'llama-3.3-70b-versatile', has_groq_key: false, has_whatsapp_token: false });
    }
  }

  // POST: Save WhatsApp AI settings
  if (req.method === 'POST') {
    try {
      const { groq_api_key, groq_model, whatsapp_token } = req.body;

      // Check if settings row exists
      const { data: existing } = await axios.get(
        `${SUPABASE_URL}/rest/v1/whatsapp_settings?select=id&order=id.desc&limit=1`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );

      const payload = {};
      if (groq_api_key !== undefined && groq_api_key !== '') payload.groq_api_key = groq_api_key;
      if (groq_model !== undefined) payload.groq_model = groq_model;
      if (whatsapp_token !== undefined && whatsapp_token !== '') payload.whatsapp_token = whatsapp_token;
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
