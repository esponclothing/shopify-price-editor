const fs = require('fs');

let settings = fs.readFileSync('api/whatsapp-settings.js', 'utf8');
let webpush = fs.readFileSync('api/webpush.js', 'utf8');
const webpushBody = webpush.match(/export default async function handler[^\{]*\{([\s\S]*)\}/)[1];

const newSettings = settings.replace("if (req.method === 'OPTIONS') return res.status(200).end();",
  "if (req.method === 'OPTIONS') return res.status(200).end();\n\n" +
  "  // --- MERGED WEBPUSH ENDPOINT ---\n" +
  "  if (req.url && req.url.includes('/api/webpush')) {\n" +
  webpushBody + "\n" +
  "    return;\n" +
  "  }\n"
);

fs.writeFileSync('api/whatsapp-settings.js', newSettings);
console.log('Merged webpush into whatsapp-settings.js');
