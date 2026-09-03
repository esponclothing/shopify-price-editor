import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve API routes
app.use('/api', async (req, res) => {
  try {
    // req.path will be relative to /api, e.g. "/shopify/graphql.json"
    const apiPath = req.path.replace(/^\//, ''); // strip leading slash
    let modulePath = '';
    
    // Check vercel.json rewrite rule logic manually
    if (apiPath.startsWith('shopify/')) {
      modulePath = path.join(__dirname, 'api', 'shopify.js');
    } else {
      // Find exact js file
      modulePath = path.join(__dirname, 'api', `${apiPath}.js`);
    }

    if (fs.existsSync(modulePath)) {
      // Dynamic import
      // Using a timestamp query to bust module cache in dev if needed, but in prod it's fine
      const handlerModule = await import(`file://${modulePath}`);
      const handler = handlerModule.default;
      if (typeof handler === 'function') {
        return await handler(req, res);
      }
    }
    
    // If not found or not a function
    res.status(404).json({ error: 'API endpoint not found' });
  } catch (error) {
    console.error(`Error executing ${req.path}:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve static frontend files
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Fallback for SPA routing
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    next();
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
