const fs = require('fs');
let code = fs.readFileSync('scratch/whatsapp-checkout.js', 'utf8');

const oldRegex = /\/\/ Init BOTH Pixels[\s\S]*?fbq\('track', 'Purchase', \{[\s\S]*?currency: 'INR'[\s\S]*?\}\);/m;

const newCode = `// Init BOTH Pixels
        fbq('init', '1389821399722687');
        fbq('init', '1065954715920985');
        
        // Fire Purchase Event explicitly for EACH pixel using trackSingle
        fbq('trackSingle', '1389821399722687', 'Purchase', {
          value: finalPrice,
          currency: 'INR'
        });
        fbq('trackSingle', '1065954715920985', 'Purchase', {
          value: finalPrice,
          currency: 'INR'
        });`;

if(code.match(oldRegex)) {
  fs.writeFileSync('scratch/whatsapp-checkout.js', code.replace(oldRegex, newCode));
  console.log('Replaced successfully');
} else {
  console.log('Old code not found via regex!');
}
