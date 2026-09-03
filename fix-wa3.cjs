const fs = require('fs');

let code = fs.readFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', 'utf8');
let lines = code.split(/\r?\n/);

// Fix 1: Clear cache in finishOrderBackend
// Find line containing "// Clear Shopify Cart"
let clearIdx = lines.findIndex(l => l.includes('// Clear Shopify Cart'));
if (clearIdx !== -1) {
    // lines[clearIdx] is "// Clear Shopify Cart"
    lines[clearIdx] = '      // Clear Shopify Cart and Wallet Cache';
    // lines[clearIdx+1] is "      try {"
    // lines[clearIdx+2] is "        await fetch('/cart/clear.js', { method: 'POST' });"
    // lines[clearIdx+3] is "        if (window.lxRefreshCartUI) window.lxRefreshCartUI();"
    // Insert new logic after lines[clearIdx+3]
    lines.splice(clearIdx + 4, 0, 
        "        if (typeof waPhone !== 'undefined' && waPhone) sessionStorage.removeItem('wa_bal_' + waPhone);",
        "        waWalletBalance = 0;",
        "        waWalletApplied = false;",
        "        waWalletAppliedAmt = 0;"
    );
}

// Fix 2: Move update-draft BEFORE netPayable <= 0 check
// Find line containing "if (netPayable <= 0) {"
let netPayIdx = lines.findIndex(l => l.includes('if (netPayable <= 0) {'));

// Find line containing "// STEP 1: Apply discount"
let step1Idx = lines.findIndex(l => l.includes('// STEP 1: Apply discount'));

if (netPayIdx !== -1 && step1Idx !== -1) {
    // The try block for STEP 1 starts one line before step1Idx
    let startIdx = step1Idx - 1;
    // The try block ends at the catch block
    let endIdx = -1;
    for (let i = startIdx; i < lines.length; i++) {
        if (lines[i].includes('update-draft network error')) {
            endIdx = i + 2; // includes the } after catch block
            break;
        }
    }
    
    if (endIdx !== -1) {
        // Extract the block
        let extractedBlock = lines.splice(startIdx, endIdx - startIdx);
        // Ensure the try block has a dummy catch since we extracted the inner try/catch but what about the outer one?
        // Wait, the original code is:
        // try { 
        //   try { ... update-draft ... } catch (udErr) { ... }
        // } catch (e) { ... Cashfree ... }
        // Let's just insert the extracted block (which is a try-catch itself) before netPayIdx.
        // BUT wait, in the original code, the `try {` at `step1Idx - 1` is the OUTER try that wraps Cashfree!
        // Ah! If `step1Idx - 1` is the outer try, we can't just extract it!
    }
}
