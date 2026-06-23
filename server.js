"use strict";

/* =========================================================
   Simson Tour – Mehrspieler-Server
   Liefert die statischen Spieldateien aus und verwaltet
   Räume per Zugangscode über WebSockets.
   Start:  npm install && npm start
   ========================================================= */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/* ---------- Statische Dateien ausliefern ---------- */
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
});

/* ---------- WebSocket-Räume ---------- */
const wss = new WebSocketServer({ server });
const rooms = new Map(); // code -> Map(id -> ws)
let nextId = 1;

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne verwechselbare Zeichen
  let c;
  do { c = ""; for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)]; }
  while (rooms.has(c));
  return c;
}
function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function broadcast(code, obj, exceptId) {
  const room = rooms.get(code);
  if (!room) return;
  for (const [id, ws] of room) if (id !== exceptId) send(ws, obj);
}

wss.on("connection", (ws) => {
  ws.id = nextId++;
  ws.code = null;
  ws.profile = {};
  ws.lastState = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === "host" || msg.type === "join") {
      const code = msg.type === "host"
        ? makeCode()
        : String(msg.code || "").toUpperCase().trim();

      if (msg.type === "join" && !rooms.has(code)) {
        send(ws, { type: "error", msg: "Raum nicht gefunden" });
        return;
      }
      if (!rooms.has(code)) rooms.set(code, new Map());

      ws.code = code;
      ws.profile = {
        name: String(msg.name || "Fahrer").slice(0, 16),
        outfit: msg.outfit | 0,
        model: msg.model | 0,
      };

      const room = rooms.get(code);
      const peers = [];
      for (const [id, other] of room) {
        peers.push({ id, profile: other.profile, state: other.lastState });
      }
      room.set(ws.id, ws);

      send(ws, { type: "joined", id: ws.id, code, peers });
      broadcast(code, { type: "peerJoined", id: ws.id, profile: ws.profile }, ws.id);
      console.log(`Spieler ${ws.id} (${ws.profile.name}) -> Raum ${code} (${room.size} Fahrer)`);
    }
    else if (msg.type === "state") {
      if (!ws.code) return;
      ws.lastState = msg.state;
      broadcast(ws.code, { type: "state", id: ws.id, state: msg.state }, ws.id);
    }
  });

  ws.on("close", () => {
    if (ws.code && rooms.has(ws.code)) {
      const room = rooms.get(ws.code);
      room.delete(ws.id);
      broadcast(ws.code, { type: "peerLeft", id: ws.id }, null);
      if (room.size === 0) rooms.delete(ws.code);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Simson Tour läuft auf  http://localhost:${PORT}`);
  console.log("Im selben Netzwerk beitreten: http://<deine-IP>:" + PORT);
});
