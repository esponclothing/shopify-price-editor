const axios = require('axios');
axios.get('https://shopify-price-editor.vercel.app/').then(r => {
  const match = r.data.match(/assets\/index-[^\"]*\.js/);
  if (match) {
    axios.get('https://shopify-price-editor.vercel.app/' + match[0]).then(r2 => {
      console.log('Old token present:', r2.data.includes('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'));
      console.log('New token present:', r2.data.includes('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'));
    });
  } else {
    console.log('No index js found');
  }
});
