"use strict";

/* =========================================================
   Simson Tour – ein kleines Top-Down-Fahrspiel
   Steuere eine Simson S51 über Landstraßen durch Dörfer.
   ========================================================= */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);
resize();

/* ---------------------------------------------------------
   Welt: Dörfer (Knoten) und Straßen (Kanten dazwischen)
   --------------------------------------------------------- */
const ROAD_W = 64; // halbe Straßenbreite für Asphalt-Erkennung -> Strecke

const villages = [
  { name: "Kleinmühle",  x:  600, y:  600 },
  { name: "Eichdorf",    x: 2200, y:  900 },
  { name: "Hohenwalde",  x: 3600, y: 1700 },
  { name: "Lindenbach",  x: 1300, y: 2400 },
  { name: "Talheim",     x: 3000, y: 3200 },
  { name: "Birkenau",    x: 4400, y: 2900 },
];

// Straßennetz: Indizes in villages, die verbunden sind
const roads = [
  [0, 1], [1, 2], [0, 3], [3, 4], [4, 5], [2, 5], [1, 4],
];

const WORLD = { w: 5200, h: 3900 };

/* Bäume und Häuser prozedural, aber deterministisch erzeugen */
let seed = 1337;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

const trees = [];
for (let i = 0; i < 380; i++) {
  const x = rnd() * WORLD.w;
  const y = rnd() * WORLD.h;
  if (distToNearestRoad(x, y) > ROAD_W + 30) {
    trees.push({ x, y, r: 14 + rnd() * 12 });
  }
}

// Häuser rund um jedes Dorf platzieren
const houses = [];
const palette = ["#c98a5a", "#b56b4b", "#d9b36b", "#9aa7b0", "#cf6f6f", "#7fa86b"];
for (const v of villages) {
  const n = 7 + Math.floor(rnd() * 6);
  for (let i = 0; i < n; i++) {
    const ang = rnd() * Math.PI * 2;
    const dist = 90 + rnd() * 220;
    const hx = v.x + Math.cos(ang) * dist;
    const hy = v.y + Math.sin(ang) * dist;
    if (distToNearestRoad(hx, hy) < ROAD_W + 18) continue; // nicht auf der Straße
    houses.push({
      x: hx, y: hy,
      w: 46 + rnd() * 34,
      h: 40 + rnd() * 30,
      rot: rnd() * Math.PI * 2,
      color: palette[Math.floor(rnd() * palette.length)],
    });
  }
}

/* ---------------------------------------------------------
   Geometrie-Helfer
   --------------------------------------------------------- */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function distToNearestRoad(x, y) {
  let min = Infinity;
  for (const [a, b] of roads) {
    const d = distToSegment(x, y, villages[a].x, villages[a].y, villages[b].x, villages[b].y);
    if (d < min) min = d;
  }
  return min;
}

/* ---------------------------------------------------------
   Spieler: die Simson
   --------------------------------------------------------- */
const bike = {
  x: villages[0].x,
  y: villages[0].y + 40,
  angle: -Math.PI / 2, // Blick nach oben
  speed: 0,            // px/s (Spielwelt); positiv = vorwärts
};

const MAX_SPEED = 320;      // entspricht ~60 km/h Anzeige
const REVERSE_SPEED = -90;
const ACCEL = 220;
const BRAKE = 380;
const DRAG_ROAD = 0.7;
const DRAG_GRASS = 2.4;
const GRASS_MAX = 130;      // off-road gedrosselt
const TURN_RATE = 2.6;      // rad/s bei voller Lenkung

let distanceTravelled = 0;  // in Welt-Pixeln

/* ---------------------------------------------------------
   Eingabe
   --------------------------------------------------------- */
const keys = {};
const KEYMAP = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};
window.addEventListener("keydown", (e) => {
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
});
window.addEventListener("keyup", (e) => {
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = false; e.preventDefault(); }
});

// Touch-Buttons
document.querySelectorAll("#touch .btn").forEach((b) => {
  const dir = KEYMAP[b.dataset.key];
  const on = (e) => { e.preventDefault(); keys[dir] = true; };
  const off = (e) => { e.preventDefault(); keys[dir] = false; };
  b.addEventListener("touchstart", on, { passive: false });
  b.addEventListener("touchend", off, { passive: false });
  b.addEventListener("touchcancel", off, { passive: false });
  b.addEventListener("mousedown", on);
  b.addEventListener("mouseup", off);
  b.addEventListener("mouseleave", off);
});

/* ---------------------------------------------------------
   Sound: einfacher Zweitakt-Motor über WebAudio
   --------------------------------------------------------- */
let audio = null, osc = null, gain = null, lp = null;
function initAudio() {
  if (audio) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audio = new AC();
  osc = audio.createOscillator();
  osc.type = "sawtooth";
  lp = audio.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  gain = audio.createGain();
  gain.gain.value = 0.0;
  osc.connect(lp).connect(gain).connect(audio.destination);
  osc.start();
}
function updateEngineSound() {
  if (!audio) return;
  const sp = Math.abs(bike.speed) / MAX_SPEED;
  const idle = 60;
  osc.frequency.setTargetAtTime(idle + sp * 150, audio.currentTime, 0.05);
  lp.frequency.setTargetAtTime(500 + sp * 1800, audio.currentTime, 0.05);
  const target = 0.04 + sp * 0.10 + (keys.up ? 0.04 : 0);
  gain.gain.setTargetAtTime(running ? target : 0, audio.currentTime, 0.08);
}

/* ---------------------------------------------------------
   Spielschleife
   --------------------------------------------------------- */
let running = false;
let last = 0;

function update(dt) {
  // Lenken (nur wenn man fährt; rückwärts invertiert)
  const steer = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
  const speedFactor = Math.min(1, Math.abs(bike.speed) / 60);
  bike.angle += steer * TURN_RATE * speedFactor * Math.sign(bike.speed || 1) * dt;

  // Untergrund bestimmen
  const onRoad = distToNearestRoad(bike.x, bike.y) <= ROAD_W;
  const maxFwd = onRoad ? MAX_SPEED : GRASS_MAX;
  const drag = onRoad ? DRAG_ROAD : DRAG_GRASS;

  // Beschleunigen / Bremsen
  if (keys.up) {
    bike.speed += ACCEL * dt;
  } else if (keys.down) {
    if (bike.speed > 0) bike.speed -= BRAKE * dt;
    else bike.speed -= ACCEL * 0.6 * dt; // rückwärts
  } else {
    // Rollwiderstand
    bike.speed -= bike.speed * drag * dt;
    if (Math.abs(bike.speed) < 2) bike.speed = 0;
  }

  bike.speed = Math.max(REVERSE_SPEED, Math.min(maxFwd, bike.speed));

  // Bewegung
  const nx = bike.x + Math.cos(bike.angle) * bike.speed * dt;
  const ny = bike.y + Math.sin(bike.angle) * bike.speed * dt;

  // Hauskollision (einfach: vom Mittelpunkt fernhalten)
  let blocked = false;
  for (const h of houses) {
    const rr = Math.max(h.w, h.h) * 0.6 + 12;
    if (Math.hypot(nx - h.x, ny - h.y) < rr) { blocked = true; break; }
  }

  if (!blocked) {
    distanceTravelled += Math.hypot(nx - bike.x, ny - bike.y);
    bike.x = nx; bike.y = ny;
  } else {
    bike.speed *= -0.25; // abprallen
  }

  // In der Welt halten
  bike.x = Math.max(20, Math.min(WORLD.w - 20, bike.x));
  bike.y = Math.max(20, Math.min(WORLD.h - 20, bike.y));

  updateHUD(onRoad);
  updateEngineSound();
}

function updateHUD(onRoad) {
  const kmh = Math.round(Math.abs(bike.speed) / MAX_SPEED * 60);
  document.getElementById("speed").textContent = kmh;
  document.getElementById("gear").textContent =
    bike.speed < -5 ? "R" : kmh === 0 ? "N" : kmh < 15 ? "1" : kmh < 30 ? "2" : kmh < 45 ? "3" : "4";

  // Nächstes Dorf finden
  let near = null, nd = Infinity;
  for (const v of villages) {
    const d = Math.hypot(bike.x - v.x, bike.y - v.y);
    if (d < nd) { nd = d; near = v; }
  }
  const vEl = document.getElementById("village");
  if (nd < 320) vEl.textContent = "📍 " + near.name;
  else vEl.textContent = onRoad ? "🛣️ Landstraße" : "🌿 Feldweg";

  document.getElementById("distance").textContent =
    (distanceTravelled / 1000).toFixed(2) + " km";
}

/* ---------------------------------------------------------
   Rendering
   --------------------------------------------------------- */
function draw() {
  // Kamera zentriert auf Bike
  const camX = bike.x - W / 2;
  const camY = bike.y - H / 2;

  // Gras-Hintergrund
  ctx.fillStyle = "#5a8c45";
  ctx.fillRect(0, 0, W, H);
  drawGrassTexture(camX, camY);

  ctx.save();
  ctx.translate(-camX, -camY);

  drawRoads();
  drawTrees();
  drawHouses();
  drawVillageSigns();
  drawBike();

  ctx.restore();

  // Minikarte
  drawMinimap();
}

function drawGrassTexture(camX, camY) {
  // dezente Karos für Geschwindigkeitsgefühl
  const grid = 80;
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1;
  const ox = -((camX % grid) + grid) % grid;
  const oy = -((camY % grid) + grid) % grid;
  ctx.beginPath();
  for (let x = ox; x < W; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = oy; y < H; y += grid) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}

function drawRoads() {
  // Asphalt
  ctx.lineCap = "round";
  ctx.strokeStyle = "#4a4a4a";
  ctx.lineWidth = ROAD_W * 2;
  for (const [a, b] of roads) {
    ctx.beginPath();
    ctx.moveTo(villages[a].x, villages[a].y);
    ctx.lineTo(villages[b].x, villages[b].y);
    ctx.stroke();
  }
  // Randstreifen
  ctx.strokeStyle = "#3a3a3a";
  ctx.lineWidth = ROAD_W * 2 - 8;
  for (const [a, b] of roads) {
    ctx.beginPath();
    ctx.moveTo(villages[a].x, villages[a].y);
    ctx.lineTo(villages[b].x, villages[b].y);
    ctx.stroke();
  }
  // Mittelstreifen (gestrichelt)
  ctx.strokeStyle = "#e9d96b";
  ctx.lineWidth = 4;
  ctx.setLineDash([26, 22]);
  for (const [a, b] of roads) {
    ctx.beginPath();
    ctx.moveTo(villages[a].x, villages[a].y);
    ctx.lineTo(villages[b].x, villages[b].y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawTrees() {
  for (const t of trees) {
    if (!onScreen(t.x, t.y, 60)) continue;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(t.x + 5, t.y + 6, t.r, t.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2f6b2f";
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3d8a3d";
    ctx.beginPath(); ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
}

function drawHouses() {
  for (const h of houses) {
    if (!onScreen(h.x, h.y, 80)) continue;
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rot);
    // Schatten
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(-h.w / 2 + 6, -h.h / 2 + 8, h.w, h.h);
    // Wand
    ctx.fillStyle = h.color;
    ctx.fillRect(-h.w / 2, -h.h / 2, h.w, h.h);
    // Dach
    ctx.fillStyle = "#7a4a3a";
    ctx.fillRect(-h.w / 2, -h.h / 2, h.w, h.h * 0.4);
    ctx.restore();
  }
}

function drawVillageSigns() {
  ctx.font = "bold 18px Trebuchet MS";
  ctx.textAlign = "center";
  for (const v of villages) {
    if (!onScreen(v.x, v.y, 200)) continue;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    const w = ctx.measureText(v.name).width + 22;
    ctx.fillRect(v.x - w / 2, v.y - 250, w, 26);
    ctx.fillStyle = "#777";
    ctx.fillRect(v.x - 2, v.y - 224, 4, 30);
    ctx.fillStyle = "#16221a";
    ctx.fillText(v.name, v.x, v.y - 232);
  }
}

function drawBike() {
  ctx.save();
  ctx.translate(bike.x, bike.y);
  ctx.rotate(bike.angle + Math.PI / 2); // Sprite zeigt nach oben

  // Schatten
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(4, 6, 12, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Räder
  ctx.fillStyle = "#111";
  ctx.fillRect(-4, -24, 8, 12); // vorne
  ctx.fillRect(-4, 14, 8, 12);  // hinten

  // Rahmen / Tank (Simson-Blau)
  ctx.fillStyle = "#2f6fb0";
  roundRect(-8, -14, 16, 30, 5); ctx.fill();
  // Sitzbank
  ctx.fillStyle = "#1c1c1c";
  roundRect(-7, 2, 14, 14, 4); ctx.fill();
  // Tank-Highlight
  ctx.fillStyle = "#5aa0e0";
  roundRect(-5, -10, 10, 10, 3); ctx.fill();

  // Lenker
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-10, -16); ctx.lineTo(10, -16); ctx.stroke();

  // Scheinwerfer
  ctx.fillStyle = "#ffe07a";
  ctx.beginPath(); ctx.arc(0, -20, 3.5, 0, Math.PI * 2); ctx.fill();

  // Fahrer
  ctx.fillStyle = "#c0392b"; // Jacke
  ctx.beginPath(); ctx.ellipse(0, 4, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e8d4b0"; // Helm
  ctx.beginPath(); ctx.arc(0, -6, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#333";
  ctx.beginPath(); ctx.arc(0, -7, 6, Math.PI * 0.1, Math.PI * 0.9); ctx.fill();

  ctx.restore();
}

function drawMinimap() {
  const mw = 150, mh = 110, pad = 14;
  const x0 = W - mw - pad, y0 = H - mh - pad;
  const sx = mw / WORLD.w, sy = mh / WORLD.h;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(x0 - 6, y0 - 6, mw + 12, mh + 12, 8); ctx.fill();

  ctx.strokeStyle = "#888";
  ctx.lineWidth = 3;
  for (const [a, b] of roads) {
    ctx.beginPath();
    ctx.moveTo(x0 + villages[a].x * sx, y0 + villages[a].y * sy);
    ctx.lineTo(x0 + villages[b].x * sx, y0 + villages[b].y * sy);
    ctx.stroke();
  }
  ctx.fillStyle = "#ffd23f";
  for (const v of villages) {
    ctx.beginPath();
    ctx.arc(x0 + v.x * sx, y0 + v.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Spieler
  ctx.fillStyle = "#e74c3c";
  ctx.beginPath();
  ctx.arc(x0 + bike.x * sx, y0 + bike.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
}

/* Hilfen */
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function onScreen(x, y, margin) {
  return x > bike.x - W / 2 - margin && x < bike.x + W / 2 + margin &&
         y > bike.y - H / 2 - margin && y < bike.y + H / 2 + margin;
}

/* ---------------------------------------------------------
   Loop
   --------------------------------------------------------- */
function loop(ts) {
  if (!last) last = ts;
  let dt = (ts - last) / 1000;
  last = ts;
  dt = Math.min(dt, 0.05); // gegen große Sprünge

  if (running) update(dt);
  draw();
  requestAnimationFrame(loop);
}

/* ---------------------------------------------------------
   Start
   --------------------------------------------------------- */
document.getElementById("startBtn").addEventListener("click", () => {
  document.getElementById("start").classList.add("hidden");
  running = true;
  initAudio();
  if (audio && audio.state === "suspended") audio.resume();
});

requestAnimationFrame(loop);
