const fs = require('fs');

let code = fs.readFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\product-form.js', 'utf8');
code = code.replace(/\\r\\n/g, '\\n');

const target = `const afterAdded = (finalResponse) => {
              const startMarker = CartPerformance.createStartingMarker('add:wait-for-subscribers');`;

const replacement = `const afterAdded = (finalResponse) => {
              try {
                if (window.Shopify && window.Shopify.analytics && typeof window.Shopify.analytics.publish === 'function') {
                  window.Shopify.analytics.publish("product_added_to_cart", {
                    cartLine: {
                      merchandise: { id: "gid://shopify/ProductVariant/" + formData.get('id') },
                      quantity: parseInt(formData.get('quantity') || 1, 10)
                    }
                  });
                }
              } catch(e) {}
              const startMarker = CartPerformance.createStartingMarker('add:wait-for-subscribers');`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\assets\\product-form.js', code);
    console.log('Successfully patched product-form.js!');
} else {
    console.log('Target string not found in product-form.js!');
}
