const axios = require('axios');
const shop = 'i2tu0d-jc.myshopify.com';
const token = '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';

async function run() {
  try {
    const query = `{ discountNodes(first: 50, query: "status:EXPIRED") { edges { node { id } } } }`;
    const res = await axios.post(`https://${shop}/admin/api/2024-01/graphql.json`, { query }, { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } });
    const expiredIds = res.data.data.discountNodes.edges.map(e => e.node.id);

    const colQuery = `{ collections(first: 250) { edges { node { id metafield(namespace: "price_editor", key: "campaigns") { value } } } } }`;
    const colRes = await axios.post(`https://${shop}/admin/api/2024-01/graphql.json`, { query: colQuery }, { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } });
    
    const metafieldsToClear = [];
    for (const c of colRes.data.data.collections.edges) {
      if (c.node.metafield && c.node.metafield.value) {
        try {
          const val = JSON.parse(c.node.metafield.value);
          const newVal = val.filter(camp => !expiredIds.includes(camp.campaign_id));
          if (newVal.length !== val.length) {
            metafieldsToClear.push({ ownerId: c.node.id, namespace: "price_editor", key: "campaigns", type: "json", value: JSON.stringify(newVal) });
          }
        } catch(e){}
      }
    }

    console.log(`Clearing ${metafieldsToClear.length} collection metafields...`);
    if (metafieldsToClear.length > 0) {
       const mQuery = `mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }`;
       await axios.post(`https://${shop}/admin/api/2024-01/graphql.json`, { query: mQuery, variables: { metafields: metafieldsToClear } }, { headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' } });
       console.log("Cleared successfully!");
    }

  } catch(err) {
    console.error(err);
  }
}
run();
