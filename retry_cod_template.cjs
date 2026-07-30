const axios = require('axios');

const TOKEN = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const WABA_ID = '2025586748064434';

const codTemplate = {
  name: 'order_confirmation_cod_v1',
  category: 'UTILITY',
  language: 'en_US',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'COD ORDER CONFIRMED'
    },
    {
      type: 'BODY',
      text: 'Hi {{1}}, thank you for shopping with 11FIT! 🙌\n\nYour order {{2}} has been confirmed and is being processed.\n\n📦 Items Ordered:\n{{3}}\n\n💵 Amount Payable: ₹{{4}}\n📦 Payment Mode: Cash on Delivery (COD)\n📍 Delivery Address: {{5}}\n\nPlease keep cash or UPI ready at the time of delivery. You will receive tracking details as soon as it ships!',
      example: {
        body_text: [ [
          'Rahul',
          '#1129',
          '1x Drop Shoulder Tee - Black (XL), 1x Track Pants (XL)',
          '1,895',
          'Sector 45, Gurgaon, Haryana'
        ] ]
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
          text: 'View Order Status',
          url: 'https://11fit.in/account'
        },
        {
          type: 'URL',
          text: 'Visit Store',
          url: 'https://11fit.in'
        }
      ]
    }
  ]
};

async function submitCod() {
  try {
    console.log('Retrying order_confirm_cod_v1...');
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates`,
      codTemplate,
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ SUCCESS "order_confirm_cod_v1" - ID: ${res.data.id}, Status: ${res.data.status || 'PENDING'}`);
  } catch (err) {
    const metaErr = err.response?.data?.error?.error_user_msg || err.response?.data?.error?.message || err.message;
    console.error(`❌ FAILED "order_confirm_cod_v1":`, metaErr);
  }
}

submitCod();
