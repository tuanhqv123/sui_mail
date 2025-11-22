# Quick Fix: Add Environment Variables to Vercel

## Option 1: Via Vercel Dashboard (EASIEST) ✅

1. Go to: https://vercel.com/tuanhqv123s-projects/sui-mail/settings/environment-variables

2. Add these environment variables one by one:

   **Variable Name**: `VITE_AI_API_KEY_1`  
   **Value**: `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`  
   **Environments**: ✓ Production ✓ Preview ✓ Development

   **Variable Name**: `VITE_AI_API_KEY_2`  
   **Value**: `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`  
   **Environments**: ✓ Production ✓ Preview ✓ Development

   **Variable Name**: `VITE_AI_API_KEY_3`  
   **Value**: `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`  
   **Environments**: ✓ Production ✓ Preview ✓ Development

   **Variable Name**: `VITE_AI_MODEL_1`  
   **Value**: `google/gemma-3-27b-it:free`  
   **Environments**: ✓ Production ✓ Preview ✓ Development

   **Variable Name**: `VITE_AI_MODEL_2`  
   **Value**: `x-ai/grok-4.1-fast:free`  
   **Environments**: ✓ Production ✓ Preview ✓ Development

   **Variable Name**: `VITE_AI_MODEL_3`  
   **Value**: `z-ai/glm-4.5-air:free`  
   **Environments**: ✓ Production ✓ Preview ✓ Development

3. After adding all variables, run:
   ```bash
   vercel --prod
   ```

## Option 2: Via CLI (Alternative)

Run these commands in your terminal:

```bash
# Set each environment variable
vercel env add VITE_AI_API_KEY_1
# When prompted, paste: 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
# Select: Production, Preview, Development (all 3)

vercel env add VITE_AI_API_KEY_2
# When prompted, paste: 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

vercel env add VITE_AI_API_KEY_3
# When prompted, paste: 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

vercel env add VITE_AI_MODEL_1
# When prompted, paste: google/gemma-3-27b-it:free

vercel env add VITE_AI_MODEL_2
# When prompted, paste: x-ai/grok-4.1-fast:free

vercel env add VITE_AI_MODEL_3
# When prompted, paste: z-ai/glm-4.5-air:free

# Then deploy
vercel --prod
```

## ✅ Verify

After deployment:
1. Visit your app: `https://sui-mail.vercel.app` (or your custom domain)
2. Open AI chat bubble
3. Send a message
4. It should work with secure API keys! 🎉

---

**Choose Option 1 (Dashboard) - it's faster and easier!**
