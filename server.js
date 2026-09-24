import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { startAbandonedCartWorker } from './api/abandoned-cart-worker.js';
import { startOrderLifecycleWorker } from './api/order-lifecycle-worker.js';
import { closePools } from './api/dbPools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Cache for loaded API handler functions to prevent repeated dynamic imports & file reads
const handlerCache = new Map();

// Serve API routes with handler caching
app.use('/api', async (req, res) => {
  try {
    const apiPath = req.path.replace(/^\//, ''); // strip leading slash
    let moduleKey = apiPath;
    let modulePath = '';
    
    if (apiPath.startsWith('shopify/')) {
      moduleKey = 'shopify';
      modulePath = path.join(__dirname, 'api', 'shopify.js');
    } else {
      modulePath = path.join(__dirname, 'api', `${apiPath}.js`);
    }

    let handler = handlerCache.get(moduleKey);

    if (!handler) {
      if (fs.existsSync(modulePath)) {
        const handlerModule = await import(`file://${modulePath}`);
        handler = handlerModule.default;
        if (typeof handler === 'function') {
          handlerCache.set(moduleKey, handler);
        }
      }
    }

    if (typeof handler === 'function') {
      req.url = req.originalUrl;
      return await handler(req, res);
    }
    
    res.status(404).json({ error: 'API endpoint not found' });
  } catch (error) {
    console.error(`Error executing ${req.path}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static frontend files with 1-day cache to reduce Node CPU/bandwidth usage
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath, { maxAge: '1d', etag: true }));

// Fallback for SPA routing
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    next();
  }
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  try {
    startAbandonedCartWorker();
  } catch (workerErr) {
    console.error('Failed to start Abandoned Cart Worker:', workerErr);
  }
  try {
    startOrderLifecycleWorker();
  } catch (workerErr) {
    console.error('Failed to start Order Lifecycle Worker:', workerErr);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing server and pools...');
  server.close(async () => {
    await closePools();
    process.exit(0);
  });
});
