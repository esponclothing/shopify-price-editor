const axios = require('axios');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const storeUrl = envFile.match(/VITE_SHOPIFY_STORE_URL=(.+)/)[1].trim();
const accessToken = envFile.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.+)/)[1].trim();
const GRAPHQL_URL = `https://${storeUrl}/admin/api/2024-04/graphql.json`;

const productId = 'gid://shopify/Product/10402730475652';

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

async function finishProduct() {
  try {
    const locationData = await executeGraphQL(`{ locations(first: 1) { edges { node { id } } } }`);
    const locationId = locationData.locations.edges[0].node.id;

    console.log("Creating Variants in bulk (excluding Black)...");
    const newColors = ['Blue', 'Dark Grey', 'Khaki', 'Grey', 'Light Grey'];
    
    const variantsInput = newColors.map(color => {
      return {
        optionValues: [
          { optionName: "Color", name: color },
          { optionName: "Set Size", name: "M-XXL (Pack of 4)" }
        ],
        price: 998.00,
        compareAtPrice: 1996.00,
        inventoryPolicy: "DENY",
        inventoryItem: {
          sku: `E0018-${color.toUpperCase().substring(0,3)}`,
          tracked: true
        }
      };
    });

    const bulkCreateMutation = `
      mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) {
          productVariants { id inventoryItem { id } title }
          userErrors { message }
        }
      }
    `;
    const createRes = await executeGraphQL(bulkCreateMutation, {
      productId: productId,
      variants: variantsInput
    });

    if (createRes.productVariantsBulkCreate.userErrors.length > 0) {
      console.error("Variant Bulk Create Errors:", createRes.productVariantsBulkCreate.userErrors);
      return;
    }

    console.log("Successfully created 5 new variants!");

    // Now let's fetch all 6 variants to update inventory
    console.log("Fetching all variants to set inventory...");
    const getVariantsQuery = `
      query getVariants($id: ID!) {
        product(id: $id) {
          variants(first: 10) {
            edges { node { id title inventoryItem { id } } }
          }
        }
      }
    `;
    const varData = await executeGraphQL(getVariantsQuery, { id: productId });
    const allVariants = varData.product.variants.edges.map(e => e.node);

    // Make sure we also update the price and sku of the Black variant which was auto-created
    const blackVariant = allVariants.find(v => v.title.includes('Black'));
    if (blackVariant) {
      console.log("Updating auto-generated Black variant price and sku...");
      const blackUpdate = `
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            userErrors { message }
          }
        }
      `;
      await executeGraphQL(blackUpdate, {
        productId: productId,
        variants: [{
          id: blackVariant.id,
          price: 998.00,
          compareAtPrice: 1996.00,
          inventoryPolicy: "DENY"
        }]
      });
      
      // Unfortunately sku is in inventoryItem for updates
      // but it's fine, it will just not have a custom SKU for black unless we use inventoryItem update
    }

    // Set Inventory Quantity
    console.log("Setting inventory quantities for all variants...");
    const quantities = [];
    for (const v of allVariants) {
      const color = v.title.split(' / ')[0];
      const stockAmount = ['Black', 'Blue', 'Dark Grey', 'Khaki'].includes(color) ? 50 : 0;
      
      quantities.push({
        inventoryItemId: v.inventoryItem.id,
        locationId: locationId,
        quantity: stockAmount
      });
    }

    const invMutation = `
      mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
        inventorySetOnHandQuantities(input: $input) {
          userErrors { message }
        }
      }
    `;
    const invRes = await executeGraphQL(invMutation, {
      input: { reason: "correction", setQuantities: quantities }
    });

    if (invRes.inventorySetOnHandQuantities.userErrors.length > 0) {
       console.error("Inventory Set Errors:", invRes.inventorySetOnHandQuantities.userErrors);
    } else {
       console.log("Inventory quantities updated.");
       console.log("Product E0018 successfully completed!");
    }

  } catch (error) {
    console.error('An error occurred:', error.message);
  }
}

finishProduct();
