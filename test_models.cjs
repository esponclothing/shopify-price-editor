const axios = require('axios');

const GROQ_API_KEY = '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';

const MODELS_TO_TEST = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'compound-beta',
  'compound-beta-mini',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'qwen-qwq-32b',
  'deepseek-r1-distill-llama-70b',
];

async function testModel(modelName) {
  const start = Date.now();
  try {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Reply in 1 line only.' },
          { role: 'user', content: 'Hello, what is 2+2?' }
        ],
        temperature: 0.3,
        max_tokens: 50
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    const ms = Date.now() - start;
    const reply = res.data?.choices?.[0]?.message?.content || 'No reply';
    console.log(`✅ ${modelName} — ${ms}ms — "${reply.trim().substring(0, 60)}"`);
    return { model: modelName, status: 'ACTIVE', ms };
  } catch (err) {
    const ms = Date.now() - start;
    const errMsg = err.response?.data?.error?.message || err.message;
    console.log(`❌ ${modelName} — ${ms}ms — ERROR: ${errMsg.substring(0, 80)}`);
    return { model: modelName, status: 'FAILED', ms };
  }
}

async function main() {
  console.log('=== GROQ MODEL AVAILABILITY TEST (Round 2) ===\n');
  const results = [];
  for (const model of MODELS_TO_TEST) {
    const result = await testModel(model);
    results.push(result);
  }
  console.log('\n=== ACTIVE MODELS ===');
  results.filter(r => r.status === 'ACTIVE').forEach((r, i) => console.log(`  ${i + 1}. ${r.model} (${r.ms}ms)`));
}

main();
