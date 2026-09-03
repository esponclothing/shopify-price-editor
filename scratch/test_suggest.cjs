const axios = require('axios');

async function callGeminiAPI(messages, apiKey, jsonMode = false, maxTokens = 250) {
    const geminiModels = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash-image'];
    let lastError = null;
    
    let systemInstruction = null;
    const contents = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }
    
    for (const model of geminiModels) {
      try {
        console.log(`[AI Fallback] Testing Gemini model: ${model}`);
        const payload = {
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens }
        };
        if (systemInstruction) payload.systemInstruction = systemInstruction;
        if (jsonMode) payload.generationConfig.responseMimeType = "application/json";

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
        
        if (res.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return res.data.candidates[0].content.parts[0].text;
        }
      } catch (err) {
        console.error(`[AI Fallback] Gemini model ${model} failed:`, err.response?.data?.error?.message || err.message);
        lastError = err;
      }
    }
    throw new Error('All Gemini fallback models failed');
}

async function main() {
  const apiKey = 'AQ.Ab8RN6J-54eZLqYDuD80EuP-nzMFBgC4gFxwFw74oCeCsfiUHA';
  const prompt = `You are a professional customer support assistant for a Shopify brand.
Here is the recent conversation context (latest messages at the bottom):
---
User: Please send me the company HR Contact number
---

Task: Generate exactly 3 highly relevant, concise, and professional reply options for a human agent to send back to the customer next.
Each option MUST be under 15 words and directly address the customer's last question or concern.
DO NOT offer discounts. DO NOT ask for order ID if they already provided it. 
Output ONLY a JSON object containing a "suggestions" array. Example: {"suggestions": ["Hello! Let me check on that.", "Could you provide your order ID?", "Your order is on the way!"]}`;

  try {
    const result = await callGeminiAPI([
      { role: 'user', content: prompt }
    ], apiKey, false, 800);
    console.log("RAW RESULT STR:", JSON.stringify(result));
    
    let suggestions = [];
    try {
      const parsed = JSON.parse(result);
      if (Array.isArray(parsed)) suggestions = parsed;
      else if (parsed.suggestions && Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions;
      else if (parsed.options && Array.isArray(parsed.options)) suggestions = parsed.options;
      else suggestions = Object.values(parsed).flat().filter(x => typeof x === 'string');
    } catch(e) {
       console.log("JSON Parse failed", e);
       const match = result.match(/\[(.*)\]/s);
       if (match) {
         try { suggestions = JSON.parse(`[${match[1]}]`); } catch(e) {}
       }
    }
    console.log("PARSED SUGGESTIONS:", suggestions);
  } catch (err) {
    console.error(err);
  }
}

main();
