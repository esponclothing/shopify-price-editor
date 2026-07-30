const axios = require('axios');

async function run() {
  const query = `
    query {
      products(first: 6, query: "status:active") {
        edges {
          node {
            title
            handle
            variants(first: 1) {
              edges { node { price } }
            }
            combo_config: metafield(namespace: "price_editor", key: "combo_config") {
              value
            }
          }
        }
      }
    }
  `;
  const res = await axios.post(
    'https://i2tu0d-jc.myshopify.com/admin/api/2024-10/graphql.json',
    { query },
    {
      headers: {
        'X-Shopify-Access-Token': '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',
        'Content-Type': 'application/json'
      }
    }
  );
  const edges = res.data.data.products.edges;
  console.log(edges.map(e => ({
    title: e.node.title,
    price: e.node.variants.edges[0]?.node?.price,
    combo: e.node.combo_config?.value
  })));
}

run();
