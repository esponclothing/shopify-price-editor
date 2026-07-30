const fs = require('fs');

const content = fs.readFileSync('src/App.jsx', 'utf8');
const lines = content.split('\n');

console.log("=== OffersDashboard Line ===");
lines.forEach((line, idx) => {
  if (line.includes('OffersDashboard')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
