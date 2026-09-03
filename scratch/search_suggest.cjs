const fs = require('fs');
const code = fs.readFileSync('api/whatsapp-ai.js', 'utf8');
const lines = code.split('\n');
lines.forEach((l, i) => {
  if (l.toLowerCase().includes('suggest')) {
    console.log(`Line ${i + 1}: ${l}`);
  }
});
