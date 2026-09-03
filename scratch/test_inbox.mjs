import handler from '../api/whatsapp-inbox.js';

const req = {
  method: 'GET',
  query: { action: 'chats' },
  headers: {}
};

const res = {
  setHeader: () => {},
  status: (code) => ({
    end: () => console.log('Status', code),
    json: (data) => console.log('Status', code, 'JSON:', data)
  }),
  end: () => console.log('End')
};

handler(req, res).catch(console.error);
