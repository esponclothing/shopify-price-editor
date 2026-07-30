const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'HP', 'Desktop', '11fit theme', 'sections', 'main-collection-product-grid.liquid');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove the inline background style from lucrative-offer-box so our CSS animation takes over
content = content.replace(/style="background: linear-gradient[^"]*;/g, 'style="');

// 2. Add the dynamic gradient CSS animation
const animatedCss = `
              .lucrative-offer-box {
                flex: 0 0 92%; 
                scroll-snap-align: center;
                border-radius: 16px;
                padding: 20px 24px; 
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: 0 10px 35px rgba(0,0,0,0.2);
                position: relative;
                overflow: hidden;
                border: 1px solid rgba(255,255,255,0.2);
                
                /* DYNAMIC GRADIENT ANIMATION */
                background: linear-gradient(270deg, #ff512f, #dd2476, #8e2de2, #4a00e0, #ff512f);
                background-size: 1000% 1000%;
                animation: dynamicGradientShift 8s ease infinite;
              }
              
              @keyframes dynamicGradientShift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
`;

content = content.replace(/\.lucrative-offer-box\s*\{[^}]+\}/, animatedCss);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Dynamic Gradient Banner CSS Applied!');
