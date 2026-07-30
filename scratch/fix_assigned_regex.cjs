const fs = require('fs');
const path = require('path');

const appPath = path.join('c:', 'Users', 'HP', 'Desktop', 'Shopify-Price-Editor', 'src', 'App.jsx');
let appContent = fs.readFileSync(appPath, 'utf8');

// Use regex to replace regardless of newlines
const oldRegex = /const assignedProducts = selectedSub \? products\.filter\(p =>\s+p\.collections\.edges\.some\(e => e\.node\.id === selectedSub\.id\)\s+\) : \[\];/m;

const newAssignedProducts = `const assignedProducts = selectedSub ? products.filter(p => {
      const subName = selectedSub.title.split("-").pop().trim();
      return p.collections.edges.some(e => e.node.id === selectedSub.id) || p.tags.includes(\`Sub: \${subName}\`);
    }) : [];`;

appContent = appContent.replace(oldRegex, newAssignedProducts);
fs.writeFileSync(appPath, appContent, 'utf8');
console.log('App.jsx assignedProducts filter fixed properly!');
