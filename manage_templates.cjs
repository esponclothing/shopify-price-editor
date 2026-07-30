const axios = require('axios');
const token = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const waba = '2025586748064434';
const baseURL = `https://graph.facebook.com/v21.0/${waba}/message_templates`;
const headers = { Authorization: `Bearer ${token}` };

async function getTemplates() {
  const res = await axios.get(`${baseURL}?fields=name,status&limit=100`, { headers });
  return res.data.data;
}

async function deleteTemplate(name) {
  try {
    await axios.delete(`${baseURL}?name=${name}`, { headers });
    console.log(`Deleted: ${name}`);
  } catch (err) {
    console.error(`Failed to delete ${name}:`, err.response?.data?.error?.message || err.message);
  }
}

async function createTemplate(payload) {
  try {
    await axios.post(baseURL, payload, { headers: { ...headers, 'Content-Type': 'application/json' } });
    console.log(`Created: ${payload.name}`);
  } catch (err) {
    console.error(`Failed to create ${payload.name}:`, err.response?.data?.error?.message || err.message);
  }
}

async function run() {
  const templates = await getTemplates();
  console.log('Current Templates:', templates.map(t => t.name).join(', '));

  // Delete old templates
  const toDelete = [
    'order_shipped_v1', 
    'out_for_delivery_cod_v1', 'out_for_delivery_prepaid_v1',
    'order_confirmation_cod_v1', 'order_confirm_partial_v1', 'order_confirm_prepaid_v1',
    'abandoned_cart_v2'
  ];
  
  for (const name of toDelete) {
    if (templates.some(t => t.name === name)) {
      await deleteTemplate(name);
    }
  }

  // 1. Create order_confirmed_v2 (Quick reply for "Track my order")
  await createTemplate({
    name: 'order_confirmed_v2',
    language: 'en_US',
    category: 'MARKETING',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'ORDER CONFIRMED'
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}, thank you for shopping with 11FIT! 🙌\n\nYour order {{2}} has been confirmed and is being processed.\n\n📦 Items Ordered:\n{{3}}\n\n💵 Payment Info: {{4}}\n📍 Delivery Address: {{5}}\n\nYou will receive tracking details as soon as it ships!',
        example: {
          body_text: [['Rahul', '#1129', '1x Drop Shoulder Tee - Black (XL)', '₹1499 (COD)', 'Sector 45, Gurgaon']]
        }
      },
      {
        type: 'FOOTER',
        text: '11FIT Activewear • Premium Fit & Fabric'
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: 'Track my order'
          }
        ]
      }
    ]
  });

  // 2. Create out_for_delivery_v2 (Tracking link in body)
  await createTemplate({
    name: 'out_for_delivery_v2',
    language: 'en_US',
    category: 'MARKETING',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'OUT FOR DELIVERY TODAY'
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}, your 11FIT order {{2}} is OUT FOR DELIVERY today! 📦\n\n{{3}}\n\nPlease keep your phone reachable so the delivery executive can contact you when they arrive at your address.\n\n💵 Payment Info: {{4}}\n\nThank you for choosing 11FIT!',
        example: {
          body_text: [['Rahul', '#1129', 'Track here: https://11fit.in/track', '₹1499 (COD - Please keep cash/UPI ready)']]
        }
      },
      {
        type: 'FOOTER',
        text: '11FIT Activewear • Quick Delivery'
      }
    ]
  });

  // 3. Create abandoned_cart_v3 (Dynamic Cart Recovery Link)
  await createTemplate({
    name: 'abandoned_cart_v3',
    language: 'en_US',
    category: 'MARKETING',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'YOUR 11FIT CART IS WAITING'
      },
      {
        type: 'BODY',
        text: 'Hey {{1}}, you left something awesome in your cart! 🔥\n\nWe noticed your activewear items are still waiting for you. High-demand oversized tees and drop-shoulder apparel sell out fast—secure yours before stock runs out!\n\n💰 Cart Value: ₹{{2}}\n⚡ EXTRA SAVINGS: Get an instant 5% EXTRA OFF when you choose Prepaid payment at checkout!',
        example: {
          body_text: [['Aman', '1,499']]
        }
      },
      {
        type: 'FOOTER',
        text: '11FIT Activewear • Premium Fit & Fabric'
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Complete Your Order',
            url: 'https://11fit.in/cart?r={{1}}',
            example: ['https://11fit.in/cart?r=checkout_session_123']
          },
          {
            type: 'URL',
            text: 'Size Guide',
            url: 'https://11fit.in/pages/size-chart'
          }
        ]
      }
    ]
  });
}

run();
