const fs = require('fs');
const axios = require('axios');
const env = fs.readFileSync('.env', 'utf8');
const token = env.match(/VITE_SHOPIFY_ACCESS_TOKEN=(.*)/)[1].trim();
let shopUrl = env.match(/VITE_SHOPIFY_STORE_URL=(.*)/)[1].trim();
if (!shopUrl.startsWith('http')) shopUrl = 'https://' + shopUrl;

axios.post(shopUrl + '/admin/api/2024-04/graphql.json', {
  query: `
    query {
      collection(id: "gid://shopify/Collection/692905115729") {
        id
        title
        publicationCount
        resourcePublications(first: 10) {
          edges {
            node {
              publication {
                id
                name
              }
              isPublished
            }
          }
        }
      }
    }
  `
}, {
  headers: { 'X-Shopify-Access-Token': token }
}).then(res => {
  console.log(JSON.stringify(res.data, null, 2));
}).catch(err => {
  console.error(err.message);
});
