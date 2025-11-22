import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Keys and Models (loaded from environment)
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy endpoint for AI chat
app.post('/api/chat', async (req, res) => {
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
        'HTTP-Referer': 'https://sui-mail.app',
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

    res.json(data);
  } catch (error) {
    console.error('❌ Chat proxy error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📝 API Keys loaded: ${API_KEYS.length}`);
  console.log(`🤖 Models available: ${MODELS.length}`);
});
