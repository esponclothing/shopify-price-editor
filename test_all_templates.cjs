const axios = require('axios');

const TOKEN = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const WABA_ID = '2025586748064434';
const TEST_PHONE = '919306817689'; // +91 9306817689

// Map of template name -> phone_number_id (we need this to send messages)
// First fetch it from the API
const PHONE_NUMBER_ID = '1189183190949431'; // 11FIT — +91 74949 61428 (VERIFIED)

async function getTemplateIdByName(name) {
  try {
    const res = await axios.get(
      `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?name=${name}&limit=1`,
      { headers: { 'Authorization': `Bearer ${TOKEN}` } }
    );
    const tpl = res.data?.data?.[0];
    if (!tpl) return null;
    return { id: tpl.id, status: tpl.status, name: tpl.name };
  } catch (err) {
    return null;
  }
}

async function sendTemplate(templateName, languageCode, components) {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: TEST_PHONE,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: components || []
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return { success: true, messageId: res.data?.messages?.[0]?.id };
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message;
    return { success: false, error: errMsg };
  }
}

async function testAllTemplates() {
  console.log(`\n🚀 TESTING ALL 8 WHATSAPP TEMPLATES → +${TEST_PHONE}\n`);
  console.log('='.repeat(60));

  const tests = [
    {
      name: 'abandoned_cart_v2',
      language: 'en_US',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Rahul' },        // {{1}} Name
            { type: 'text', text: '1,499' }          // {{2}} Cart Value
          ]
        }
      ]
    },
    {
      name: 'order_confirm_prepaid_v1',
      language: 'en_US',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Rahul' },           // {{1}} Name
            { type: 'text', text: '#1999' },           // {{2}} Order Number
            { type: 'text', text: 'Drop Shoulder Tee (Black, L) x1\nOversized Shorts (Navy, M) x1' }, // {{3}} Items
            { type: 'text', text: '1,499' },           // {{4}} Total Paid
            { type: 'text', text: 'Flat No. 12, Sector 5, Noida, UP 201301' } // {{5}} Address
          ]
        }
      ]
    },
    {
      name: 'order_confirmation_cod_v1',
      language: 'en_US',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Rahul' },           // {{1}} Name
            { type: 'text', text: '#2001' },           // {{2}} Order Number
            { type: 'text', text: 'Drop Shoulder Tee (White, XL) x1' }, // {{3}} Items
            { type: 'text', text: '1,199' },           // {{4}} COD Amount to Pay
            { type: 'text', text: 'Flat No. 12, Sector 5, Noida, UP 201301' } // {{5}} Address
          ]
        }
      ]
    },
    {
      name: 'order_confirm_partial_v1',
      language: 'en_US',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Rahul' },           // {{1}} Name
            { type: 'text', text: '#2003' },           // {{2}} Order Number
            { type: 'text', text: 'Activewear Combo (Black/Navy, L) x2' }, // {{3}} Items
            { type: 'text', text: '200' },             // {{4}} Advance Paid
            { type: 'text', text: '1,799' },           // {{5}} Balance Due on Delivery
            { type: 'text', text: 'Flat No. 12, Sector 5, Noida, UP 201301' } // {{6}} Address
          ]
        }
      ]
    },
    {
      name: 'order_shipped_v1',
      language: 'en_US',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Rahul' },         // {{1}} Name
            { type: 'text', text: '#1999' },         // {{2}} Order Number
            { type: 'text', text: 'Delhivery' },     // {{3}} Courier Partner
            { type: 'text', text: 'DEL123456789' }   // {{4}} Tracking Number
          ]
        }
      ]
    },
    {
      name: 'out_for_delivery_prepaid_v1',
      language: 'en_US',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Rahul' },   // {{1}} Name
            { type: 'text', text: '#1999' }    // {{2}} Order Number
          ]
        }
      ]
    },
    {
      name: 'out_for_delivery_cod_v1',
      language: 'en_US',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Rahul' },   // {{1}} Name
            { type: 'text', text: '#2001' },   // {{2}} Order Number
            { type: 'text', text: '1,199' }    // {{3}} COD Amount to Pay
          ]
        }
      ]
    },
    {
      name: 'order_delivered_utility_v1',
      language: 'en_US',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Rahul' },   // {{1}} Name
            { type: 'text', text: '#1999' }    // {{2}} Order Number
          ]
        }
      ]
    }
  ];

  const results = [];

  for (const test of tests) {
    // First check if template is APPROVED
    const info = await getTemplateIdByName(test.name);
    const status = info?.status || 'UNKNOWN';
    
    if (status !== 'APPROVED') {
      console.log(`⚠️  ${test.name} — Status: ${status} (skipping send, not APPROVED)`);
      results.push({ template: test.name, status, sent: false, note: 'Not yet approved' });
      continue;
    }

    process.stdout.write(`📤 Sending ${test.name}...`);
    const result = await sendTemplate(test.name, test.language, test.components);
    
    if (result.success) {
      console.log(` ✅ Sent! MsgID: ${result.messageId}`);
    } else {
      console.log(` ❌ Failed: ${result.error}`);
    }
    results.push({ template: test.name, status, ...result });
    
    // Small delay between sends to avoid rate limiting
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n=================== TEST RESULTS ===================');
  results.forEach(r => {
    const icon = r.sent === false ? '⏳' : r.success ? '✅' : '❌';
    const detail = r.note || r.messageId || r.error || '';
    console.log(`${icon}  ${r.template.padEnd(35)} | ${r.status.padEnd(10)} | ${detail}`);
  });
}

testAllTemplates();
