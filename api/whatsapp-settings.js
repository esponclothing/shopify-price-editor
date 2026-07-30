import axios from 'axios';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xkiukbebnntjzfilyfmh.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';

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

const DEFAULT_INST_BRAND_POLICIES = `- Oversized Tees & Track Pants: Combed cotton & 4-Way Lycra.
- Shipping: 3-5 business days across India. COD & Prepaid available.
- Returns/Exchange: 7-Day Return/Exchange policy.
- Support Email: support@11fit.com`;

const DEFAULT_INST_CUSTOM = ``;

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
