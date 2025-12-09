// server.js — WebSocket signalling server for WebRTC Pong
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: process.env.PORT || 10000 });

let rooms = {}; // room => [sockets]

wss.on("connection", ws => {
    ws.on("message", msg => {
        const data = JSON.parse(msg);

        // Join room
        if (data.join) {
            const room = data.join;
            if (!rooms[room]) rooms[room] = [];
            rooms[room].push(ws);
            ws.room = room;

            ws.send(JSON.stringify({ type: "joined", peers: rooms[room].length }));

            return;
        }

        // Send signals to other peers in room
        if (ws.room) {
            rooms[ws.room].forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    });

    ws.on("close", () => {
        if (ws.room && rooms[ws.room]) {
            rooms[ws.room] = rooms[ws.room].filter(c => c !== ws);
        }
    });
});

console.log("Signaling server started");
