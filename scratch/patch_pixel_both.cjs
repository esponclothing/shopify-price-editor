const fs = require('fs');
let code = fs.readFileSync('scratch/whatsapp-checkout.js', 'utf8');

const oldRegex = /\/\/ Fire Meta Pixel Purchase Event[\s\S]*?catch\(e\) \{\}/;

const newCode = `// Fire Meta Pixel Purchase Event
      try {
        const totEl = document.getElementById('wa-total');
        const finalPrice = totEl ? (parseFloat(totEl.getAttribute('data-base-total') || totEl.innerText.replace(/[^0-9.]/g, '')) || 0) : 0;
        
        // Inject standard Meta Pixel to completely bypass Shopify Sandbox for BOTH pixels
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        
        // Init BOTH Pixels
        fbq('init', '1389821399722687');
        fbq('init', '1065954715920985');
        
        // Fire Purchase Event
        fbq('track', 'Purchase', {
          value: finalPrice,
          currency: 'INR'
        });
        
        // Also attempt Shopify Web Pixels API for Google Analytics/others
        if (window.Shopify && window.Shopify.analytics && typeof window.Shopify.analytics.publish === 'function') {
           window.Shopify.analytics.publish("checkout_completed", {
             checkout: {
               currencyCode: "INR",
               totalPrice: { amount: finalPrice, currencyCode: "INR" }
             }
           });
        }
      } catch(e) {}`;

if(code.match(oldRegex)) {
  fs.writeFileSync('scratch/whatsapp-checkout.js', code.replace(oldRegex, newCode));
  console.log('Replaced successfully');
} else {
  console.log('Old code not found via regex!');
}
