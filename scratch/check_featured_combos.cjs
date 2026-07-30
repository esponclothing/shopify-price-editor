const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)[1].trim();
let shopUrl = env.match(/VITE_SHOPIFY_STORE_URL=(.*)/)[1].trim();
if (!shopUrl.startsWith('http')) shopUrl = 'https://' + shopUrl;

const handlesToCheck = [
  "shark-graphic-tee", "chai-lovers-tee", "11fit-savage-tee", "fearless-lion-tee",
  "espon-e0013-air-lite-reflective-track-pant", "espon-e007-ns-air-lite-lycra-3-stripe-track-pant",
  "espon-e001-air-flex-jeans-pocket-track-pant", "espon-n1008-crush-lycra-performance-track-pant",
  "cockroach-janta-takeover-tee", "cockroach-club-cjp-edition-tee", "cockroach-survivor-tee"
];

const checkProduct = async (handle) => {
  const query = `
    query {
      productByHandle(handle: "${handle}") {
        id
        title
        metafield(namespace: "price_editor", key: "combo_config") {
          value
        }
      }
    }
  `;
  try {
    const res = await axios.post(shopUrl + '/admin/api/2024-04/graphql.json', { query }, {
      headers: { 'X-Shopify-Access-Token': token }
    });
    if (res.data.errors) {
      console.log(handle, ':', JSON.stringify(res.data.errors));
    } else {
      console.log(handle, ':', res.data.data.productByHandle?.metafield?.value || 'no combo');
    }
  } catch (err) {
    console.error(handle, ':', err.message);
  }
};

const run = async () => {
  for (const h of handlesToCheck) {
    await checkProduct(h);
  }
};
run();
