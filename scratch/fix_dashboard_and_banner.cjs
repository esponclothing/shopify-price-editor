const fs = require('fs');
const path = require('path');

// 1. Fix App.jsx assignedProducts filter
const appPath = path.join('c:', 'Users', 'HP', 'Desktop', 'Shopify-Price-Editor', 'src', 'App.jsx');
let appContent = fs.readFileSync(appPath, 'utf8');

const oldAssignedProducts = `const assignedProducts = selectedSub ? products.filter(p =>
      p.collections.edges.some(e => e.node.id === selectedSub.id)
    ) : [];`;
const newAssignedProducts = `const assignedProducts = selectedSub ? products.filter(p => {
      const subName = selectedSub.title.split("-").pop().trim();
      return p.collections.edges.some(e => e.node.id === selectedSub.id) || p.tags.includes(\`Sub: \${subName}\`);
    }) : [];`;

if (appContent.includes(oldAssignedProducts)) {
  appContent = appContent.replace(oldAssignedProducts, newAssignedProducts);
  fs.writeFileSync(appPath, appContent, 'utf8');
  console.log('App.jsx assignedProducts filter fixed.');
} else {
  console.log('App.jsx already fixed or code not found.');
}

// 2. Fix main-collection-product-grid.liquid Banner Centering
const themePath = path.join('c:', 'Users', 'HP', 'Desktop', '11fit theme', 'sections', 'main-collection-product-grid.liquid');
let themeContent = fs.readFileSync(themePath, 'utf8');

const oldBoxCSS = `.lucrative-offer-box {
                  flex: 0 0 92%; 
                  scroll-snap-align: center;
                  border-radius: 16px;
                  padding: 20px 24px; 
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  box-shadow: 0 10px 35px rgba(0,0,0,0.2);`;

const newBoxCSS = `.lucrative-offer-box {
                  flex: 0 0 92%; 
                  scroll-snap-align: center;
                  border-radius: 16px;
                  padding: 20px 24px; 
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  text-align: center;
                  gap: 12px;
                  box-shadow: 0 10px 35px rgba(0,0,0,0.2);`;

if (themeContent.includes(oldBoxCSS)) {
  themeContent = themeContent.replace(oldBoxCSS, newBoxCSS);
}

const oldMobileCSS = `.lucrative-offer-box {
                    flex-direction: column !important;
                    align-items: flex-start !important;
                    padding: 16px !important;
                    gap: 12px;
                    min-height: auto !important; 
                  }`;

const newMobileCSS = `.lucrative-offer-box {
                    flex-direction: column !important;
                    align-items: center !important;
                    text-align: center !important;
                    padding: 16px !important;
                    gap: 12px;
                    min-height: auto !important; 
                  }`;

if (themeContent.includes(oldMobileCSS)) {
  themeContent = themeContent.replace(oldMobileCSS, newMobileCSS);
}

const oldContentCSS = `.lucrative-offer-content {
                  z-index: 2;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  }`;

const newContentCSS = `.lucrative-offer-content {
                  z-index: 2;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  text-align: center;
                  }`;

if (themeContent.includes(oldContentCSS)) {
  themeContent = themeContent.replace(oldContentCSS, newContentCSS);
}

fs.writeFileSync(themePath, themeContent, 'utf8');
console.log('main-collection-product-grid.liquid updated to center banner text.');
