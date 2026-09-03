import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Live Vercel deployment — all /api/ serverless calls are proxied here
  const vercelUrl = 'https://shopify-price-editor.vercel.app';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // Proxy all /api/ calls to live Vercel deployment
        '/api': {
          target: vercelUrl,
          changeOrigin: true,
          secure: true,
        }
      }
    }
  }
})
