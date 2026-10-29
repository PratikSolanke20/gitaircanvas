/**
 * Air Canvas v2.4 - Universal Edge & Local HTTP Server
 * Developer: Pratik Solanke
 * 
 * Works seamlessly across:
 * 1. Vercel Serverless Function (@vercel/node entrypoint)
 * 2. Local Node.js development server (npm start)
 * 3. Static fallback routing with process.cwd() resolution
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

/**
 * Universal Request Handler for Vercel & Node http.Server
 */
function handler(req, res) {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse path without query strings
  let rawUrl = (req.url || '/').split('?')[0];
  if (rawUrl === '/' || rawUrl === '') {
    rawUrl = '/index.html';
  }

  const cleanPath = path.normalize(rawUrl).replace(/^(\.\.[\/\\])+/, '').replace(/^[\\\/]+/, '');

  // Search candidate root directories
  const candidateDirectories = [
    process.cwd(),
    __dirname,
    path.join(process.cwd(), 'public'),
    path.join(__dirname, 'public')
  ];

  let resolvedPath = null;

  // 1. Check exact requested path
  for (const dir of candidateDirectories) {
    const candidate = path.join(dir, cleanPath);
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        resolvedPath = candidate;
        break;
      }
    } catch (_) {}
  }

  // 2. If not found and no extension or HTML route, fallback to index.html (SPA routing)
  if (!resolvedPath) {
    for (const dir of candidateDirectories) {
      const candidate = path.join(dir, 'index.html');
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          resolvedPath = candidate;
          break;
        }
      } catch (_) {}
    }
  }

  // 3. Serve the resolved file
  if (resolvedPath) {
    const ext = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
      const data = fs.readFileSync(resolvedPath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': data.length,
        'Cache-Control': ext === '.html' ? 'public, max-age=0, must-revalidate' : 'public, max-age=86400'
      });
      res.end(data);
      return;
    } catch (readErr) {
      console.error('Error reading file:', resolvedPath, readErr);
    }
  }

  // 4. Ultimate graceful fallback
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
  res.end('Air Canvas: Asset Not Found');
}

// Export handler for Vercel Node.js Serverless runtime
module.exports = handler;
module.exports.default = handler;

// If executed directly (e.g. `npm start` or `node server.js`), start HTTP server
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const server = http.createServer(handler);
  server.listen(PORT, () => {
    console.log('=======================================================');
    console.log('⚡ AIR CANVAS v2.4 // Dev: Pratik Solanke');
    console.log(`📡 Local Server running at: http://localhost:${PORT}`);
    console.log('📷 Open in Chrome / Edge with webcam permissions enabled');
    console.log('=======================================================');
  });
}
