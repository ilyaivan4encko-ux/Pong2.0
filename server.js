<meta name='viewport' content='width=device-width, initial-scale=1'/>// server.js
// Простая и надёжная сигналинг-служба для WebRTC (WebSocket).
// Умеет: комнаты (по roomId), пересылку offer/answer/ice, уведомления о выходе.
// Запуск: node server.js
// npm: ws

const WebSocket = require('ws');

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`Signal server starting on ws://0.0.0.0:${PORT}`);

const rooms = new Map(); // roomId -> Set of ws

function sendSafe(ws, obj){
  try{ if(ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); } catch(e){ /* ignore */ }
}

wss.on('connection', (ws, req) => {
  ws.room = null;
  ws.id = Math.random().toString(36).slice(2,9);

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch(e){ return; }

    // Join room: { join: "roomId" }
    if(msg.join){
      const roomId = String(msg.join);
      ws.room = roomId;
      if(!rooms.has(roomId)) rooms.set(roomId, new Set());
      rooms.get(roomId).add(ws);

      // send back info: joined, peers count, yourId
      sendSafe(ws, { type:'joined', room: roomId, peers: rooms.get(roomId).size, yourId: ws.id });

      // notify others about newcomer
      for(const peer of rooms.get(roomId)){
        if(peer !== ws) sendSafe(peer, { type:'peer-joined', id: ws.id });
      }
      return;
    }

    // Forwarding signaling messages: must include { to?:id, type:'offer'|'answer'|'ice', sdp/... }
    // If "to" specified -> forward only to that peer; otherwise broadcast to other peers in room.
    if(ws.room){
      const set = rooms.get(ws.room);
      if(!set) return;
      if(msg.to){
        for(const peer of set){
          if(peer.id === msg.to) { sendSafe(peer, Object.assign({}, msg, { from: ws.id })); break; }
        }
      } else {
        for(const peer of set){
          if(peer !== ws) sendSafe(peer, Object.assign({}, msg, { from: ws.id }));
        }
      }
    }
  });

  ws.on('close', () => {
    if(ws.room && rooms.has(ws.room)){
      const set = rooms.get(ws.room);
      set.delete(ws);
      for(const peer of set){ sendSafe(peer, { type:'peer-left', id: ws.id }); }
      if(set.size === 0) rooms.delete(ws.room);
    }
  });

  ws.on('error', () => {
    // ignore
  });
});