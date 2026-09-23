const http = require('http');
const fs = require('fs');
const path = require('path');

const files = {
  '/': ['scripts/browser-kdf-benchmark.html', 'text/html; charset=utf-8'],
  '/scripts/browser-kdf-benchmark.html': ['scripts/browser-kdf-benchmark.html', 'text/html; charset=utf-8'],
  '/dist/kdf-benchmark-worker.js': ['dist/kdf-benchmark-worker.js', 'text/javascript; charset=utf-8']
};
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const item = files[new URL(req.url, 'http://localhost').pathname];
  if (!item) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(root, item[0]), (error, body) => {
    if (error) { res.writeHead(503); res.end('Prima esegui npm run benchmark:browser'); return; }
    res.writeHead(200, { 'Content-Type': item[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  });
});
server.listen(8089, '127.0.0.1', () => console.log('Benchmark disponibile su http://127.0.0.1:8089/'));
