import type { VercelRequest, VercelResponse } from '@vercel/node';

// API Keys from environment variables
const API_KEYS = [
  process.env.VITE_AI_API_KEY_1,
  process.env.VITE_AI_API_KEY_2,
  process.env.VITE_AI_API_KEY_3,
].filter(Boolean);

const MODELS = [
  process.env.VITE_AI_MODEL_1,
  process.env.VITE_AI_MODEL_2,
  process.env.VITE_AI_MODEL_3,
].filter(Boolean);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, apiKeyIndex = 0, modelIndex = 0 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const apiKey = API_KEYS[apiKeyIndex % API_KEYS.length];
    const model = MODELS[modelIndex % MODELS.length];

    if (!apiKey || !model) {
      return res.status(500).json({ error: 'API configuration error' });
    }

    console.log(`🤖 Making AI request with model: ${model}`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://sui-mail.vercel.app',
        'X-Title': 'Sui Mail',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AI API Error:', errorText);
      return res.status(response.status).json({
        error: 'AI API request failed',
        details: errorText,
      });
    }

    const data = await response.json();
    console.log('✅ AI request successful');

    return res.status(200).json(data);
  } catch (error) {
    console.error('❌ Chat proxy error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
