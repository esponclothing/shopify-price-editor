require('dotenv').config();
const handler = require('./api/whatsapp-inbox.js').default;

async function test() {
  const req = {
    method: 'GET',
    query: { action: 'chats' },
    headers: {}
  };
  const res = {
    setHeader: () => {},
    status: (code) => ({
      json: (data) => console.log('STATUS:', code, data),
      end: () => console.log('STATUS:', code)
    })
  };
  
  try {
     // Wait, the API file uses ES modules export. Let's see if we can import it.
     // In vite/next.js, usually `api` folder files are compiled.
  } catch (e) {
     console.error(e);
  }
}
test();
