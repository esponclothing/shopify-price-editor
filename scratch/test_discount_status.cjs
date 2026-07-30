const axios = require('axios');
async function run() { 
  const res = await axios.post('https://i2tu0d-jc.myshopify.com/admin/api/2024-01/graphql.json', { 
    query: '{ discountNode(id: "gid://shopify/DiscountAutomaticNode/2273635270737") { discount { ... on DiscountAutomaticBasic { title status startsAt endsAt } } } }' 
  }, { 
    headers: { 'X-Shopify-Access-Token': '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', 'Content-Type': 'application/json' } 
  }); 
  console.log(JSON.stringify(res.data, null, 2)); 
} 
run();
