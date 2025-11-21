const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Simple server is working!', path: req.url }));
});

const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Simple HTTP server listening on http://localhost:${PORT}`);
  console.log(`Server address:`, server.address());
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});
