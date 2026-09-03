const fs = require('fs');

let code = fs.readFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\layout\\theme.liquid', 'utf8');

const regex = /\\.then\\(parsedState => \\{\\s*if \\(parsedState\\.status\\) \\{/g;

const replacement = `.then(parsedState => {
      try {
        if (window.Shopify && window.Shopify.analytics && typeof window.Shopify.analytics.publish === 'function') {
          window.Shopify.analytics.publish("product_added_to_cart", {
            cartLine: {
              merchandise: { id: "gid://shopify/ProductVariant/" + variantId },
              quantity: 1
            }
          });
        }
      } catch(e) {}
      if (parsedState.status) {`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('c:\\Users\\HP\\Desktop\\11fit theme\\layout\\theme.liquid', code);
    console.log('Successfully patched theme.liquid!');
} else {
    console.log('Target string not found in theme.liquid!');
}
