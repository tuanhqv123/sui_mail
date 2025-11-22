// AI API Configuration
export const AI_CONFIG = {
  // API Keys (will be visible in browser - use backend proxy for production!)
  API_KEYS: [
    import.meta.env.VITE_AI_API_KEY_1,
    import.meta.env.VITE_AI_API_KEY_2,
    import.meta.env.VITE_AI_API_KEY_3,
  ].filter(Boolean),

  // Available Models
  MODELS: [
    import.meta.env.VITE_AI_MODEL_1,
    import.meta.env.VITE_AI_MODEL_2,
    import.meta.env.VITE_AI_MODEL_3,
  ].filter(Boolean),

  // Backend API URL (use this for secure proxy)
  BACKEND_URL: import.meta.env.VITE_BACKEND_API_URL || null,

  // OpenRouter API endpoint
  OPENROUTER_URL: 'https://openrouter.ai/api/v1/chat/completions',
};

/**
 * Make an AI chat request
 * Automatically uses backend proxy if configured, otherwise direct API call
 */
export async function makeAIChatRequest(
  messages: Array<{ role: string; content: string }>,
  apiKeyIndex = 0,
  modelIndex = 0
) {
  // Use backend proxy if available (RECOMMENDED FOR SECURITY)
  if (AI_CONFIG.BACKEND_URL !== null) {
    // If BACKEND_URL is empty string, use /api (Vercel default)
    // If it's a full URL like http://localhost:3001, use that
    const endpoint = AI_CONFIG.BACKEND_URL 
      ? `${AI_CONFIG.BACKEND_URL}/api/chat`  // Full URL for local dev
      : '/api/chat';  // Relative path for Vercel
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        apiKeyIndex,
        modelIndex,
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status}`);
    }

    return response.json();
  }

  // Direct API call (API KEY VISIBLE IN BROWSER - NOT SECURE!)
  const apiKey = AI_CONFIG.API_KEYS[apiKeyIndex];
  const model = AI_CONFIG.MODELS[modelIndex];

  if (!apiKey || !model) {
    throw new Error('API configuration missing');
  }

  const response = await fetch(AI_CONFIG.OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
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
    throw new Error(`AI API request failed: ${response.status}`);
  }

  return response.json();
}
