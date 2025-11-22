# Sui Mail - Decentralized Email on Sui Blockchain

A secure, decentralized email application built on the Sui blockchain with end-to-end encryption.

## 🚀 Features

- **Blockchain-based**: Built on Sui blockchain for transparency and security
- **End-to-End Encryption**: Uses Seal encryption for private communications
- **Decentralized Storage**: Files stored on Walrus network
- **AI Assistant**: Integrated AI chat for composing and managing emails
- **SuiNS Integration**: Send emails using .sui domain names

## 📦 Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenRouter API keys:

```env
VITE_AI_API_KEY_1=your-api-key-here
VITE_AI_API_KEY_2=your-api-key-here
VITE_AI_API_KEY_3=your-api-key-here
```

⚠️ **SECURITY WARNING**: API keys in `.env` are **VISIBLE IN THE BROWSER**!

For production, use the backend proxy (see below).

### 3. Run Development Server

```bash
npm run dev
```

## 🔒 Security: Backend Proxy (Recommended for Production)

To hide API keys from the browser, use the backend proxy server:

### Setup Backend

```bash
cd backend
npm install
npm run dev
```

The backend will run on `http://localhost:3001`

### Enable Backend in Frontend

Uncomment this line in `.env`:

```env
VITE_BACKEND_API_URL=http://localhost:3001
```

Now all AI requests will go through your backend, keeping API keys secure! 🔐

## 🌐 Deploy to Vercel (Production)

For production deployment with secure serverless API:

```bash
# Install dependencies
npm install

# Deploy to Vercel
vercel
```

Or use the Vercel Dashboard to import your GitHub repository.

**📖 See [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) for detailed deployment instructions.**

Your app will use Vercel Serverless Functions at `/api/chat` to securely proxy AI requests, keeping your API keys hidden from the browser! 🚀

---

## Technical Details (React + TypeScript + Vite)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
