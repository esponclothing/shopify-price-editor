const https = require('https');

https.get('https://shopify-price-editor.vercel.app/api/whatsapp-inbox?action=chats', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, data));
}).on('error', console.error);
