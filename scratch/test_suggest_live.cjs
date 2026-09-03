const https = require('https');

const data = JSON.stringify({
  action: 'suggest',
  text: 'Show me some trending products'
});

const options = {
  hostname: 'shopify-price-editor.vercel.app',
  port: 443,
  path: '/api/whatsapp-ai?action=suggest',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', console.error);
req.write(data);
req.end();
