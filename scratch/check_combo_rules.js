const token = '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';
const store = 'i2tu0d-jc.myshopify.com';

async function run() {
  const query = `
    query {
      collectionByHandle(handle: "t-shirts-combo") {
        ruleSet {
          rules {
            column
            condition
            relation
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
  console.dir(data, { depth: null });
}

run().catch(console.error);
