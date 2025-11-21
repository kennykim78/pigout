const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Test server OK\n');
});
server.listen(3001, '0.0.0.0', () => {
  console.log('Test server running on 3001');
});
setTimeout(() => {
  console.log('Server still alive after 10s');
}, 10000);
