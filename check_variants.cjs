const axios = require('axios');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const storeUrl = envFile.match(/VITE_SHOPIFY_STORE_URL=(.+)/)[1].trim();
const accessToken = envFile.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.+)/)[1].trim();
const GRAPHQL_URL = `https://${storeUrl}/admin/api/2024-04/graphql.json`;

const productId = 'gid://shopify/Product/10402717270148';

async function executeGraphQL(query, variables = {}) {
  const response = await axios.post(GRAPHQL_URL, { query, variables }, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    }
  });
  if (response.data.errors) {
    throw new Error(JSON.stringify(response.data.errors));
  }
  return response.data.data;
}

async function fixVariants() {
  const locationData = await executeGraphQL(`{ locations(first: 1) { edges { node { id } } } }`);
  const locationId = locationData.locations.edges[0].node.id;

  const getVariantsQuery = `
    query getVariants($id: ID!) {
      product(id: $id) {
        variants(first: 100) {
          edges {
            node {
              id
              title
              inventoryItem { id }
              selectedOptions { name value }
            }
          }
        }
      }
    }
  `;
  const getVariantsRes = await executeGraphQL(getVariantsQuery, { id: productId });
  const variants = getVariantsRes.product.variants.edges.map(e => e.node);

  console.log(`Found ${variants.length} auto-generated variants.`);

  const variantsUpdateInput = variants.map(v => {
    return {
      id: v.id,
      price: 798.00,
      compareAtPrice: 1596.00,
      inventoryPolicy: "DENY"
    };
  });

  console.log('Updating Variants Price...');
  const bulkUpdateMutation = `
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { message }
      }
    }
  `;
  const bulkUpdateRes = await executeGraphQL(bulkUpdateMutation, {
    productId: productId,
    variants: variantsUpdateInput
  });
  if (bulkUpdateRes.productVariantsBulkUpdate.userErrors.length > 0) {
    console.error(bulkUpdateRes.productVariantsBulkUpdate.userErrors);
    return;
  }

  console.log('Setting Inventory Quantities...');
  const quantities = [];
  for (const v of variants) {
    const colorOpt = v.selectedOptions.find(o => o.name === 'Color').value;
    const qty = (colorOpt === 'Black' || colorOpt === 'Navy') ? 10 : 0;
    
    quantities.push({
      inventoryItemId: v.inventoryItem.id,
      locationId: locationId,
      quantity: qty
    });
  }

  const inventoryMutation = `
    mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
      inventorySetOnHandQuantities(input: $input) {
        userErrors { message }
      }
    }
  `;
  const invRes = await executeGraphQL(inventoryMutation, {
    input: {
      reason: "correction",
      setQuantities: quantities
    }
  });

  if (invRes.inventorySetOnHandQuantities.userErrors.length > 0) {
    console.error(invRes.inventorySetOnHandQuantities.userErrors);
  } else {
    console.log('Inventory successfully updated!');
  }
}

fixVariants();
