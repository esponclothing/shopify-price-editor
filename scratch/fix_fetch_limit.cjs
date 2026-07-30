const fs = require('fs');
const path = 'src/App.jsx';
let content = fs.readFileSync(path, 'utf8');

// Replace products(first: 50 with products(first: 250
content = content.replace(/products\(first: 50/g, 'products(first: 250');

fs.writeFileSync(path, content, 'utf8');
console.log("Updated products fetch limit to 250");
