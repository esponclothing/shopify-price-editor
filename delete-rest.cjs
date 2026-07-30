const axios = require('axios');
const url = 'https://i2tu0d-jc.myshopify.com/admin/api/2024-01/metafields/190089459892305.json';
const headers = { 'X-Shopify-Access-Token': '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' };

async function run() {
  try {
    const res = await axios.delete(url, {headers});
    console.log("DELETED SUCCESSFULLY");
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
run();
