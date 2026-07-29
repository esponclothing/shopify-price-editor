import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
const apiPlugin = () => ({
  name: 'api-serverless-plugin',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url.startsWith('/api/11fit-analytics')) {
        try {
          const handler = (await import('./api/11fit-analytics.js?t=' + Date.now())).default;
          return handler(req, res);
        } catch (e) {
          console.error('API plugin error:', e);
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: e.message }));
        }
      }
      next();
    });
  }
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  // Clean up store URL if user included https://
  let storeUrl = env.VITE_SHOPIFY_STORE_URL || '';
  if (storeUrl.startsWith('https://')) {
    storeUrl = storeUrl.replace('https://', '');
  }

  const targetUrl = storeUrl ? `https://${storeUrl}` : 'https://example.myshopify.com';

  return {
    plugins: [react(), apiPlugin()],
    server: {
      port: 5173,
      proxy: {
        '/api/shopify': {
          target: targetUrl,
          changeOrigin: true,
          router: (req) => {
            const clientStore = req.headers['x-client-store-url'];
            if (clientStore) {
              return `https://${clientStore}`;
            }
            return targetUrl;
          },
          rewrite: (path) => path.replace(/^\/api\/shopify/, '/admin/api/2024-04'),
          configure: (proxy, options) => {
             proxy.on('proxyReq', (proxyReq, req, res) => {
                const clientToken = req.headers['x-client-access-token'];
                if (clientToken) {
                  proxyReq.setHeader('X-Shopify-Access-Token', clientToken);
                } else if (env.VITE_SHOPIFY_ACCESS_TOKEN) {
                  proxyReq.setHeader('X-Shopify-Access-Token', env.VITE_SHOPIFY_ACCESS_TOKEN);
                }
             });
          }
        }
      }
    }
  }
})
