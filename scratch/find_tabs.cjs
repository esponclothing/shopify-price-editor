const fs = require('fs');

const content = fs.readFileSync('src/App.jsx', 'utf8');
const lines = content.split('\n');

console.log("=== Occurrences of activeTab or setActiveTab ===");
lines.forEach((line, idx) => {
  if (line.includes('activeTab') || line.includes('setActiveTab') || line.includes('offersTab') || line.includes('setOffersTab')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
