const META_TOKEN = 'EAAM99yhroGsBR1rm4kaPOHQRtcuoMjZAdpcz2F4K1AXjYYfvtGLwttdBMO2fdaUI4lzB0fG0iaZAabFdgP9aA4GCXtw0t4zLmwZBg0ShVCJBZBYZBVYnmGkb2f9XZAXcD9evV1hoAcF9DGfSYtTCfTzzcC9iZCmWZBTiyMZC4ZBnmvOVqPfE1ZCJE3Lc3ZBs3egltQZDZD';
const WABA_ID = '2025586748064434';

fetch(`https://graph.facebook.com/v20.0/${WABA_ID}/message_templates`, {
  headers: {
    'Authorization': `Bearer ${META_TOKEN}`
  }
})
.then(res => res.json())
.then(result => {
  console.log(JSON.stringify(result, null, 2));
})
.catch(err => {
  console.error('Error:', err);
});
