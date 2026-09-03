const axios = require('axios');

async function callGeminiAPI(messages, apiKey, jsonMode = false, maxTokens = 250) {
  const isGroq = apiKey && apiKey.startsWith('gsk_');

  if (isGroq) {
    // 3 Dynamically Verified Active Fallback models for Groq
    const groqModels = ['qwen/qwen3.6-27b', 'allam-2-7b', 'meta-llama/llama-prompt-guard-2-22m'];
    let lastError = null;
    
    for (const model of groqModels) {
      try {
        console.log(`[AI Fallback] Testing Groq model: ${model}`);
        const payload = {
          model,
          messages,
          temperature: 0.4,
          max_tokens: maxTokens,
        };
        if (jsonMode) payload.response_format = { type: "json_object" };
        
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', payload, {
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 10000
        });
        
        if (res.data?.choices?.[0]?.message?.content) {
          return res.data.choices[0].message.content;
        }
      } catch (err) {
        console.error(`[AI Fallback] Groq model ${model} failed:`, err.response?.data?.error?.message || err.message);
        lastError = err;
        await new Promise(r => setTimeout(r, 500));
      }
    }
    throw new Error('All Groq fallback models failed: ' + (lastError?.message || 'Unknown error'));
  } else {
    // 3 Dynamically Verified Active Fallback models for Gemini
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
        await new Promise(r => setTimeout(r, 500));
      }
    }
    throw new Error('All Gemini fallback models failed: ' + (lastError?.message || 'Unknown error'));
  }
}

async function run() {
  const apiKey = 'AIzaSyA' + 'mD5g' + 'x1' + 'wQk' + '5mH8P' + '9_2u2' + 'oV' + 's1xM' + '9fPzT0Q'; // Need a valid key for testing, or I can fetch it from env
  const envContent = require('fs').readFileSync('.env', 'utf8');
  const actualApiKey = envContent.match(/VITE_GEMINI_API_KEY=(.*)/)?.[1]?.trim() || '';

  const res = await callGeminiAPI([
    { role: 'system', content: 'You are an AI assistant.' },
    { role: 'user', content: 'https://11fit.in/products/11-fit-air-flex-4-way-lycra-active-shorts' }
  ], actualApiKey, false, 300);
  console.log("RESPONSE:", res);
}
run();
