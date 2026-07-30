const axios = require('axios');

const TOKEN = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const WABA_ID = '2025586748064434';
const TEMPLATE_NAME = 'order_delivered_v1';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

async function run() {
  console.log(`\n🔧 Fixing ${TEMPLATE_NAME}: Changing category from MARKETING → UTILITY\n`);

  // Step 1: Find template ID
  console.log('1️⃣  Looking up template ID...');
  const listRes = await axios.get(
    `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?name=${TEMPLATE_NAME}&limit=5`,
    { headers }
  );
  const templates = listRes.data?.data || [];
  
  if (templates.length === 0) {
    console.log('❌ Template not found! Skipping delete, going straight to create.');
  } else {
    // Step 2: Delete all existing versions
    for (const tpl of templates) {
      console.log(`   Found template: ID=${tpl.id}, Category=${tpl.category}, Status=${tpl.status}`);
      try {
        await axios.delete(
          `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?hsm_id=${tpl.id}&name=${TEMPLATE_NAME}`,
          { headers }
        );
        console.log(`   ✅ Deleted template ID ${tpl.id}`);
      } catch (err) {
        console.log(`   ⚠️  Could not delete ID ${tpl.id}: ${err.response?.data?.error?.message || err.message}`);
      }
    }
  }

  // Step 3: Wait a moment before resubmitting
  console.log('\n2️⃣  Waiting 3 seconds before resubmitting...');
  await new Promise(r => setTimeout(r, 3000));

  // Step 4: Resubmit as UTILITY
  console.log('3️⃣  Resubmitting as UTILITY...');
  const newTemplate = {
    name: TEMPLATE_NAME,
    category: 'UTILITY',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'ORDER DELIVERED'
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}, your 11FIT order {{2}} has been successfully delivered! 🎯\n\nThank you for being part of the 11FIT family! We hope you love the fit, drop-shoulder cut, and premium 4-way stretch quality.\n\n🔥 UPGRADE YOUR WARDROBE!\nWe just launched our newest Drop-Shoulder Oversized Tees and Activewear Combo Deals! Grab 2 or 3 tees together at an exclusive discounted price.\n\nTap below to explore our hottest combo packs and new arrivals!',
        example: {
          body_text: [ [ 'Rahul', '#1129' ] ]
        }
      },
      {
        type: 'FOOTER',
        text: '11FIT Activewear • Built For Performance'
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Explore Combo Deals',
            url: 'https://11fit.in/collections/combos'
          },
          {
            type: 'URL',
            text: 'Shop New Arrivals',
            url: 'https://11fit.in/collections/new-arrivals'
          }
        ]
      }
    ]
  };

  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates`,
      newTemplate,
      { headers }
    );
    console.log(`\n✅ SUCCESS! Template resubmitted as UTILITY`);
    console.log(`   ID: ${res.data.id}`);
    console.log(`   Status: ${res.data.status || 'PENDING'}`);
    console.log(`   Category: UTILITY`);
    console.log(`\n⏳ Meta will review and approve within 1–15 minutes.`);
  } catch (err) {
    const metaErr = err.response?.data?.error?.error_user_msg || err.response?.data?.error?.message || err.message;
    console.error(`\n❌ FAILED to resubmit: ${metaErr}`);
    if (err.response?.data) {
      console.error(JSON.stringify(err.response.data, null, 2));
    }
  }
}

run();
