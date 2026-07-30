const axios = require('axios');
const url = 'https://i2tu0d-jc.myshopify.com/admin/api/2024-01/graphql.json';
const headers = { 'X-Shopify-Access-Token': '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', 'Content-Type': 'application/json' };

async function run() {
  console.log("Fetching active discounts...");
  const q1 = { query: 'query { discountNodes(first: 50, query: "status:ACTIVE") { edges { node { id discount { ... on DiscountAutomaticBasic { title } } } } } }' };
  const res1 = await axios.post(url, q1, { headers });
  const activeIds = res1.data.data.discountNodes.edges.map(e => e.node.id);
  console.log("Active Discounts:", activeIds);

  console.log("Cleaning products...");
  const q2 = { query: 'query { products(first: 250) { edges { node { id title metafield(namespace: "custom", key: "active_campaign") { id value } } } } }' };
  const res2 = await axios.post(url, q2, { headers });
  const products = res2.data.data.products.edges;
  
  for (const p of products) {
    if (p.node.metafield && p.node.metafield.value) {
      try {
        const val = JSON.parse(p.node.metafield.value);
        if (!activeIds.includes(val.campaignId)) {
          console.log(`Deleting invalid campaign from product ${p.node.title}`);
          const q3 = { query: 'mutation metafieldDelete($input: MetafieldDeleteInput!) { metafieldDelete(input: $input) { deletedId userErrors { message } } }', variables: { input: { id: p.node.metafield.id } } };
          await axios.post(url, q3, { headers });
        }
      } catch(e) {}
    }
  }

  console.log("Cleaning collections...");
  const q4 = { query: 'query { collections(first: 250) { edges { node { id title metafield(namespace: "price_editor", key: "campaigns") { id value } } } } }' };
  const res4 = await axios.post(url, q4, { headers });
  const collections = res4.data.data.collections.edges;

  for (const c of collections) {
    if (c.node.metafield && c.node.metafield.value) {
      try {
        const camps = JSON.parse(c.node.metafield.value);
        if (Array.isArray(camps)) {
          const validCamps = camps.filter(camp => activeIds.includes(camp.campaign_id));
          if (validCamps.length !== camps.length) {
            console.log(`Updating campaigns on collection ${c.node.title}`);
            const q5 = { query: 'mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { userErrors { message } } }', variables: { metafields: [{ ownerId: c.node.id, namespace: "price_editor", key: "campaigns", type: "json", value: JSON.stringify(validCamps) }] } };
            await axios.post(url, q5, { headers });
          }
        }
      } catch(e) {}
    }
  }
  
  console.log("Done.");
}

run();
