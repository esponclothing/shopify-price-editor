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

async function addVariants() {
  try {
    const locationData = await executeGraphQL(`{ locations(first: 1) { edges { node { id } } } }`);
    const locationId = locationData.locations.edges[0].node.id;

    console.log("Creating Variants in bulk...");
    // Black is excluded because it was auto-created as the first variant when options were added.
    const colors = ['Navy', 'Beige', 'Dark Grey', 'Olive Green', 'Light Grey'];
    
    const variantsInput = colors.map(color => {
      return {
        optionValues: [
          { optionName: "Color", name: color },
          { optionName: "Set Size", name: "M-XXL (Pack of 4)" }
        ],
        price: 798.00,
        compareAtPrice: 1596.00,
        inventoryPolicy: "DENY",
        inventoryItem: {
          sku: `E0023-${color.toUpperCase().substring(0,3)}`,
          tracked: true
        }
      };
    });

    const bulkCreateMutation = `
      mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) {
          productVariants {
            id
            inventoryItem { id }
            title
          }
          userErrors { message }
        }
      }
    `;

    const createRes = await executeGraphQL(bulkCreateMutation, {
      productId: productId,
      variants: variantsInput
    });

    if (createRes.productVariantsBulkCreate.userErrors.length > 0) {
      console.error(createRes.productVariantsBulkCreate.userErrors);
      return;
    }

    const createdVariants = createRes.productVariantsBulkCreate.productVariants;
    console.log(`Successfully created ${createdVariants.length} variants!`);

    // 3. Set Inventory Quantity
    console.log("Setting inventory quantities...");
    const quantities = [];
    for (const v of createdVariants) {
      const color = v.title.split(' / ')[0]; // usually format is "Black / M-XXL (Pack of 4)"
      const qty = (color === 'Black' || color === 'Navy') ? 10 : 0;
      
      quantities.push({
        inventoryItemId: v.inventoryItem.id,
        locationId: locationId,
        quantity: qty
      });
    }

    const invMutation = `
      mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
        inventorySetOnHandQuantities(input: $input) {
          userErrors { message }
        }
      }
    `;
    await executeGraphQL(invMutation, {
      input: {
        reason: "correction",
        setQuantities: quantities
      }
    });

    console.log("Inventory quantities updated.");

    // Delete default variant
    const getVariantsQuery = `
      query getVariants($id: ID!) {
        product(id: $id) {
          variants(first: 10) {
            edges {
              node { id title }
            }
          }
        }
      }
    `;
    const varData = await executeGraphQL(getVariantsQuery, { id: productId });
    const defaultVariant = varData.product.variants.edges.find(e => e.node.title === 'Default Title');
    if (defaultVariant) {
      console.log('Deleting Default Title variant...');
      await executeGraphQL(`
        mutation productVariantDelete($id: ID!) {
          productVariantDelete(id: $id) { userErrors { message } }
        }
      `, { id: defaultVariant.node.id });
    }

    console.log("Finished adding variants!");

  } catch (error) {
    console.error(error.message);
  }
}

addVariants();
