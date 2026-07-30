const axios = require('axios');

const TOKEN = 'EAAM99yhroGsBSGl4Hqpz75Axd5ZAWUF2wVNOMx0yIJCeEehWE7Dwe8qAaFckBDIw95JmL0rHwBK9rgUp9eA6jBdTZB5NBNLpGcu4mmXcvJ1AasaXmfpoTg2fZAZCjOescX0lUM4KDDZCgT8KQI7ZBw9PpuXMz8oCsI4Xh5BCQgiyhRSQBEPrOWZBQnVEIqBngZDZD';
const WABA_ID = '2025586748064434';

const templatesToSubmit = [
  // 1. Abandoned Cart v2
  {
    name: 'abandoned_cart_v2',
    category: 'MARKETING',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'YOUR 11FIT CART IS WAITING'
      },
      {
        type: 'BODY',
        text: 'Hey {{1}}, you left something awesome in your cart! 🔥\n\nWe noticed your activewear items are still waiting for you. High-demand oversized tees and drop-shoulder apparel sell out fast—secure yours before stock runs out!\n\n💰 Cart Value: ₹{{2}}\n⚡ EXTRA SAVINGS: Get an instant 5% EXTRA OFF when you choose Prepaid payment at checkout!\n\nTap below to complete your order or check our size guide.',
        example: {
          body_text: [ ['Aman', '1,499'] ]
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
            url: 'https://11fit.in/cart'
          },
          {
            type: 'URL',
            text: 'Size Guide',
            url: 'https://11fit.in/pages/size-chart'
          }
        ]
      }
    ]
  },

  // 2. Order Confirmation Prepaid v1
  {
    name: 'order_confirm_prepaid_v1',
    category: 'UTILITY',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'PREPAID ORDER CONFIRMED'
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}, thank you for shopping with 11FIT! 🙌\n\nYour Prepaid order {{2}} has been confirmed and payment is successfully received.\n\n📦 Items Ordered:\n{{3}}\n\n💵 Amount Paid: ₹{{4}}\n✅ Payment Status: 100% Prepaid (No cash required at delivery)\n📍 Delivery Address: {{5}}\n\nOur team is packing your order now. You will receive tracking details as soon as it ships!',
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
  },

  // 3. Order Confirmation COD v1
  {
    name: 'order_confirm_cod_v1',
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
  },

  // 4. Order Confirmation Partial Paid v1
  {
    name: 'order_confirm_partial_v1',
    category: 'UTILITY',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'BOOKING CONFIRMED'
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}, thank you for shopping with 11FIT! 🙌\n\nYour advance booking for order {{2}} is confirmed!\n\n📦 Items Ordered:\n{{3}}\n\n💵 Advance Received: ₹{{4}}\n💰 Balance Due at Delivery: ₹{{5}}\n📍 Delivery Address: {{6}}\n\nPlease keep the remaining balance ready at delivery. We are packing your order now!',
        example: {
          body_text: [ [
            'Rahul',
            '#1129',
            '1x Drop Shoulder Tee - Black (XL), 1x Track Pants (XL)',
            '500',
            '1,395',
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
  },

  // 5. Order Shipped v1
  {
    name: 'order_shipped_v1',
    category: 'UTILITY',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'YOUR ORDER IS ON THE WAY'
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}, great news! Your 11FIT order {{2}} has been shipped and is on its way to you. 🚀\n\n📦 Courier Partner: {{3}}\n🔍 Tracking Number: {{4}}\n\nYou can track your package live using the button below. Delivery typically takes 3-5 working days across India.',
        example: {
          body_text: [ [
            'Rahul',
            '#1129',
            'Delhivery Surface',
            'DLV987654321IN'
          ] ]
        }
      },
      {
        type: 'FOOTER',
        text: '11FIT Activewear • Live Tracking'
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Track Live Package',
            url: 'https://11fit.in'
          },
          {
            type: 'URL',
            text: 'Visit Store',
            url: 'https://11fit.in'
          }
        ]
      }
    ]
  },

  // 6. Out for Delivery Prepaid v1
  {
    name: 'out_for_delivery_prepaid_v1',
    category: 'UTILITY',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'OUT FOR DELIVERY TODAY'
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}, your 11FIT order {{2}} is OUT FOR DELIVERY today! 📦\n\nPlease keep your phone reachable so the delivery executive can contact you when they arrive at your address.\n\n✅ Payment Status: PREPAID (No payment required)\n\nEnjoy your new 11FIT gear!',
        example: {
          body_text: [ [ 'Aman', '#1129' ] ]
        }
      },
      {
        type: 'FOOTER',
        text: '11FIT Activewear • Quick Delivery'
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Track Delivery',
            url: 'https://11fit.in'
          },
          {
            type: 'URL',
            text: 'Visit Store',
            url: 'https://11fit.in'
          }
        ]
      }
    ]
  },

  // 7. Out for Delivery COD v1
  {
    name: 'out_for_delivery_cod_v1',
    category: 'UTILITY',
    language: 'en_US',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'OUT FOR DELIVERY TODAY'
      },
      {
        type: 'BODY',
        text: 'Hi {{1}}, your 11FIT order {{2}} is OUT FOR DELIVERY today! 📦\n\nPlease keep your phone reachable so the delivery executive can contact you when they arrive at your address.\n\n💵 Amount to Collect: ₹{{3}}\n📦 Mode: Cash / UPI to Delivery Executive\n\nPlease keep the payment ready for a smooth handover!',
        example: {
          body_text: [ [ 'Aman', '#1129', '1,499' ] ]
        }
      },
      {
        type: 'FOOTER',
        text: '11FIT Activewear • Quick Delivery'
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Track Delivery',
            url: 'https://11fit.in'
          },
          {
            type: 'URL',
            text: 'Visit Store',
            url: 'https://11fit.in'
          }
        ]
      }
    ]
  },

  // 8. Order Delivered v1
  {
    name: 'order_delivered_v1',
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
  }
];

async function submitAll() {
  console.log(`Starting submission of ${templatesToSubmit.length} templates to Meta WABA ID ${WABA_ID}...`);
  const results = [];

  for (const tpl of templatesToSubmit) {
    try {
      console.log(`Submitting template: "${tpl.name}" (${tpl.category})...`);
      const res = await axios.post(
        `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates`,
        tpl,
        {
          headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log(`✅ SUCCESS "${tpl.name}" - ID: ${res.data.id}, Status: ${res.data.status || 'PENDING'}`);
      results.push({ name: tpl.name, status: 'SUCCESS', id: res.data.id });
    } catch (err) {
      const metaErr = err.response?.data?.error?.error_user_msg || err.response?.data?.error?.message || err.message;
      console.error(`❌ FAILED "${tpl.name}":`, metaErr);
      results.push({ name: tpl.name, status: 'FAILED', error: metaErr });
    }
  }

  console.log('\n=================== SUBMISSION SUMMARY ===================');
  console.table(results);
}

submitAll();
