const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'HP', 'Desktop', 'Shopify-Price-Editor', 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldLogic = `      try {
        if (shouldAssign) {
          const addMut = \`
            mutation tagsAdd($id: ID!, $tags: [String!]!) {
              tagsAdd(id: $id, tags: $tags) { userErrors { message } }
            }
          \`;
          await axios.post('/api/shopify/graphql.json', { query: addMut, variables: { id: product.id, tags: [subTag] } });
        } else {
          const removeMut = \`
            mutation tagsRemove($id: ID!, $tags: [String!]!) {
              tagsRemove(id: $id, tags: $tags) { userErrors { message } }
            }
          \`;
          await axios.post('/api/shopify/graphql.json', { query: removeMut, variables: { id: product.id, tags: [exactTagToRemove] } });
        }
      } catch (err) {`;

const newLogic = `      try {
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
          
        } else {
          // 1. Remove Tag
          const removeMut = \`
            mutation tagsRemove($id: ID!, $tags: [String!]!) {
              tagsRemove(id: $id, tags: $tags) { userErrors { message } }
            }
          \`;
          await axios.post('/api/shopify/graphql.json', { query: removeMut, variables: { id: product.id, tags: [exactTagToRemove] } });
          
          // 2. Remove directly from collection
          const colRemMut = \`
            mutation collectionRemoveProducts($id: ID!, $productIds: [ID!]!) {
              collectionRemoveProducts(id: $id, productIds: $productIds) { userErrors { message } }
            }
          \`;
          await axios.post('/api/shopify/graphql.json', { query: colRemMut, variables: { id: selectedSub.id, productIds: [product.id] } });
        }
      } catch (err) {`;

content = content.replace(oldLogic, newLogic);
fs.writeFileSync(filePath, content, 'utf8');
console.log('handleAssignToggle updated to use collectionAddProducts');
