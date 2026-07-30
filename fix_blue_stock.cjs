const axios = require('axios');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const storeUrl = envFile.match(/VITE_SHOPIFY_STORE_URL=(.+)/)[1].trim();
const accessToken = envFile.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.+)/)[1].trim();

const GRAPHQL_URL = `https://${storeUrl}/admin/api/2024-04/graphql.json`;

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

async function fixBlueStock() {
  const locationData = await executeGraphQL(`{ locations(first: 1) { edges { node { id } } } }`);
  const locationId = locationData.locations.edges[0].node.id;

  const invMutation = `
    mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
      inventorySetOnHandQuantities(input: $input) {
        userErrors { message }
      }
    }
  `;
  
  // The Blue variant inventoryItem ID from previous logs:
  // gid://shopify/InventoryItem/54614246359172
  
  const invRes = await executeGraphQL(invMutation, {
    input: {
      reason: "correction",
      setQuantities: [{
        inventoryItemId: "gid://shopify/InventoryItem/54614246359172",
        locationId: locationId,
        quantity: 50
      }]
    }
  });

  if (invRes.inventorySetOnHandQuantities.userErrors.length > 0) {
     console.error("Inventory Set Errors:", invRes.inventorySetOnHandQuantities.userErrors);
  } else {
     console.log("Blue variant inventory quantity corrected to 50.");
  }
}

fixBlueStock();
