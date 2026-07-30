import handler from './api/whatsapp-ai.js';

const mockReq = {
  method: 'POST',
  body: {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: '919306817689',
                  type: 'text',
                  text: {
                    body: 'Shorts pe koi combo h kya bhai?'
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }
};

const mockRes = {
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    console.log(`[HTTP ${this.statusCode}] Response:`, JSON.stringify(data, null, 2));
    return this;
  },
  send(text) {
    console.log(`[HTTP ${this.statusCode}] Send:`, text);
    return this;
  }
};

async function test() {
  console.log('Testing serverless /api/whatsapp-ai with simulated customer message...');
  await handler(mockReq, mockRes);
}

test();
