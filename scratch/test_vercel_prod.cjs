const axios = require('axios');

async function testVercel() {
  const query = `
    query {
      products(first: 20) {
        edges {
          node {
            id title vendor productType tags handle
            seo { title description }
          }
        }
      }
    }
  `;

  try {
    const res = await axios.post('https://shopify-price-editor.vercel.app/api/shopify/graphql.json', { query }, {
      headers: {
        'x-client-store-url': 'i2tu0d-jc.myshopify.com',
        'x-client-access-token': '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',
        'Content-Type': 'application/json'
      }
    });
    console.log("Success! Status:", res.status);
    console.log("Products length:", res.data?.data?.products?.edges?.length);
  } catch (err) {
    console.error("Failed! Status:", err.response?.status);
    console.error("Data:", err.response?.data);
    console.error("Message:", err.message);
  }
}

testVercel();
