const fs = require('fs');

const fixFile = (path) => {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/\\`/g, '`');
  content = content.replace(/\\\$/g, '$');
  content = content.replace(/\\\\\{/g, '\\{');
  content = content.replace(/\\\\\}/g, '\\}');
  fs.writeFileSync(path, content, 'utf8');
  console.log('Fixed', path);
};

fixFile('src/components/WhatsAppBroadcastsManager.jsx');
fixFile('api/whatsapp-broadcast.js');
