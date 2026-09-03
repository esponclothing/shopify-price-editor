const token = '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';
const store = 'i2tu0d-jc.myshopify.com';

async function run() {
  const query = `
    query {
      products(first: 50) {
        edges {
          node {
            id
            title
            tags
            productType
            collections(first: 10) {
              edges {
                node {
                  id
                  handle
                  title
                }
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch(`https://${store}/admin/api/2024-04/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  
  const data = await res.json();
  const products = data.data.products.edges.map(e => e.node);
  
  products.forEach(p => {
     console.log(`\nProduct: ${p.title} (Type: ${p.productType})`);
     console.log(`Tags: ${p.tags.join(', ')}`);
     console.log(`Collections: ${p.collections.edges.map(c => c.node.handle).join(', ')}`);
  });
}

run().catch(console.error);
