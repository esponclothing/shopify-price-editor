import axios from 'axios';

const FALLBACK_MODELS = [
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-pro-latest'
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { model, apiKey, requestPayload } = req.body;

  if (!apiKey || !requestPayload) {
    return res.status(400).json({ error: 'Missing apiKey or requestPayload' });
  }

  // Deduplicate requested model with fallback list
  const modelsToTry = [
    model,
    ...FALLBACK_MODELS.filter(m => m !== model)
  ].filter(Boolean);

  let lastError = null;

  for (const m of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const geminiRes = await axios.post(url, requestPayload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      return res.status(200).json(geminiRes.data);
    } catch (error) {
      console.warn(`Gemini Proxy: Model ${m} failed:`, error.response?.data?.error?.message || error.message);
      lastError = error;
    }
  }

  console.error('Gemini Proxy: All models failed:', lastError?.response?.data || lastError?.message);
  return res.status(lastError?.response?.status || 500).json(lastError?.response?.data || { error: 'Failed to proxy Gemini request' });
}
