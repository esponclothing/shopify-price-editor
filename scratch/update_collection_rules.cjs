const axios = require('axios');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
let storeUrl = '';
let token = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SHOPIFY_STORE_URL=')) storeUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SHOPIFY_ACCESS_TOKEN=')) token = line.split('=')[1].trim();
});

let cleanStore = storeUrl.trim();
if (cleanStore.startsWith('https://')) cleanStore = cleanStore.replace('https://', '');
if (cleanStore.startsWith('http://')) cleanStore = cleanStore.replace('http://', '');

async function run() {
  const mutation = `
    mutation collectionUpdate($input: CollectionInput!) {
      collectionUpdate(input: $input) {
        collection {
          id
          title
          ruleSet {
            appliedDisjunctively
            rules {
              column
              relation
              condition
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  const variables = {
    input: {
      id: "gid://shopify/Collection/692197785681",
      ruleSet: {
        appliedDisjunctively: true,
        rules: [
          {
            column: "TAG",
            relation: "EQUALS",
            condition: "Fit: Unisex Oversized Fit"
          },
          {
            column: "TAG",
            relation: "EQUALS",
            condition: "Fit: Unisex Oversized"
          },
          {
            column: "TAG",
            relation: "EQUALS",
            condition: "Style: Unisex Oversized"
          },
          {
            column: "TAG",
            relation: "EQUALS",
            condition: "Sub: Oversized"
          }
        ]
      }
    }
  };
  try {
    const res = await axios.post(`https://${cleanStore}/admin/api/2024-04/graphql.json`, { query: mutation, variables }, {
      headers: {
        'X-Shopify-Access-Token': token.trim(),
        'Content-Type': 'application/json'
      }
    });
    console.log(JSON.stringify(res.data.data.collectionUpdate, null, 2));
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}
run();
