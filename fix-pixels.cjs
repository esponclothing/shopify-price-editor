const fs = require('fs');

let code = fs.readFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', 'utf8');
code = code.replace(/\r\n/g, '\n');

const target = `        // 100% Foolproof Tracking using Meta Image Pixels (Bypasses all Shopify Proxies & Sandboxes)
        const firePixel = (pixelId, val) => {
          const img = document.createElement('img');
          img.height = 1; img.width = 1; img.style.display = 'none';
          img.src = 'https://www.facebook.com/tr/?id=' + pixelId + '&ev=Purchase&cd[value]=' + val + '&cd[currency]=INR&noscript=1';
          document.body.appendChild(img);
        };
        
        firePixel('1389821399722687', finalPrice);
        firePixel('1065954715920985', finalPrice);
        fbq('trackSingle', '1065954715920985', 'Purchase', {
          value: finalPrice,
          currency: 'INR'
        });`;

const replacement = `        // Init BOTH Pixels
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

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', code);
    console.log('Successfully reverted pixel tracking code to fbq!');
} else {
    console.log('Target string not found for pixel tracking replacement!');
}
