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

async function findProducts() {
  const query = `
    {
      products(first: 5, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            title
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  inventoryQuantity
                }
              }
            }
          }
        }
      }
    }
  `;
  const res = await executeGraphQL(query);
  console.log(JSON.stringify(res.products.edges, null, 2));
}

findProducts();
