/**
 * Full scenario test for 11FIT WhatsApp AI
 * Tests all customer scenarios locally before deploying
 */
const axios = require('./node_modules/axios/dist/node/axios.cjs');

const GEMINI_API_KEY = 'AQ.Ab8RN6J-54eZLqYDuD80EuP-nzMFBgC4gFxwFw74oCeCsfiUHA';
const SUPABASE_URL = 'https://xkiukbebnntjzfilyfmh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhraXVrYmVibm50anpmaWx5Zm1oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMjExOCwiZXhwIjoyMTAwNzk4MTE4fQ.bqc4x9ok4pgmcffKPpj-BOUELvAli5weCJtwuL4X7Rc';

// Quick system prompt (abbreviated for testing)
const systemPrompt = `You are "11FIT AI Stylist & Sales Assistant" for 11FIT (www.11fit.in), India's premium men's sportswear brand.

LANGUAGE: STRICTLY ENGLISH only. Professional, polite tone. Maximum 3-4 lines per reply.

BRAND KNOWLEDGE:
- Products: Oversized T-Shirts (combed cotton), Track Pants & Shorts (4-Way Lycra), Matty Polo T-Shirts.
- Shipping: 3-5 business days, Free shipping, COD & Prepaid available.
- Return/Exchange: 7-Day policy. Customer WhatsApps photo + order number to initiate. Refund in 5-7 working days.
- Website Login: Go to www.11fit.in > Account icon > Enter mobile number > Receive WhatsApp OTP from this number (+91 74949 61428) > Login instantly. No password needed.
- Order Tracking: Send order number in this chat for instant live tracking.
- Combos: Check TOOLS DATA for active combo deals with direct buy links.
- Support: support@11fit.com

RULES:
- NEVER say "Bhai", "Bro" or informal words.
- NEVER mention "Shopify Editor App" or internal tech details.
- ALWAYS give direct buy links when mentioning products.
- For returns, always direct them to WhatsApp THIS number with photo + order number.`;

const scenarios = [
  { name: '1. Hi / Greeting', msg: 'hi' },
  { name: '2. Which combos do you have?', msg: 'which combos you have?' },
  { name: '3. Combo price question', msg: 'what is the price of shorts combo?' },
  { name: '4. Track order', msg: 'I want to track my order' },
  { name: '5. Return policy', msg: 'what is your return policy?' },
  { name: '6. How to exchange?', msg: 'how do i exchange my t-shirt for a different size?' },
  { name: '7. Website login help', msg: 'how do i login to your website?' },
  { name: '8. Offer / discount', msg: 'do you have any offer or discount?' },
  { name: '9. Size question', msg: 'I am 5 feet 10 inches and weigh 75 kg. What size should I order?' },
  { name: '10. COD availability', msg: 'is cash on delivery available?' },
  { name: '11. Delivery time', msg: 'how long does delivery take?' },
  { name: '12. Contact support', msg: 'I need to contact someone' },
];

async function testScenario(name, msg) {
  try {
    const res = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      {
        model: 'gemini-3.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: msg }
        ],
        temperature: 0.7
      },
      { headers: { 'Authorization': `Bearer ${GEMINI_API_KEY}` }, timeout: 15000 }
    );
    const reply = res.data?.choices?.[0]?.message?.content || 'NO REPLY';
    return reply;
  } catch (e) {
    return `ERROR: ${e.response?.data?.error?.message || e.message}`;
  }
}

async function runAll() {
  console.log('='.repeat(70));
  console.log('11FIT WhatsApp AI - Full Scenario Test');
  console.log('='.repeat(70));

  for (const s of scenarios) {
    console.log(`\n📋 ${s.name}`);
    console.log(`👤 Customer: "${s.msg}"`);
    const reply = await testScenario(s.name, s.msg);
    console.log(`🤖 Bot:\n${reply}`);
    console.log('-'.repeat(60));
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 800));
  }

  console.log('\n✅ All scenarios tested!');
}

runAll();
