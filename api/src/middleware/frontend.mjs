import express from 'express';
import { join } from 'node:path';

// Serves the built Vue app (web/dist) from the same server as the API: one URL, no CORS.
export function frontend(distDir) {
  const router = express.Router();

  // Vite puts a content hash in every file name under /assets, so a browser may keep them for a year:
  // a new build gets new names. index.html is the exception (see below).
  router.use('/assets', express.static(join(distDir, 'assets'), { immutable: true, maxAge: '1y' }));
  router.use(express.static(distDir, { index: false }));

  // Vue Router uses real URLs like /events/1. After a refresh the browser asks the server for that
  // path, which is not a file, so every other GET page gets index.html and Vue shows the right page.
  // /api stays out: an unknown API route must still be a JSON 404.
  router.get(/^(?!\/api(\/|$)).*/, (_req, res) => {
    res.set('Cache-Control', 'no-cache'); // always check for a new deploy
    res.sendFile(join(distDir, 'index.html'));
  });

  return router;
}
