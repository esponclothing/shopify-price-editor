const fs = require('fs');
let code = fs.readFileSync('api/whatsapp-ai.js', 'utf8');

// Force Gemini API key and remove Groq references for active model
code = code.replace(
  /let activeGroqKey = process\.env\.VITE_GROQ_API_KEY \|\| 'AQ\.Ab8RN6J-54eZLqYDuD80EuP-nzMFBgC4gFxwFw74oCeCsfiUHA';/g,
  "let activeGroqKey = 'AQ.Ab8RN6J-54eZLqYDuD80EuP-nzMFBgC4gFxwFw74oCeCsfiUHA'; // Forced Gemini Key as requested"
);

// Also ignore DB override if it's Groq
code = code.replace(
  /if \(settingsRes\.data\?\.\[0\]\?\.groq_api_key &&/g,
  "if (false &&"
);

// Convert Background Tagging to Gemini
const tagRegex = /axios\.post\(\s*'https:\/\/api\.groq\.com\/openai\/v1\/chat\/completions',\s*\{\s*model: 'llama-3\.1-8b-instant',[\s\S]*?max_tokens: 15\s*\},/g;
const tagReplacement = `callGeminiAPI(
            [
              { role: 'system', content: 'You are a customer segmentation bot. Analyze the customer message and output EXACTLY ONE tag from this list that best describes their intent/status: [VIP, Angry, Bargain Hunter, Needs Big Sizes, Return/Exchange, General Inquiry, Looking to Buy]. Output NOTHING ELSE. Just the tag.' },
              { role: 'user', content: userText }
            ],
            'AQ.Ab8RN6J-54eZLqYDuD80EuP-nzMFBgC4gFxwFw74oCeCsfiUHA', false, 15
          ).then(async tagRes => {
             let tag = tagRes;
             if (tag) {
               tag = tag.replace(/[^a-zA-Z\\s\\/]/g, '').trim(); // sanitize
               await axios.post(
                 \`\${SUPABASE_URL}/rest/v1/whatsapp_chat_settings\`,
                 { phone: senderPhone, tags: [tag], updated_at: new Date().toISOString() },
                 { headers: { 'apikey': SUPABASE_KEY, 'Authorization': \`Bearer \${SUPABASE_KEY}\`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' } }
               );
             }
          }).catch(e => console.error('Tagging failed', e.message));
`;

// wait, the regex might be hard to match perfectly.
// Let's replace the whole tag block.
