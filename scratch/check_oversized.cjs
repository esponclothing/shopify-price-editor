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
  const query = `
    query {
      collections(first: 50) {
        edges {
          node {
            id
            title
            handle
            productsCount { count }
            products(first: 50) {
              edges {
                node {
                  id
                  title
                  tags
                }
              }
            }
          }
        }
      }
      products(first: 250) {
        edges {
          node {
            id
            title
            tags
            collections(first: 10) {
              edges {
                node {
                  id
                  title
                }
              }
            }
          }
        }
      }
    }
  `;
  try {
    const res = await axios.post(`https://${cleanStore}/admin/api/2024-04/graphql.json`, { query }, {
      headers: {
        'X-Shopify-Access-Token': token.trim(),
        'Content-Type': 'application/json'
      }
    });

    const data = res.data.data;
    console.log("=== COLLECTIONS OVERVIEW ===");
    const subcats = data.collections.edges.filter(c => c.node.title.includes("Oversized") || c.node.title.includes("T-shirts"));
    subcats.forEach(c => {
      console.log(`Collection: ${c.node.title} (${c.node.id})`);
      console.log(`  Count: ${c.node.productsCount?.count || 0}`);
      console.log("  Products in Collection:");
      c.node.products.edges.forEach(p => {
        console.log(`    - ${p.node.title} (ID: ${p.node.id})`);
      });
    });

    console.log("\n=== PRODUCTS WITH TAG 'Sub: Oversized' ===");
    data.products.edges.forEach(p => {
      const isOversized = p.node.tags.some(t => t.toLowerCase() === "sub: oversized");
      if (isOversized) {
        console.log(`Product: ${p.node.title} (ID: ${p.node.id})`);
        console.log(`  Tags: ${p.node.tags.join(', ')}`);
        console.log(`  Collections: ${p.node.collections.edges.map(e => e.node.title).join(', ')}`);
      }
    });
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}
run();
