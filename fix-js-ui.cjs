const fs = require('fs');

let code = fs.readFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', 'utf8');
code = code.replace(/\r\n/g, '\n');

// 1. waProceedToPayment
const proceedTarget = `    // Reset wallet state when entering payment step
    waWalletApplied = false;
    waWalletAppliedAmt = 0;`;
const proceedReplace = `    // Reset wallet state when entering payment step
    waWalletApplied = false;
    waWalletAppliedAmt = 0;
    waSelectedPayment = null;`;
code = code.replace(proceedTarget, proceedReplace);

// 2. renderPaymentMethods top
const renderTopTarget = `function renderPaymentMethods() {
      const container = document.getElementById('wa-payment-methods-container');
      container.innerHTML = '';`;
const renderTopReplace = `function renderPaymentMethods() {
      const container = document.getElementById('wa-payment-methods-container');
      const payBtn = document.getElementById('wa-cod-btn');
      const safeZone = document.getElementById('wa-btn-safe-zone') || document.body;
      if (payBtn && container.contains(payBtn)) {
          safeZone.appendChild(payBtn);
      }
      container.innerHTML = '';`;
code = code.replace(renderTopTarget, renderTopReplace);

// 3. renderPaymentMethods loop ID
const renderOptIdTarget = `        opt.onclick = () => {
          if (waSelectedPayment === m.id) return;
          waSelectedPayment = m.id;
          renderPaymentMethods();
        };
        container.appendChild(opt);`;
const renderOptIdReplace = `        opt.onclick = () => {
          if (waSelectedPayment === m.id) return;
          waSelectedPayment = m.id;
          renderPaymentMethods();
        };
        opt.id = 'wa-pay-opt-' + m.id;
        container.appendChild(opt);`;
code = code.replace(renderOptIdTarget, renderOptIdReplace);

// 4. renderPaymentMethods bottom
const renderBottomTarget = `      waUpdateBtnTotal(baseTotal);
      
      // Attempt to load Cashfree if needed`;
const renderBottomReplace = `      waUpdateBtnTotal(baseTotal);
      
      if (payBtn) {
         const selectedOpt = document.getElementById('wa-pay-opt-' + waSelectedPayment);
         if (selectedOpt) {
            payBtn.style.marginTop = '14px';
            payBtn.style.marginBottom = '4px';
            payBtn.style.width = '100%';
            payBtn.style.borderRadius = '10px';
            payBtn.onclick = (e) => {
                e.stopPropagation();
                waPayNow();
            };
            selectedOpt.appendChild(payBtn);
         }
      }
      
      // Attempt to load Cashfree if needed`;
code = code.replace(renderBottomTarget, renderBottomReplace);

fs.writeFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', code);
console.log('Successfully patched whatsapp-checkout.js for UI restructure!');
