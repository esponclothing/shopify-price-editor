const axios = require('axios');
const shop = 'i2tu0d-jc.myshopify.com';
const token = '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';

async function run() {
  try {
    // 1. Fetch EXPIRED campaigns
    const query = `{ discountNodes(first: 50, query: "status:EXPIRED") { edges { node { id } } } }`;
    const res = await axios.post(`https://${shop}/admin/api/2024-01/graphql.json`, { query }, { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } });
    const expiredIds = res.data.data.discountNodes.edges.map(e => e.node.id);
    console.log("Expired Campaigns:", expiredIds);

    // 2. Fetch all products with active_campaign
    const prodQuery = `{ products(first: 250) { edges { node { id metafield(namespace: "custom", key: "active_campaign") { value } } } } }`;
    const prodRes = await axios.post(`https://${shop}/admin/api/2024-01/graphql.json`, { query: prodQuery }, { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } });
    const products = prodRes.data.data.products.edges;

    const metafieldsToClear = [];
    for (const p of products) {
      if (p.node.metafield && p.node.metafield.value) {
        try {
          const val = JSON.parse(p.node.metafield.value);
          if (expiredIds.includes(val.campaignId) || Object.keys(val).length === 0) {
            metafieldsToClear.push({ ownerId: p.node.id, namespace: "custom", key: "active_campaign", type: "json", value: "{}" });
          }
        } catch(e){}
      }
    }

    console.log(`Clearing ${metafieldsToClear.length} product metafields...`);
    if (metafieldsToClear.length > 0) {
       for (let i = 0; i < metafieldsToClear.length; i += 25) {
         const mQuery = `mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }`;
         await axios.post(`https://${shop}/admin/api/2024-01/graphql.json`, { query: mQuery, variables: { metafields: metafieldsToClear.slice(i, i + 25) } }, { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } });
       }
       console.log("Cleared successfully!");
    }

  } catch(err) {
    console.error(err);
  }
}
run();
