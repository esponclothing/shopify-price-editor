const axios = require('axios');

async function testGroqModels(apiKey) {
  try {
    const res = await axios.get('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    let models = res.data.data.map(m => m.id);
    console.log("Testing dynamically from Groq Available Models...");
    
    const activeModels = [];
    for (const model of models) {
       if (activeModels.length >= 3) break;
       try {
         const testRes = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
           model,
           messages: [{ role: 'user', content: 'Say "hello"' }],
           max_tokens: 10
         }, { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
         if (testRes.data.choices && testRes.data.choices[0].message.content) {
            console.log(`✅ ${model} works!`);
            activeModels.push(model);
         }
       } catch(e) {
         // console.log(`❌ ${model} failed`);
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
    // Prioritize flash models and then others
    let models = res.data.models.map(m => m.name.replace('models/', '')).filter(m => m.includes('gemini'));
    // Sort so flash is tested first
    models.sort((a, b) => {
       if (a.includes('flash') && !b.includes('flash')) return -1;
       if (!a.includes('flash') && b.includes('flash')) return 1;
       return 0;
    });
    
    console.log("Testing dynamically from Gemini Available Models...");
    const activeModels = [];
    
    for (const model of models) {
       if (activeModels.length >= 3) break;
       try {
         const testRes = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
           contents: [{ role: 'user', parts: [{ text: 'Say "hello"' }] }]
         }, { headers: { 'Content-Type': 'application/json' } });
         
         if (testRes.data.candidates && testRes.data.candidates[0]) {
            console.log(`✅ ${model} works!`);
            activeModels.push(model);
         }
       } catch(e) {
         // console.log(`❌ ${model} failed`);
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
