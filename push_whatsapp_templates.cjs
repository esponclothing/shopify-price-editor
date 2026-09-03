const axios = require('axios');

const TOKEN = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const WABA_ID = '2025586748064434';

const templates = [
  {
    name: 'return_request_received',
    language: 'en_US',
    category: 'UTILITY',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Request Received'
      },
      {
        type: 'BODY',
        text: 'Hi! We have received your return/exchange request for Order {{1}}.\n\nOur team will review your request and get back to you shortly. Thank you for your patience!'
      }
    ]
  },
  {
    name: 'return_request_approved',
    language: 'en_US',
    category: 'UTILITY',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Request Approved'
      },
      {
        type: 'BODY',
        text: 'Great news! Your return/exchange request for Order {{1}} has been approved.\n\nWe will schedule a pickup shortly and notify you with the details.'
      }
    ]
  },
  {
    name: 'return_pickup_scheduled',
    language: 'en_US',
    category: 'UTILITY',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Pickup Scheduled'
      },
      {
        type: 'BODY',
        text: 'A pickup has been scheduled for your Order {{1}} via {{2}}.\n\nPlease keep the items packed and ready. You can track your return shipment using this link:\n{{3}}\n\nThank you!'
      }
    ]
  },
  {
    name: 'exchange_shipped',
    language: 'en_US',
    category: 'UTILITY',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Exchange Shipped'
      },
      {
        type: 'BODY',
        text: 'Your exchange parcel for Order {{1}} has been shipped via {{2}}!\n\nYou can track your new package here:\n{{3}}\n\nThank you!'
      }
    ]
  },
  {
    name: 'return_completed',
    language: 'en_US',
    category: 'UTILITY',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Request Completed'
      },
      {
        type: 'BODY',
        text: 'Your return/exchange for Order {{1}} has been successfully completed.\n\nIf a refund was requested, it has been issued. Thank you for shopping with 11FIT!'
      }
    ]
  }
];

async function pushTemplates() {
  for (const tpl of templates) {
    // Add example values for parameters since Meta requires them!
    const bodyComponent = tpl.components.find(c => c.type === 'BODY');
    if (bodyComponent && bodyComponent.text.includes('{{')) {
      const matchCount = (bodyComponent.text.match(/\{\{\d\}\}/g) || []).length;
      bodyComponent.example = {
        body_text: [[]]
      };
      for (let i = 0; i < matchCount; i++) {
        if (i === 0) bodyComponent.example.body_text[0].push('#1054');
        else if (i === 1) bodyComponent.example.body_text[0].push('Delhivery');
        else if (i === 2) bodyComponent.example.body_text[0].push('https://track.com/123');
      }
    }

    try {
      console.log(`Pushing template: ${tpl.name}...`);
      const res = await axios.post(`https://graph.facebook.com/v21.0/${WABA_ID}/message_templates`, tpl, {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`✅ Success ${tpl.name}:`, res.data.id);
    } catch (err) {
      console.error(`❌ Error ${tpl.name}:`, err.response?.data?.error || err.message);
    }
  }
}

pushTemplates();
