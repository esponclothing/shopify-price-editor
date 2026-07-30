const axios = require('axios');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
let storeUrl = '';
let token = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SHOPIFY_STORE_URL=')) storeUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SHOPIFY_ACCESS_TOKEN=')) token = line.split('=')[1].trim();
});

let cleanStore = storeUrl.trim();
if (cleanStore.startsWith('https://')) cleanStore = cleanStore.replace('https://', '');
if (cleanStore.startsWith('http://')) cleanStore = cleanStore.replace('http://', '');

async function fetchActiveCampaigns() {
  const query = `
    query {
      products(first: 50) {
        edges {
          node {
            id
            title
            handle
            activeCampaign: metafield(namespace: "custom", key: "active_campaign") {
              value
            }
            comboConfig: metafield(namespace: "price_editor", key: "combo_config") {
              value
            }
          }
        }
      }
      collections(first: 50) {
        edges {
          node {
            id
            title
            handle
            campaigns: metafield(namespace: "price_editor", key: "campaigns") {
              value
            }
          }
        }
      }
    }
  `;
  try {
    const res = await axios.post(`https://${cleanStore}/admin/api/2024-04/graphql.json`, { query }, {
      headers: {
        'X-Shopify-Access-Token': token.trim(),
        'Content-Type': 'application/json'
      }
    });

    const products = res.data.data.products.edges;
    const collections = res.data.data.collections.edges;

    console.log("=== Active Campaign Metafields on Products ===");
    products.forEach(edge => {
      const p = edge.node;
      if (p.activeCampaign && p.activeCampaign.value) {
        console.log(`Product: ${p.title} (${p.handle})`);
        console.log(`Active Campaign:`, JSON.parse(p.activeCampaign.value));
      }
      if (p.comboConfig && p.comboConfig.value) {
        console.log(`Product: ${p.title} (${p.handle})`);
        console.log(`Combo Config:`, JSON.parse(p.comboConfig.value));
      }
    });

    console.log("\n=== Campaign Metafields on Collections ===");
    collections.forEach(edge => {
      const c = edge.node;
      if (c.campaigns && c.campaigns.value) {
        console.log(`Collection: ${c.title} (${c.handle})`);
        console.log(`Campaigns:`, JSON.parse(c.campaigns.value));
      }
    });

  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}

fetchActiveCampaigns();
