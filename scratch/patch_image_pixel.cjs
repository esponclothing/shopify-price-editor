const fs = require('fs');
let code = fs.readFileSync('scratch/whatsapp-checkout.js', 'utf8');

const oldRegex = /\/\/ Init BOTH Pixels[\s\S]*?currency: 'INR'[\s\S]*?\}\);/m;

const newCode = `// 100% Foolproof Tracking using Meta Image Pixels (Bypasses all Shopify Proxies & Sandboxes)
        const firePixel = (pixelId, val) => {
          const img = document.createElement('img');
          img.height = 1; img.width = 1; img.style.display = 'none';
          img.src = 'https://www.facebook.com/tr/?id=' + pixelId + '&ev=Purchase&cd[value]=' + val + '&cd[currency]=INR&noscript=1';
          document.body.appendChild(img);
        };
        
        firePixel('1389821399722687', finalPrice);
        firePixel('1065954715920985', finalPrice);`;

if(code.match(oldRegex)) {
  fs.writeFileSync('scratch/whatsapp-checkout.js', code.replace(oldRegex, newCode));
  console.log('Replaced successfully');
} else {
  console.log('Old code not found via regex!');
}
