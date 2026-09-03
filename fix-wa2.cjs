const fs = require('fs');

let code = fs.readFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', 'utf8');

const target1 = `        if (netPayable <= 0) {
          // Store Credit covers 100% of online advance payable amount! Directly complete order!
          try {
            await finishOrderBackend({ payment_method: waSelectedPayment, shipping_address: addr });
          } catch (e) {
            console.error(e);
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = originalBtnHTML;
            errEl.innerText = err.message || 'Failed to complete order. Please contact support.';
          }
          return;
        }

        try {
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

const replacement1 = `        try {
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
        } catch(ignore) {} // Dummy catch to preserve try-catch structure if needed, but wait! The original code had an outer try block which is at line 2196.

        if (netPayable <= 0) {
          // Store Credit covers 100% of online advance payable amount! Directly complete order!
          try {
            await finishOrderBackend({ payment_method: waSelectedPayment, shipping_address: addr });
          } catch (e) {
            console.error(e);
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = originalBtnHTML;
            errEl.innerText = err.message || 'Failed to complete order. Please contact support.';
          }
          return;
        }

        try {`;

// Wait, the original has an outer `try {` at line 2196!
const actualTarget1 = `        if (netPayable <= 0) {
          // Store Credit covers 100% of online advance payable amount! Directly complete order!
          try {
            await finishOrderBackend({ payment_method: waSelectedPayment, shipping_address: addr });
          } catch (e) {
            console.error(e);
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = originalBtnHTML;
            errEl.innerText = err.message || 'Failed to complete order. Please contact support.';
          }
          return;
        }

        try {
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

const actualReplacement1 = `        try {
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
        } catch(ignore) {} // Dummy catch for safety

        if (netPayable <= 0) {
          // Store Credit covers 100% of online advance payable amount! Directly complete order!
          try {
            await finishOrderBackend({ payment_method: waSelectedPayment, shipping_address: addr });
          } catch (e) {
            console.error(e);
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = originalBtnHTML;
            errEl.innerText = err.message || 'Failed to complete order. Please contact support.';
          }
          return;
        }

        try {`;

// Let's do Fix 2
const target2 = `      // Clear Shopify Cart
      try {
        await fetch('/cart/clear.js', { method: 'POST' });
        if (window.lxRefreshCartUI) window.lxRefreshCartUI();
      } catch(e) {}`;

const replacement2 = `      // Clear Shopify Cart and Wallet Cache
      try {
        await fetch('/cart/clear.js', { method: 'POST' });
        if (window.lxRefreshCartUI) window.lxRefreshCartUI();
        if (typeof waPhone !== 'undefined' && waPhone) sessionStorage.removeItem('wa_bal_' + waPhone);
        waWalletBalance = 0;
        waWalletApplied = false;
        waWalletAppliedAmt = 0;
      } catch(e) {}`;

code = code.replace(actualTarget1, actualReplacement1);
code = code.replace(target2, replacement2);

fs.writeFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', code);
console.log('Fixed whatsapp-checkout.js via script!');
