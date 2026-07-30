const axios = require('axios');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const storeUrl = env.VITE_SHOPIFY_STORE_URL || '';
const accessToken = env.VITE_SHOPIFY_ACCESS_TOKEN || '';

async function checkAllVariants() {
  let cleanStore = storeUrl.trim();
  if (cleanStore.startsWith('https://')) cleanStore = cleanStore.replace('https://', '');
  if (cleanStore.startsWith('http://')) cleanStore = cleanStore.replace('http://', '');

  const url = `https://${cleanStore}/admin/api/2024-04/graphql.json`;
  const query = `
    query {
      products(first: 50) {
        edges {
          node {
            title
            variants(first: 50) {
              edges {
                node {
                  title
                  price
                  compareAtPrice
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await axios.post(url, { query }, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    res.data.data.products.edges.forEach(e => {
      console.log(`Product: ${e.node.title}`);
      e.node.variants.edges.forEach(v => {
        console.log(`  Variant: ${v.node.title} - Price: ${v.node.price} - CompareAt: ${v.node.compareAtPrice}`);
      });
    });
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}

checkAllVariants();
