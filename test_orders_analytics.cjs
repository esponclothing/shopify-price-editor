const axios = require('axios');
async function run() { 
  const res = await axios.post('https://i2tu0d-jc.myshopify.com/admin/api/2024-01/graphql.json', { 
    query: '{ orders(first: 10) { edges { node { id name totalPriceSet { presentmentMoney { amount } } createdAt customer { firstName lastName email } discountApplications(first: 10) { edges { node { ... on AutomaticDiscountApplication { title } } } } } } } }' 
  }, { 
    headers: { 'X-Shopify-Access-Token': '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', 'Content-Type': 'application/json' } 
  }); 
  console.log(JSON.stringify(res.data, null, 2)); 
} 
run();
