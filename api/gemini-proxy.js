import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { model, apiKey, requestPayload } = req.body;

  if (!model || !apiKey || !requestPayload) {
    return res.status(400).json({ error: 'Missing model, apiKey, or requestPayload' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const geminiRes = await axios.post(url, requestPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return res.status(200).json(geminiRes.data);
  } catch (error) {
    console.error('Gemini Proxy Error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json(error.response?.data || { error: 'Failed to proxy Gemini request' });
  }
}
