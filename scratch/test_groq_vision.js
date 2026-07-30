

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const apiKey = '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';

async function test() {
  const imageUrl = 'https://cdn.shopify.com/s/files/1/0887/7041/2839/files/4_64551e73-b3c4-42b7-a3e9-74d32a4bfad4.jpg?v=1733658514';
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 80,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
              {
                type: 'text',
                text: 'Write a concise, SEO-rich alt tag for this product image. Describe the clothing item, color, style, and any key visual details in 10-15 words. Output only the alt tag text.',
              },
            ],
          },
        ],
      }),
    });

    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
