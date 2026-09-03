const fs = require('fs');
let code = fs.readFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', 'utf8');
code = code.replace(/\r\n/g, '\n');

const target = `    try {
      const cachedBal = sessionStorage.getItem(\`wa_bal_\${waPhone}\`);
        if (cachedBal) {
          waWalletBalance = parseFloat(cachedBal);
          return;
        }
        const res = await fetch(\`\${WA_API_BASE}/wallet-balance\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          merchant_key: MERCHANT_KEY, 
          phone: waPhone,
          device_id: devId
        })
      });
      const data = await res.json();
      waWalletBalance = parseFloat(data?.customer?.storeCreditBalance || data?.storeCreditBalance || 0);
        sessionStorage.setItem(\`wa_bal_\${waPhone}\`, waWalletBalance);
    } catch(e) {`;

const replacement = `    try {
        const res = await fetch(\`\${WA_API_BASE}/wallet-balance\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          merchant_key: MERCHANT_KEY, 
          phone: waPhone,
          device_id: devId
        })
      });
      const data = await res.json();
      waWalletBalance = parseFloat(data?.customer?.storeCreditBalance || data?.storeCreditBalance || 0);
    } catch(e) {`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', code);
    console.log('Successfully disabled wallet caching!');
} else {
    console.log('Target string not found for wallet caching!');
}
