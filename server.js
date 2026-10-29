// Signalling server only. It relays WebRTC offers, answers and ICE candidates
// between peers in the same room. No audio or video passes through it.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  const file = req.url === '/' ? 'index.html' : req.url.slice(1);
  const full = path.join(__dirname, 'public', path.normalize(file));
  if (!full.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404).end('Not found');
      return;
    }
    const type = full.endsWith('.js') ? 'text/javascript' : 'text/html';
    res.writeHead(200, { 'Content-Type': type }).end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = new Map(); // roomName -> Set of sockets

wss.on('connection', (socket) => {
  socket.room = null;

  socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'join') {
      socket.room = msg.room;
      if (!rooms.has(msg.room)) rooms.set(msg.room, new Set());
      rooms.get(msg.room).add(socket);
      return;
    }

    // Everything else is relayed to the other peers in the same room.
    const peers = rooms.get(socket.room);
    if (!peers) return;
    for (const peer of peers) {
      if (peer !== socket && peer.readyState === peer.OPEN) {
        peer.send(JSON.stringify(msg));
      }
    }
  });

  socket.on('close', () => {
    const peers = rooms.get(socket.room);
    if (!peers) return;
    peers.delete(socket);
    if (peers.size === 0) rooms.delete(socket.room);
  });
});

server.listen(PORT, () => {
  console.log(`Club Cloud test server on http://localhost:${PORT}`);
});
