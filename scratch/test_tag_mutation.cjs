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
  // Try adding tag to "Game Over Oversized Tee" (gid://shopify/Product/15873077968977)
  const addMut = `
    mutation tagsAdd($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        node {
          id
          ... on Product {
            title
            tags
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  try {
    const res = await axios.post(`https://${cleanStore}/admin/api/2024-04/graphql.json`, { 
      query: addMut, 
      variables: { id: "gid://shopify/Product/15873077968977", tags: ["Sub: TestTag"] } 
    }, {
      headers: {
        'X-Shopify-Access-Token': token.trim(),
        'Content-Type': 'application/json'
      }
    });
    console.log("Add Tag Response:", JSON.stringify(res.data, null, 2));

    // Now remove it
    const removeMut = `
      mutation tagsRemove($id: ID!, $tags: [String!]!) {
        tagsRemove(id: $id, tags: $tags) {
          node {
            id
            ... on Product {
              title
              tags
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    const resRemove = await axios.post(`https://${cleanStore}/admin/api/2024-04/graphql.json`, { 
      query: removeMut, 
      variables: { id: "gid://shopify/Product/15873077968977", tags: ["Sub: TestTag"] } 
    }, {
      headers: {
        'X-Shopify-Access-Token': token.trim(),
        'Content-Type': 'application/json'
      }
    });
    console.log("Remove Tag Response:", JSON.stringify(resRemove.data, null, 2));

  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}
run();
