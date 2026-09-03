const axios = require('axios');

async function testGroqModels(apiKey) {
  try {
    const res = await axios.get('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const models = res.data.data.map(m => m.id);
    console.log("Groq Available Models:", models.join(', '));
    
    // Test the top 3
    const testList = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it', 'llama-guard-3-8b'];
    const activeModels = [];
    
    for (const model of testList) {
       try {
         console.log(`Testing Groq model: ${model}`);
         const testRes = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
           model,
           messages: [{ role: 'user', content: 'Say "hello"' }],
           max_tokens: 10
         }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
         if (testRes.data.choices[0].message.content) {
            console.log(`✅ ${model} works!`);
            activeModels.push(model);
         }
       } catch(e) {
         console.log(`❌ ${model} failed:`, e.response?.data?.error?.message || e.message);
       }
    }
    return activeModels;
  } catch (err) {
    console.log("Groq API key test failed:", err.message);
    return [];
  }
}

async function testGeminiModels(apiKey) {
  try {
    const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const models = res.data.models.map(m => m.name.replace('models/', '')).filter(m => m.includes('gemini'));
    console.log("Gemini Available Models:", models.join(', '));
    
    // Test top models
    const testList = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-2.5-flash', 'gemini-pro', 'gemini-1.5-flash-8b'];
    const activeModels = [];
    
    for (const model of testList) {
       try {
         console.log(`Testing Gemini model: ${model}`);
         const testRes = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
           contents: [{ role: 'user', parts: [{ text: 'Say "hello"' }] }]
         }, { headers: { 'Content-Type': 'application/json' } });
         
         if (testRes.data.candidates && testRes.data.candidates[0]) {
            console.log(`✅ ${model} works!`);
            activeModels.push(model);
         }
       } catch(e) {
         console.log(`❌ ${model} failed:`, e.response?.data?.error?.message || e.message);
       }
    }
    return activeModels;
  } catch (err) {
    console.log("Gemini API key test failed:", err.response?.data?.error?.message || err.message);
    return [];
  }
}

async function main() {
  const groqKey = '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';
  const geminiKey = 'AQ.Ab8RN6J-54eZLqYDuD80EuP-nzMFBgC4gFxwFw74oCeCsfiUHA';
  
  console.log("--- Testing Groq ---");
  const activeGroq = await testGroqModels(groqKey);
  console.log("Final Active Groq:", activeGroq);
  
  console.log("\n--- Testing Gemini ---");
  const activeGemini = await testGeminiModels(geminiKey);
  console.log("Final Active Gemini:", activeGemini);
}

main();
