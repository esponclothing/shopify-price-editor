const fs = require('fs');

let code = fs.readFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', 'utf8');
code = code.replace(/\r\n/g, '\n');

const target = `            payBtn.onclick = (e) => {
                e.stopPropagation();
                waPayNow();
            };
            selectedOpt.appendChild(payBtn);`;

const replacement = `            payBtn.onclick = (e) => {
                e.stopPropagation();
                waPayNow();
            };
            // Append right AFTER the selected option, placing it OUTSIDE the method box
            container.insertBefore(payBtn, selectedOpt.nextSibling);`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', code);
    console.log('Successfully moved the button outside the method box!');
} else {
    console.log('Target string not found for button move!');
}
