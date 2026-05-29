/**
 * Production entry point.
 * Mounts the Express API routes and serves the built frontend from /dist.
 * Used by the Dockerfile (node server/prod.js).
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');

// Serve the built Vite frontend
import serveStatic from 'serve-static';
app.use(serveStatic(DIST));

// SPA fallback — any non-API route serves index.html
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`UGC Flow running on port ${PORT}`);
});
