const http = require('http');
const fs   = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && k.trim()) process.env[k.trim()] = v.join('=').trim();
  });
}

const handler = require('./api/roadmap');
const PORT    = 3000;

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // API route
  if (url === '/api/roadmap') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      if (body) {
        try { req.body = JSON.parse(body); } catch { req.body = {}; }
      } else {
        req.body = {};
      }

      // Vercel-compatible shim on native Node res
      let statusCode = 200;
      const _end  = res.end.bind(res);
      const _head = res.writeHead.bind(res);
      res.status = (code) => { statusCode = code; return res; };
      res.json   = (data) => {
        _head(statusCode, { 'Content-Type': 'application/json' });
        _end(JSON.stringify(data));
      };
      res.end = (data) => {
        if (!res.headersSent) _head(statusCode);
        _end(data);
      };

      try {
        await handler(req, res);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        _end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Root → serve dashboard
  const filePath = (url === '/' || url === '')
    ? path.join(__dirname, 'ai-builder-dashboard.html')
    : path.join(__dirname, url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Running at http://localhost:${PORT}`);
});
