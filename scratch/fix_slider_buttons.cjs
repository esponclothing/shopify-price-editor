const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'HP', 'Desktop', '11fit theme', 'sections', 'main-collection-product-grid.liquid');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove all slider-nav-btn buttons
content = content.replace(/<button class="slider-nav-btn[^>]*>.*?<\/button>/gs, '');

// 2. Change the auto-slide logic to use snappyScroll for smooth forward animation
content = content.replace(
  /slider\.scrollLeft \+= 240;/g, 
  "snappyScroll(slider, 'right', 240);"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Slider buttons removed and auto-swiping made smooth.');
