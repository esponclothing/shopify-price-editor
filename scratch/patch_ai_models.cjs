const fs = require('fs');
let code = fs.readFileSync('api/whatsapp-ai.js', 'utf8');

// 1. Fix Groq fallback models
code = code.replace(
  /const groqModels = \['qwen\/qwen3\.6-27b', 'allam-2-7b', 'meta-llama\/llama-prompt-guard-2-22m'\];/,
  "const groqModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];"
);

// 2. Add <think> block stripping
const oldContentReturn = "return res.data.choices[0].message.content;";
const newContentReturn = "return res.data.choices[0].message.content.replace(/<think>[\\s\\S]*?<\\/think>/gi, '').trim();";
code = code.replace(oldContentReturn, newContentReturn);

// 3. Increase maxTokens for main completion
code = code.replace(
  /activeGroqKey, false, 300/g,
  "activeGroqKey, false, 600"
);

fs.writeFileSync('api/whatsapp-ai.js', code);
console.log('Fixed AI models and increased max_tokens.');
