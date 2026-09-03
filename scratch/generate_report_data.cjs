const axios = require('axios');
const { Client } = require('pg');

const SHOPIFY_STORE_URL = 'i2tu0d-jc.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = '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';

async function generateReport() {
  const pgClient = new Client({
    connectionString: 'postgres://postgres:11fit@202612@db.xkiukbebnntjzfilyfmh.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await pgClient.connect();
  const returnRes = await pgClient.query(`SELECT order_name FROM return_requests`);
  const returnedOrderNames = new Set(returnRes.rows.map(r => r.order_name.replace('#', '')));
  await pgClient.end();

  let orders = [];
  let url = `https://${SHOPIFY_STORE_URL}/admin/api/2024-04/orders.json?status=any&limit=250`;
  
  try {
    while (url) {
      const res = await axios.get(url, { headers: { 'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN } });
      orders = orders.concat(res.data.orders);
      
      const linkHeader = res.headers['link'];
      url = null;
      if (linkHeader) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (match) {
          url = match[1];
        }
      }
    }
  } catch (err) {
    console.error('Error fetching Shopify orders:', err.message);
  }

  const report = {};

  for (const o of orders) {
    // Check if return requested
    const orderNameNum = o.name.replace('#', '');
    const hasReturnInDb = returnedOrderNames.has(orderNameNum);
    const hasReturnStatus = o.return_status && o.return_status !== 'none';
    const hasReturnTags = o.tags && (o.tags.toLowerCase().includes('return') || o.tags.toLowerCase().includes('exchange'));
    
    if (hasReturnInDb || hasReturnStatus || hasReturnTags) {
      continue;
    }

    // Check if delivered
    let isDelivered = false;
    if (o.fulfillment_status === 'fulfilled') {
      isDelivered = true; // Default to delivered if fulfilled
      if (o.fulfillments && o.fulfillments.length > 0) {
        const shipmentStatus = o.fulfillments[0].shipment_status;
        if (shipmentStatus && shipmentStatus !== 'delivered') {
           // If they have explicit tracking status and it's not delivered, skip
           // wait, we can also just include all fulfilled, but let's exclude explicitly in-transit
           if (['in_transit', 'out_for_delivery', 'attempted_delivery', 'label_printed'].includes(shipmentStatus)) {
             isDelivered = false;
           }
        }
      }
    }
    
    // Check for "Delivered" tags, which some apps add
    if (o.tags && o.tags.toLowerCase().includes('delivered')) {
       isDelivered = true;
    }

    if (!isDelivered) {
      continue;
    }

    const state = o.shipping_address?.province || 'Unknown State';
    const city = o.shipping_address?.city || 'Unknown City';

    if (!report[state]) {
      report[state] = { total: 0, cities: {} };
    }
    report[state].total++;
    
    if (!report[state].cities[city]) {
      report[state].cities[city] = 0;
    }
    report[state].cities[city]++;
  }

  // Formatting output
  const sortedStates = Object.keys(report).sort((a, b) => report[b].total - report[a].total);
  
  let md = "# Delivered Orders (No Return Requests) - Geography Report\n\n";
  md += "| State | Total Orders | Top Cities |\n";
  md += "|---|---|---|\n";
  
  for (const state of sortedStates) {
    const data = report[state];
    const sortedCities = Object.keys(data.cities)
      .sort((a, b) => data.cities[b] - data.cities[a])
      .map(c => `${c} (${data.cities[c]})`)
      .slice(0, 5); // top 5 cities
    
    md += `| **${state}** | ${data.total} | ${sortedCities.join(', ')} |\n`;
  }
  
  // Output JSON for the agent to read
  console.log(JSON.stringify({ 
    total_states: sortedStates.length, 
    top_state: sortedStates[0],
    markdown: md
  }));
}

generateReport();
