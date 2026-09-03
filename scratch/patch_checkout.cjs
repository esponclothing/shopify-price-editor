const fs = require('fs');
let code = fs.readFileSync('scratch/whatsapp-checkout.js', 'utf8');

const oldRegex = /\/\/ Fire Meta Pixel Purchase Event[\s\S]*?catch\(e\) \{\}/;

const newCode = `// Fire Meta Pixel Purchase Event
      try {
        if (typeof fbq === 'function') {
          const totEl = document.getElementById('wa-total');
          const finalPrice = totEl ? (parseFloat(totEl.getAttribute('data-base-total') || totEl.innerText.replace(/[^0-9.]/g, '')) || 0) : 0;
          fbq('track', 'Purchase', {
            value: finalPrice,
            currency: 'INR'
          });
        }
      } catch(e) {}`;

if(code.match(oldRegex)) {
  fs.writeFileSync('scratch/whatsapp-checkout.js', code.replace(oldRegex, newCode));
  console.log('Replaced successfully');
} else {
  console.log('Old code not found via regex!');
}
