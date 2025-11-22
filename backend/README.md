# Backend Proxy Server

This backend server securely handles API keys for AI requests, preventing exposure in the frontend.

## Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Start the server:
```bash
npm run dev
```

The server will run on `http://localhost:3001`

## Endpoints

### Health Check
```
GET /health
```

### AI Chat Proxy
```
POST /api/chat
Body: {
  "messages": [{ "role": "user", "content": "..." }],
  "apiKeyIndex": 0,  // optional, 0-2
  "modelIndex": 0     // optional, 0-2
}
```

## Security

- API keys are stored in `.env` file (never committed to git)
- Frontend only communicates with this backend
- API keys never exposed to browser
