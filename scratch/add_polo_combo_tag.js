const token = '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';
const store = 'i2tu0d-jc.myshopify.com';

async function run() {
  const getQuery = `
    query {
      products(first: 10, query: "title:Classic Cotton Matty Polo T-Shirt") {
        edges {
          node {
            id
            tags
          }
        }
      }
    }
  `;

  const getRes = await fetch(`https://${store}/admin/api/2024-04/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: getQuery })
  });
  
  const getData = await getRes.json();
  const edges = getData.data.products.edges;
  
  if (edges.length > 0) {
    const product = edges[0].node;
    const existingTags = product.tags || [];
    
    if (!existingTags.includes('Sub: Combo')) {
      const newTags = [...existingTags, 'Sub: Combo'];
      
      const updateMutation = `
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            product {
              id
              tags
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      
      const updateRes = await fetch(`https://${store}/admin/api/2024-04/graphql.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: updateMutation, 
          variables: {
            input: {
              id: product.id,
              tags: newTags
            }
          } 
        })
      });
      
      const updateData = await updateRes.json();
      console.log('Updated tags successfully:', updateData.data.productUpdate.product.tags.join(', '));
    } else {
      console.log('Product already has the Sub: Combo tag.');
    }
  } else {
    console.log('Could not find the Polo product.');
  }
}

run().catch(console.error);
