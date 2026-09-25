/**
 * Gemini Vision client – generates SEO-rich alt tags.
 */

// Simple in-memory cache: imageUrl → generated alt text
const altCache = new Map();

/**
 * Generate a SEO-rich alt tag for an image URL.
 * Falls back to `fallback` if the API key is missing or the call fails.
 *
 * @param {string} imageUrl  - Public URL of the image
 * @param {string} fallback  - Fallback string to use on failure
 * @returns {Promise<string>}
 */
export async function generateAltTag(imageUrl, fallback = '') {
  if (!imageUrl) return fallback;

  // Return cached result instantly
  if (altCache.has(imageUrl)) return altCache.get(imageUrl);

  const savedSettings = JSON.parse(localStorage.getItem('recoverySettings') || '{}');
  const apiKey = savedSettings.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith('.')) return fallback;

  try {
    const requestPayload = {
      contents: [{
        role: 'user',
        parts: [{
          text: 'Write a concise, SEO-rich alt tag for this product image. Describe the clothing item, color, style, and key visual details in 10-15 words. Do NOT include phrases like "image of" or "photo of". Output only the plain alt tag text, nothing else.'
        }]
      }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 60 }
    };

    const response = await fetch('/api/gemini-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: savedSettings.geminiModel || 'gemini-flash-latest',
        apiKey,
        requestPayload
      })
    });

    if (!response.ok) {
      console.warn('[GeminiAlt] API error', response.status);
      return fallback;
    }

    const data = await response.json();
    const alt = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').filter(Boolean).join('').trim() || fallback;
    altCache.set(imageUrl, alt);
    return alt;
  } catch (err) {
    console.warn('[GeminiAlt] fetch failed', err);
    return fallback;
  }
}
