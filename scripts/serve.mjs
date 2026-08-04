/**
 * Static server for working on the report without a ClickUp token.
 *
 *   node scripts/serve.mjs
 *
 * Node's own http and fs, no dependencies and no install step, because the
 * whole point of this file is to be reachable from a cold clone.
 *
 * Use `vercel dev` instead when the change touches api/time.js. This serves
 * static files only: /api/time returns 501 rather than pretending, so a
 * forgotten ?api= parameter fails loudly instead of looking like a broken API.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png'
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = decodeURIComponent(url.pathname);

  if (path === '/api/time') {
    res.writeHead(501, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      error: 'This is the static dev server, which has no ClickUp token.',
      hint: 'Point the report at a fixture with ?api=./fixtures/2026-typical.json, or run `vercel dev` for the real API.'
    }));
    return;
  }

  if (path === '/') path = '/index.html';
  // Contain every request inside the repo, so a ../ in the path cannot walk out.
  const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(file);
    if (info.isDirectory()) throw new Error('directory');
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      // The report cache-busts its own fetches; this keeps edits to the HTML
      // itself from being served stale on reload.
      'cache-control': 'no-store'
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found: ' + path);
  }
});

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}/index.html`;
  console.log(`Serving ${ROOT} on http://localhost:${PORT}\n`);
  console.log('Open one of these. Neither needs a token.\n');
  console.log(`  typical   ${base}?api=./fixtures/2026-typical.json&year=2026`);
  console.log(`  edge      ${base}?api=./fixtures/2026-edge.json&year=2026\n`);
  console.log('Chart.js and the brand tokens still load from their CDNs, so an');
  console.log('offline machine renders an unstyled page with no chart.');
});
