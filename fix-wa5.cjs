const fs = require('fs');
let code = fs.readFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', 'utf8');

// Normalize to LF
code = code.replace(/\r\n/g, '\n');

const updateDraftCode = `        try {
          // STEP 1: Apply discount + link customer to Shopify draft BEFORE Cashfree payment.
          // This ensures: correct discounted price in Shopify order + correct customer details.
          try {
            const udRes = await fetch(\`\${WA_API_BASE}/checkout/update-draft\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                merchant_key: MERCHANT_KEY, 
                draft_order_id: waDraftOrderId,
              payment_method: (waSelectedPayment === 'prepaid' && sessionStorage.getItem('wa_prepaid_' + waDraftOrderId)) ? 'none' : waSelectedPayment,
              customer_email: waEmail,
                customer_phone: waPhone,
                shipping_address: addr
              })
            });
            if (waSelectedPayment === 'prepaid') sessionStorage.setItem('wa_prepaid_' + waDraftOrderId, 'true');
            if (!udRes.ok) {
              const udErr = await udRes.json().catch(() => ({}));
              console.warn('update-draft warning (non-fatal):', udErr);
            }
          } catch(udErr) {
            console.warn('update-draft network error (non-fatal):', udErr);
          }
`;

// It ends at:
const endCode = `        if (netPayable <= 0) {`;

const searchBlock = `        try {
          // STEP 1: Apply discount + link customer to Shopify draft BEFORE Cashfree payment.
          // This ensures: correct discounted price in Shopify order + correct customer details.
          try {
            const udRes = await fetch(\`\${WA_API_BASE}/checkout/update-draft\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                merchant_key: MERCHANT_KEY, 
                draft_order_id: waDraftOrderId,
              payment_method: (waSelectedPayment === 'prepaid' && sessionStorage.getItem('wa_prepaid_' + waDraftOrderId)) ? 'none' : waSelectedPayment,
              customer_email: waEmail,
                customer_phone: waPhone,
                shipping_address: addr
              })
            });
            if (waSelectedPayment === 'prepaid') sessionStorage.setItem('wa_prepaid_' + waDraftOrderId, 'true');
            if (!udRes.ok) {
              const udErr = await udRes.json().catch(() => ({}));
              console.warn('update-draft warning (non-fatal):', udErr);
            }
          } catch(udErr) {
            console.warn('update-draft network error (non-fatal):', udErr);
          }`;

const exactMatchSearchBlock = searchBlock;

if(code.includes(exactMatchSearchBlock)) {
    code = code.replace(exactMatchSearchBlock, '');
} else {
    console.log("FAILED to find search block");
}

code = code.replace(endCode, exactMatchSearchBlock + '\n        } catch(ignore) {}\n\n' + endCode);

const clearCartBlock = `      // Clear Shopify Cart
      try {
        await fetch('/cart/clear.js', { method: 'POST' });
        if (window.lxRefreshCartUI) window.lxRefreshCartUI();
      } catch(e) {}`;

const clearCartAndWalletBlock = `      // Clear Shopify Cart and Wallet Cache
      try {
        await fetch('/cart/clear.js', { method: 'POST' });
        if (window.lxRefreshCartUI) window.lxRefreshCartUI();
        if (typeof waPhone !== 'undefined' && waPhone) sessionStorage.removeItem('wa_bal_' + waPhone);
        waWalletBalance = 0;
        waWalletApplied = false;
        waWalletAppliedAmt = 0;
      } catch(e) {}`;

if (code.includes(clearCartBlock)) {
    code = code.replace(clearCartBlock, clearCartAndWalletBlock);
} else {
    console.log("FAILED to find clear cart block");
}

fs.writeFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', code);
console.log('Fixed whatsapp-checkout.js via LF normalized script!');
