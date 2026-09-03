import axios from './axiosWrapper.js';
import https from 'https';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-client-store-url, x-client-access-token'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const clientStore = req.headers['x-client-store-url'] || process.env.VITE_SHOPIFY_STORE_URL || '';
  const clientToken = req.headers['x-client-access-token'] || process.env.VITE_SHOPIFY_ACCESS_TOKEN || '';

  if (!clientStore || !clientToken) {
    return res.status(400).json({ error: 'Missing Shopify credentials' });
  }

  let cleanStore = clientStore.trim();
  if (cleanStore.startsWith('https://')) cleanStore = cleanStore.replace('https://', '');
  if (cleanStore.startsWith('http://')) cleanStore = cleanStore.replace('http://', '');

  const path = req.url.replace(/^\/api\/shopify/, '');
  const shopifyUrl = `https://${cleanStore}/admin/api/2024-04${path}`;

  try {
    const response = await axios({
      method: req.method,
      url: shopifyUrl,
      headers: {
        'X-Shopify-Access-Token': clientToken.trim(),
        'Content-Type': 'application/json',
        'User-Agent': 'ShopifyPriceEditor/1.0',
        'Accept-Encoding': 'gzip,deflate,compress'
      },
      data: req.body,
      httpsAgent: new https.Agent({ family: 4, keepAlive: true })
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Shopify API Proxy Error:", error.message, error.response?.data);
    const status = error.response?.status || 500;
    const data = error.response?.data || { message: error.message };
    res.status(status).json(data);
  }
}
