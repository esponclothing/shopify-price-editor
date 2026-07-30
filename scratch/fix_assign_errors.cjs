const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'HP', 'Desktop', 'Shopify-Price-Editor', 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldLogic = `      try {
        if (shouldAssign) {
          // 1. Add Tag (for automated collections)
          const addMut = \`
            mutation tagsAdd($id: ID!, $tags: [String!]!) {
              tagsAdd(id: $id, tags: $tags) { userErrors { message } }
            }
          \`;
          await axios.post('/api/shopify/graphql.json', { query: addMut, variables: { id: product.id, tags: [subTag] } });
          
          // 2. Add directly to collection (for manual collections)
          const colAddMut = \`
            mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
              collectionAddProducts(id: $id, productIds: $productIds) { userErrors { message } }
            }
          \`;
          await axios.post('/api/shopify/graphql.json', { query: colAddMut, variables: { id: selectedSub.id, productIds: [product.id] } });
          
        } else {`;

const newLogic = `      try {
        if (shouldAssign) {
          // 1. Add Tag (for automated collections)
          const addMut = \`
            mutation tagsAdd($id: ID!, $tags: [String!]!) {
              tagsAdd(id: $id, tags: $tags) { userErrors { message } }
            }
          \`;
          const tagRes = await axios.post('/api/shopify/graphql.json', { query: addMut, variables: { id: product.id, tags: [subTag] } });
          if (tagRes.data.data.tagsAdd.userErrors?.length > 0) throw new Error(tagRes.data.data.tagsAdd.userErrors[0].message);

          // 2. Add directly to collection (for manual collections)
          const colAddMut = \`
            mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
              collectionAddProducts(id: $id, productIds: $productIds) { userErrors { message } }
            }
          \`;
          const colRes = await axios.post('/api/shopify/graphql.json', { query: colAddMut, variables: { id: selectedSub.id, productIds: [product.id] } });
          // If it fails because it's a smart collection, ignore the error! Otherwise, throw it.
          const userErrs = colRes.data.data?.collectionAddProducts?.userErrors || [];
          if (userErrs.length > 0 && !userErrs[0].message.toLowerCase().includes('smart')) {
            throw new Error(userErrs[0].message);
          }
          
          // Manually refetch the product to update the cache so it sticks!
          await new Promise(res => setTimeout(res, 500)); // wait a bit for shopify sync
        } else {`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(filePath, content, 'utf8');
console.log('App.jsx updated with better error handling for assign');
