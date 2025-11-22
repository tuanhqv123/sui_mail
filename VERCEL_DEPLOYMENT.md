# Vercel Deployment Guide for Sui Mail

This guide will help you deploy your Sui Mail application to Vercel with secure API key handling.

## 🚀 Deployment Steps

### 1. Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

### 2. Prepare Your Project

Your project is already configured with:
- ✅ `vercel.json` - Vercel configuration
- ✅ `api/chat.ts` - Serverless API endpoint
- ✅ Environment variables setup

### 3. Install Required Dependencies

```bash
npm install --save-dev @vercel/node
```

### 4. Deploy to Vercel

#### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Go to [Vercel Dashboard](https://vercel.com/new)**

3. **Import your GitHub repository**

4. **Configure Environment Variables:**
   
   In Project Settings → Environment Variables, add:
   
   ```
   VITE_AI_API_KEY_1=sk-or-v1-your-first-key-here
   VITE_AI_API_KEY_2=sk-or-v1-your-second-key-here
   VITE_AI_API_KEY_3=sk-or-v1-your-third-key-here
   VITE_AI_MODEL_1=google/gemma-3-27b-it:free
   VITE_AI_MODEL_2=x-ai/grok-4.1-fast:free
   VITE_AI_MODEL_3=z-ai/glm-4.5-air:free
   ```

5. **Deploy!** Vercel will automatically build and deploy your app.

#### Option B: Deploy via CLI

```bash
# Login to Vercel
vercel login

# Deploy
vercel

# Set environment variables (one by one)
vercel env add VITE_AI_API_KEY_1
vercel env add VITE_AI_API_KEY_2
vercel env add VITE_AI_API_KEY_3
vercel env add VITE_AI_MODEL_1
vercel env add VITE_AI_MODEL_2
vercel env add VITE_AI_MODEL_3

# Deploy to production
vercel --prod
```

## 🔒 How It Works

### Architecture

```
Browser → Vercel Frontend (React) → Vercel Serverless Function (/api/chat) → OpenRouter AI API
          (No API Keys)                (Has API Keys - Secure!)
```

### API Routes

Your app will have:
- **Frontend**: `https://your-app.vercel.app`
- **API Endpoint**: `https://your-app.vercel.app/api/chat`

The frontend automatically uses `/api/chat` because of this line in `.env`:
```env
VITE_BACKEND_API_URL=/api
```

## 📁 Project Structure for Vercel

```
sui_mail/
├── api/                    # Serverless functions
│   └── chat.ts            # AI proxy endpoint (secure)
├── dist/                  # Built frontend (auto-generated)
├── src/                   # React source code
├── vercel.json           # Vercel configuration
├── package.json          # Dependencies
└── .env                  # Local environment variables (NOT deployed)
```

## ✅ Verification

After deployment:

1. **Check your site**: `https://your-app.vercel.app`
2. **Test AI chat**: Open the chat bubble and send a message
3. **Verify security**: Open browser DevTools → Network tab
   - You should see requests to `/api/chat`
   - API keys should NOT be visible in request headers
   - Only your Vercel function sees the API keys! 🔒

## 🔧 Environment Variables in Vercel

### During Build (VITE_ prefix):
- These are embedded in your JavaScript bundle
- Used for: Frontend configuration, public URLs
- ⚠️ Visible in browser

### During Runtime (No prefix):
- Only available in serverless functions
- Used for: API keys, secrets
- ✅ Hidden from browser

### Our Setup:
We use `VITE_` prefix because:
1. Frontend needs to know the API endpoint (`VITE_BACKEND_API_URL=/api`)
2. Serverless function reads the same variables server-side
3. API keys are only used server-side in `/api/chat.ts`

## 🚨 Security Notes

### ✅ SECURE (Production with Vercel):
```
Frontend → /api/chat → OpenRouter AI
           (API keys safe on server)
```

### ❌ INSECURE (Old direct API calls):
```
Frontend → OpenRouter AI
         (API keys visible in browser)
```

## 🔄 Updates

To update your deployment:

```bash
git add .
git commit -m "Update app"
git push origin main
```

Vercel will automatically rebuild and redeploy!

## 📊 Monitoring

- **Deployment logs**: Vercel Dashboard → Deployments
- **Function logs**: Vercel Dashboard → Functions → Logs
- **Analytics**: Vercel Dashboard → Analytics

## 🆘 Troubleshooting

### Build Fails
```bash
# Test build locally first
npm run build
```

### API not working
1. Check environment variables are set in Vercel
2. Check function logs in Vercel Dashboard
3. Test endpoint: `curl https://your-app.vercel.app/api/chat`

### Environment variables not updating
1. Redeploy after changing env vars
2. Or use `vercel env pull` to sync locally

## 🎯 Next Steps

1. **Custom Domain**: Add your own domain in Vercel settings
2. **Analytics**: Enable Vercel Analytics for usage stats
3. **Monitoring**: Set up alerts for function errors
4. **CI/CD**: Configure automatic deployments from GitHub

---

**Your app is now production-ready with secure API key handling!** 🎉
