const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { handler: aiHandler } = require('./netlify/functions/ai-tips.js');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8'
};

function send(res, status, body, type = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(status, { 'Content-Type': type, ...headers });
  res.end(body);
}

function safeFile(requestPath) {
  const clean = requestPath === '/' ? '/index.html' : requestPath;
  const file = path.resolve(ROOT, `.${clean}`);
  return file.startsWith(ROOT) ? file : null;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (requestUrl.pathname === '/api/ai-tips') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 100000) req.destroy(); });
    req.on('end', async () => {
      const result = await aiHandler({ httpMethod: req.method, headers: req.headers, body });
      send(res, result.statusCode || 200, result.body || '', result.headers?.['Content-Type'] || 'application/json; charset=utf-8', result.headers || {});
    });
    return;
  }
  const file = safeFile(requestUrl.pathname);
  if (!file) return send(res, 400, 'Bad request');
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return send(res, 404, 'Not found');
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const cache = file.endsWith('.html') || file.endsWith('manus-routes.json') ? 'no-store' : 'public, max-age=3600';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`LoanCheck listening on ${PORT}`));
