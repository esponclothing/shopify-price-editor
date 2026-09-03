const fs = require('fs');

let code = fs.readFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', 'utf8');

if (code.includes('} catch(ignore) {}')) {
    code = code.replace('} catch(ignore) {}', '');
    fs.writeFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\whatsapp-checkout.js', code);
    console.log('Successfully removed orphaned catch!');
} else {
    console.log('Could not find orphaned catch.');
}
