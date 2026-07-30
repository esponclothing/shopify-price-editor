const META_TOKEN = 'EAAM99yhroGsBR1rm4kaPOHQRtcuoMjZAdpcz2F4K1AXjYYfvtGLwttdBMO2fdaUI4lzB0fG0iaZAabFdgP9aA4GCXtw0t4zLmwZBg0ShVCJBZBYZBVYnmGkb2f9XZAXcD9evV1hoAcF9DGfSYtTCfTzzcC9iZCmWZBTiyMZC4ZBnmvOVqPfE1ZCJE3Lc3ZBs3egltQZDZD';
const PHONE_NUMBER_ID = '1189183190949431';
const formattedPhone = '919306817689'; // User's test number
const otp = Math.floor(1000 + Math.random() * 9000).toString();

const payload = {
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to: formattedPhone,
  type: 'template',
  template: {
    name: 'eleven_fit_otp',
    language: { code: 'en' },
    components: [
      {
        type: 'body',
        parameters: [ { type: 'text', text: otp } ]
      },
      {
        type: 'button',
        sub_type: 'url',
        index: 0,
        parameters: [ { type: 'text', text: otp } ]
      }
    ]
  }
};

fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${META_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})
.then(res => res.json())
.then(result => {
  console.log('Result:', result);
})
.catch(err => {
  console.error('Error:', err);
});
