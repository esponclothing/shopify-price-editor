const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'HP', 'Desktop', 'Shopify-Price-Editor', 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix product assignment check to include the tag (makes it reliable even before Shopify syncs the smart collection)
content = content.replace(
  /const isAssigned = p\.collections\.edges\.some\(e => e\.node\.id === selectedSub\.id\);/g,
  `const isAssigned = p.collections.edges.some(e => e.node.id === selectedSub.id) || p.tags.includes(\`Sub: \${subName}\`);`
);
content = content.replace(
  /const isAssigned = previewProduct\.collections\.edges\.some\(e => e\.node\.id === selectedSub\.id\);/g,
  `const isAssigned = previewProduct.collections.edges.some(e => e.node.id === selectedSub.id) || previewProduct.tags.includes(\`Sub: \${subName}\`);`
);

// 2. Fix Image Upload to automatically trigger save!
const handleImgChangeOld = `  const handleThemeImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPendingUploadAsset({ file, base64: reader.result });
      // clear the custom text URL so the new file takes precedence
      setCurrentBlock(prev => ({ ...prev, custom_icon_asset: '', icon_image: '' }));
    };
    reader.readAsDataURL(file);
  };`;

const handleImgChangeNew = `  const handleThemeImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPendingUploadAsset({ file, base64: reader.result });
      setCurrentBlock(prev => ({ ...prev, custom_icon_asset: '', icon_image: '' }));
      // Wait a tick then auto-save!
      setTimeout(() => {
        document.getElementById('save-theme-btn')?.click();
      }, 100);
    };
    reader.readAsDataURL(file);
  };`;

content = content.replace(handleImgChangeOld, handleImgChangeNew);

// Give the button the ID 'save-theme-btn' so we can click it
content = content.replace(
  /className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center w-full"/g,
  `id="save-theme-btn" className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center w-full"`
);

// Run the fix assign errors script changes too
const oldAssignLogic = `      try {
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

const newAssignLogic = `      try {
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
          const userErrs = colRes.data.data?.collectionAddProducts?.userErrors || [];
          if (userErrs.length > 0 && !userErrs[0].message.toLowerCase().includes('smart')) {
            console.warn(userErrs[0].message);
          }
          
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
          const remRes = await axios.post('/api/shopify/graphql.json', { query: colRemMut, variables: { id: selectedSub.id, productIds: [product.id] } });
          const remErrs = remRes.data.data?.collectionRemoveProducts?.userErrors || [];
          if (remErrs.length > 0 && !remErrs[0].message.toLowerCase().includes('smart')) {
            console.warn(remErrs[0].message);
          }
        }
      } catch (err) {`;

content = content.replace(oldAssignLogic, newAssignLogic);

fs.writeFileSync(filePath, content, 'utf8');
console.log('App.jsx fully fixed for assignment checks and auto image upload!');
