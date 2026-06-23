"use strict";

/* =========================================================
   Simson Tour
   Top-Down-Fahrspiel: Simson S51 durch Dörfer fahren,
   Pakete liefern, tanken, Ampeln & Verkehr beachten.
   ========================================================= */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Offscreen-Layer für das Nacht-Overlay (Dunkelheit mit Lichtkegeln)
const nightCv = document.createElement("canvas");
const nctx = nightCv.getContext("2d");

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  nightCv.width = W;
  nightCv.height = H;
}
window.addEventListener("resize", resize);
resize();

/* ---------------------------------------------------------
   Welt: Dörfer (Knoten) und Straßen (Kanten dazwischen)
   --------------------------------------------------------- */
const ROAD_W = 64; // halbe Straßenbreite

const WORLD = { w: 8200, h: 6000 };

const villages = [
  { name: "Kleinmühle", x:  600, y:  700, gas: true  },
  { name: "Eichdorf",   x: 2400, y:  500, gas: false },
  { name: "Hohenwalde", x: 4200, y:  900, gas: true  },
  { name: "Lindenbach", x: 1300, y: 2600, gas: false },
  { name: "Talheim",    x: 3300, y: 2400, gas: true  },
  { name: "Birkenau",   x: 5400, y: 2000, gas: false },
  { name: "Sonnberg",   x: 6800, y: 1100, gas: true  },
  { name: "Auental",    x: 2000, y: 4400, gas: true  },
  { name: "Rosenheim",  x: 4600, y: 4200, gas: false },
  { name: "Waldkirch",  x: 6600, y: 3600, gas: true  },
  { name: "Steinbach",  x: 5200, y: 5400, gas: false },
];

// Straßennetz (Indizes in villages)
const roads = [
  [0, 1], [1, 2], [2, 6], [0, 3], [1, 4], [2, 5], [3, 4],
  [4, 5], [5, 6], [3, 7], [4, 8], [5, 9], [7, 8], [8, 9],
  [8, 10], [9, 10], [6, 9],
];

// Ampeln an stark befahrenen Knoten
const lightNodes = [4, 5, 8, 9];

/* deterministischer Zufall */
let seed = 20240623;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

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
   Bäume & Häuser prozedural platzieren
   --------------------------------------------------------- */
const trees = [];
for (let i = 0; i < 700; i++) {
  const x = rnd() * WORLD.w, y = rnd() * WORLD.h;
  if (distToNearestRoad(x, y) > ROAD_W + 30) trees.push({ x, y, r: 14 + rnd() * 12 });
}

const houses = [];
const palette = ["#c98a5a", "#b56b4b", "#d9b36b", "#9aa7b0", "#cf6f6f", "#7fa86b"];
for (const v of villages) {
  const n = 8 + Math.floor(rnd() * 7);
  for (let i = 0; i < n; i++) {
    const ang = rnd() * Math.PI * 2;
    const dist = 100 + rnd() * 230;
    const hx = v.x + Math.cos(ang) * dist;
    const hy = v.y + Math.sin(ang) * dist;
    if (distToNearestRoad(hx, hy) < ROAD_W + 20) continue;
    houses.push({
      x: hx, y: hy,
      w: 46 + rnd() * 34, h: 40 + rnd() * 30,
      rot: rnd() * Math.PI * 2,
      color: palette[Math.floor(rnd() * palette.length)],
    });
  }
}

/* ---------------------------------------------------------
   Outfits
   --------------------------------------------------------- */
const OUTFITS = [
  { name: "Klassik", jacket: "#c0392b", helmet: "#e8d4b0" },
  { name: "Förster", jacket: "#2e7d32", helmet: "#3a3a3a" },
  { name: "Post",    jacket: "#f1c40f", helmet: "#2c3e50" },
  { name: "Nacht",   jacket: "#34495e", helmet: "#111111" },
];
let outfit = 0;

/* ---------------------------------------------------------
   Spieler: die Simson
   --------------------------------------------------------- */
const bike = {
  x: villages[0].x, y: villages[0].y + 40,
  angle: -Math.PI / 2, speed: 0,
};

const KMH = 60 / 320;        // px/s -> km/h für die Anzeige
const REVERSE_SPEED = -90, BRAKE = 380;
const DRAG_ROAD = 0.7, DRAG_GRASS = 2.4;
const GRASS_MAX = 130, TURN_RATE = 2.6;

// Auswählbare Simson-Modelle (Tempo & Beschleunigung)
const MODELS = [
  { name: "S51",      maxSpeed: 320, accel: 220, desc: "Allrounder" },
  { name: "Schwalbe", maxSpeed: 300, accel: 170, desc: "gemütlich" },
  { name: "S70",      maxSpeed: 400, accel: 250, desc: "schnell" },
  { name: "SR50",     maxSpeed: 360, accel: 300, desc: "spritzig" },
];
let model = 0;
let maxSpeed = MODELS[0].maxSpeed;
let accel = MODELS[0].accel;

let distanceTravelled = 0;
let fuel = 100;            // 0..100
let money = 0;

// Tag/Nacht, Wetter, Bedienung, Rekorde
let worldTime = 8 * 60;    // Spielzeit in Minuten (Start 08:00)
let weather = "clear", weatherTimer = 30;
let blinkL = false, blinkR = false, hornDown = false;
let bestMoney = +(localStorage.getItem("simson_best_money") || 0);
let bestDist = +(localStorage.getItem("simson_best_dist") || 0);

/* ---------------------------------------------------------
   Lieferaufträge
   --------------------------------------------------------- */
let job = null;            // { stage:'pickup'|'deliver', from, to, reward }
function newJob() {
  // Startpunkt = nächstes Dorf
  let from = nearestVillageIndex();
  let to = from;
  while (to === from) to = Math.floor(rnd() * villages.length);
  const dist = Math.hypot(villages[from].x - villages[to].x, villages[from].y - villages[to].y);
  const reward = Math.round(dist / 1000 * 9) + 6;
  job = { stage: "pickup", from, to, reward };
}
function nearestVillageIndex() {
  let idx = 0, nd = Infinity;
  for (let i = 0; i < villages.length; i++) {
    const d = Math.hypot(bike.x - villages[i].x, bike.y - villages[i].y);
    if (d < nd) { nd = d; idx = i; }
  }
  return idx;
}

/* ---------------------------------------------------------
   Verkehr: NPC-Autos auf den Straßen
   --------------------------------------------------------- */
const carColors = ["#d35400", "#2980b9", "#27ae60", "#8e44ad", "#bdc3c7", "#16a085"];
const cars = [];
for (let i = 0; i < 16; i++) {
  const r = roads[Math.floor(rnd() * roads.length)];
  cars.push({
    edge: r,
    t: rnd(),                       // Position 0..1 entlang der Kante
    dir: rnd() < 0.5 ? 1 : -1,      // Fahrtrichtung
    speed: 70 + rnd() * 70,         // px/s
    color: carColors[Math.floor(rnd() * carColors.length)],
    x: 0, y: 0, angle: 0, stopped: false,
  });
}

/* ---------------------------------------------------------
   Ampeln
   --------------------------------------------------------- */
const lights = lightNodes.map((n, i) => ({ node: n, timer: i * 2.5, state: "green" }));
const LIGHT_CYCLE = { green: 6, yellow: 2, red: 6 };
function updateLights(dt) {
  for (const l of lights) {
    l.timer += dt;
    const dur = LIGHT_CYCLE[l.state];
    if (l.timer >= dur) {
      l.timer = 0;
      l.state = l.state === "green" ? "yellow" : l.state === "yellow" ? "red" : "green";
    }
  }
}
function lightAt(node) { return lights.find((l) => l.node === node); }

/* ---------------------------------------------------------
   Eingabe
   --------------------------------------------------------- */
const keys = {};
const KEYMAP = {
  ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
};
window.addEventListener("keydown", (e) => {
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
  if (e.code === "KeyH" || e.code === "Space") { if (!hornDown) { hornDown = true; honk(); } e.preventDefault(); }
  if (e.code === "KeyQ") { blinkL = !blinkL; blinkR = false; }
  if (e.code === "KeyE") { blinkR = !blinkR; blinkL = false; }
});
window.addEventListener("keyup", (e) => {
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = false; e.preventDefault(); }
  if (e.code === "KeyH" || e.code === "Space") hornDown = false;
});

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
   Sound: einfacher Zweitakt-Motor
   --------------------------------------------------------- */
let audio = null, osc = null, gain = null, lp = null;
function initAudio() {
  if (audio) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audio = new AC();
  osc = audio.createOscillator(); osc.type = "sawtooth";
  lp = audio.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
  gain = audio.createGain(); gain.gain.value = 0;
  osc.connect(lp).connect(gain).connect(audio.destination);
  osc.start();
}
function updateEngineSound() {
  if (!audio) return;
  const sp = Math.abs(bike.speed) / maxSpeed;
  const on = running && fuel > 0;
  osc.frequency.setTargetAtTime(60 + sp * 150, audio.currentTime, 0.05);
  lp.frequency.setTargetAtTime(500 + sp * 1800, audio.currentTime, 0.05);
  const target = 0.04 + sp * 0.10 + (keys.up ? 0.04 : 0);
  gain.gain.setTargetAtTime(on ? target : 0, audio.currentTime, 0.08);
}
function honk() {
  if (!audio) return;
  const t = audio.currentTime;
  const o = audio.createOscillator(); o.type = "square"; o.frequency.value = 392;
  const g = audio.createGain(); g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.13, t + 0.02);
  g.gain.setTargetAtTime(0, t + 0.22, 0.05);
  o.connect(g).connect(audio.destination);
  o.start(t); o.stop(t + 0.5);
}

/* ---------------------------------------------------------
   Toast-Meldungen
   --------------------------------------------------------- */
const toastEl = document.getElementById("toast");
function toast(text) {
  const d = document.createElement("div");
  d.className = "toast-msg";
  d.textContent = text;
  toastEl.appendChild(d);
  setTimeout(() => d.remove(), 1600);
}

/* ---------------------------------------------------------
   Tag/Nacht & Wetter
   --------------------------------------------------------- */
function nightAlpha() {
  const h = (worldTime / 60) % 24;
  let dark;
  if (h >= 7 && h <= 19) dark = 0;
  else if (h > 19 && h < 21) dark = (h - 19) / 2;   // Abenddämmerung
  else if (h > 5 && h < 7) dark = (7 - h) / 2;       // Morgendämmerung
  else dark = 1;                                     // Nacht
  return dark * 0.8;
}
function updateWeather(dt) {
  weatherTimer -= dt;
  if (weatherTimer <= 0) {
    const wasRain = weather === "rain";
    weather = rnd() < 0.35 ? "rain" : "clear";
    weatherTimer = 25 + rnd() * 35;
    if (weather === "rain" && !wasRain) toast("🌧️ Es fängt an zu regnen");
  }
}

/* ---------------------------------------------------------
   Update
   --------------------------------------------------------- */
let running = false, last = 0;
let redCooldown = 0;

function update(dt) {
  worldTime = (worldTime + dt * 6) % 1440; // ~4 Min. realer Zeit = 1 Tag
  updateWeather(dt);
  updateLights(dt);
  updateCars(dt);
  if (redCooldown > 0) redCooldown -= dt;

  const rain = weather === "rain";

  // Lenken
  const steer = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
  const speedFactor = Math.min(1, Math.abs(bike.speed) / 60);
  bike.angle += steer * TURN_RATE * (rain ? 0.82 : 1) * speedFactor * Math.sign(bike.speed || 1) * dt;

  // Untergrund (Regen mindert Grip & Tempo)
  const onRoad = distToNearestRoad(bike.x, bike.y) <= ROAD_W;
  const maxFwd = (onRoad ? maxSpeed : GRASS_MAX) * (rain ? 0.9 : 1);
  const drag = (onRoad ? DRAG_ROAD : DRAG_GRASS) * (rain ? 1.5 : 1);
  const hasFuel = fuel > 0;

  // Beschleunigen / Bremsen
  if (keys.up && hasFuel) {
    bike.speed += accel * dt;
  } else if (keys.down) {
    if (bike.speed > 0) bike.speed -= BRAKE * dt;
    else if (hasFuel) bike.speed -= accel * 0.6 * dt;
  } else {
    bike.speed -= bike.speed * drag * dt;
    if (Math.abs(bike.speed) < 2) bike.speed = 0;
  }
  bike.speed = Math.max(REVERSE_SPEED, Math.min(maxFwd, bike.speed));

  // Sprit verbrauchen
  const consume = (Math.abs(bike.speed) / maxSpeed) * 2.4 + (keys.up ? 0.8 : 0);
  fuel = Math.max(0, fuel - consume * dt);

  // Bewegung
  let nx = bike.x + Math.cos(bike.angle) * bike.speed * dt;
  let ny = bike.y + Math.sin(bike.angle) * bike.speed * dt;

  // Kollision mit Häusern
  let blocked = false;
  for (const h of houses) {
    if (Math.abs(nx - h.x) > 120 || Math.abs(ny - h.y) > 120) continue;
    const rr = Math.max(h.w, h.h) * 0.6 + 12;
    if (Math.hypot(nx - h.x, ny - h.y) < rr) { blocked = true; break; }
  }
  // Kollision mit Autos
  for (const c of cars) {
    if (Math.hypot(nx - c.x, ny - c.y) < 28) { blocked = true; break; }
  }

  if (!blocked) {
    distanceTravelled += Math.hypot(nx - bike.x, ny - bike.y);
    bike.x = nx; bike.y = ny;
  } else {
    bike.speed *= -0.25;
  }

  bike.x = Math.max(20, Math.min(WORLD.w - 20, bike.x));
  bike.y = Math.max(20, Math.min(WORLD.h - 20, bike.y));

  handleVillageEvents();
  handleTrafficLights();
  updateHUD(onRoad, hasFuel);
  updateEngineSound();
}

function updateCars(dt) {
  for (const c of cars) {
    const a = villages[c.edge[0]], b = villages[c.edge[1]];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;

    // Vor welchem Knoten fährt das Auto? Ampel beachten.
    const towardNode = c.dir > 0 ? c.edge[1] : c.edge[0];
    const lt = lightAt(towardNode);
    const distToNode = c.dir > 0 ? (1 - c.t) * len : c.t * len;
    c.stopped = lt && (lt.state === "red" || lt.state === "yellow") && distToNode < 120;

    if (!c.stopped) c.t += (c.dir * c.speed * dt) / len;

    // an Knoten wenden
    if (c.t > 1) { c.t = 1; c.dir = -1; }
    if (c.t < 0) { c.t = 0; c.dir = 1; }

    c.x = a.x + (b.x - a.x) * c.t;
    c.y = a.y + (b.y - a.y) * c.t;
    c.angle = Math.atan2((b.y - a.y) * c.dir, (b.x - a.x) * c.dir);
  }
}

function handleVillageEvents() {
  const idx = nearestVillageIndex();
  const v = villages[idx];
  const near = Math.hypot(bike.x - v.x, bike.y - v.y) < 200;
  const slow = Math.abs(bike.speed) < 60;

  // Tanken
  if (near && v.gas && slow && fuel < 100) {
    fuel = Math.min(100, fuel + 28 * (1 / 60));
  }

  // Auftrag abwickeln
  if (job && near && slow) {
    if (job.stage === "pickup" && idx === job.from) {
      job.stage = "deliver";
      toast("📦 Paket geladen – ab nach " + villages[job.to].name + "!");
    } else if (job.stage === "deliver" && idx === job.to) {
      money += job.reward;
      toast("✅ Geliefert! +" + job.reward + " €");
      newJob();
    }
  }
}

function handleTrafficLights() {
  if (redCooldown > 0) return;
  for (const l of lights) {
    if (l.state !== "red") continue;
    const v = villages[l.node];
    if (Math.hypot(bike.x - v.x, bike.y - v.y) < ROAD_W + 30 && Math.abs(bike.speed) > 120) {
      money -= 10;
      toast("🚦 Bei Rot gefahren! −10 €");
      redCooldown = 4;
      break;
    }
  }
}

function updateHUD(onRoad, hasFuel) {
  const kmh = Math.round(Math.abs(bike.speed) * KMH);
  document.getElementById("speed").textContent = kmh;
  document.getElementById("gear").textContent =
    bike.speed < -5 ? "R" : kmh === 0 ? "N" : kmh < 15 ? "1" : kmh < 30 ? "2" : kmh < 45 ? "3" : "4";

  document.getElementById("fuelFill").style.width = fuel + "%";
  document.getElementById("money").textContent = money + " €";

  if (job) {
    const t = job.stage === "pickup"
      ? "📦 Paket holen: " + villages[job.from].name
      : "🏁 Liefern nach: " + villages[job.to].name + " (+" + job.reward + " €)";
    document.getElementById("job").textContent = t;
  }

  const idx = nearestVillageIndex();
  const v = villages[idx];
  const nd = Math.hypot(bike.x - v.x, bike.y - v.y);
  const vEl = document.getElementById("village");
  if (nd < 320) vEl.textContent = (v.gas ? "⛽ " : "📍 ") + v.name + (!hasFuel ? " · Tank leer!" : "");
  else vEl.textContent = !hasFuel ? "🚧 Tank leer!" : onRoad ? "🛣️ Landstraße" : "🌿 Feldweg";

  document.getElementById("distance").textContent = (distanceTravelled / 1000).toFixed(2) + " km";

  // Uhr & Wetter
  const hh = Math.floor((worldTime / 60) % 24), mm = Math.floor(worldTime % 60);
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  const sky = nightAlpha() > 0.4 ? "🌙" : "☀️";
  document.getElementById("env").textContent =
    pad(hh) + ":" + pad(mm) + " " + sky + (weather === "rain" ? " 🌧️" : "");

  // Rekorde sichern
  if (money > bestMoney) { bestMoney = money; localStorage.setItem("simson_best_money", bestMoney); }
  if (distanceTravelled > bestDist) { bestDist = distanceTravelled; localStorage.setItem("simson_best_dist", Math.round(bestDist)); }
}

/* ---------------------------------------------------------
   Rendering
   --------------------------------------------------------- */
function draw() {
  const camX = bike.x - W / 2, camY = bike.y - H / 2;

  ctx.fillStyle = "#5a8c45";
  ctx.fillRect(0, 0, W, H);
  drawGrassTexture(camX, camY);

  ctx.save();
  ctx.translate(-camX, -camY);

  drawRoads();
  drawTrees();
  drawHouses();
  drawGasStations();
  drawCars();
  drawTrafficLights();
  drawVillageSigns();
  drawRemotePlayers();
  drawBike();

  ctx.restore();

  drawNight(camX, camY);
  drawRain();
  drawObjectiveArrow();
  drawMinimap();
}

function drawNight(camX, camY) {
  const a = nightAlpha();
  if (a <= 0.01) return;
  // Dunkelheit auf Offscreen-Layer, Lichter „ausstanzen"
  nightCv.width = W; nightCv.height = H;
  nctx.fillStyle = "rgba(6,10,30," + a + ")";
  nctx.fillRect(0, 0, W, H);
  nctx.globalCompositeOperation = "destination-out";

  const punch = (sx, sy, r, strength) => {
    const g = nctx.createRadialGradient(sx, sy, r * 0.1, sx, sy, r);
    g.addColorStop(0, "rgba(0,0,0," + strength + ")");
    g.addColorStop(1, "rgba(0,0,0,0)");
    nctx.fillStyle = g;
    nctx.beginPath(); nctx.arc(sx, sy, r, 0, Math.PI * 2); nctx.fill();
  };

  // Straßenlaternen der Dörfer
  for (const v of villages) {
    const sx = v.x - camX, sy = v.y - camY;
    if (sx < -260 || sx > W + 260 || sy < -260 || sy > H + 260) continue;
    punch(sx, sy, 260, 0.9);
  }
  // Scheinwerfer der Simson (nach vorn gerichtet)
  const hx = W / 2 + Math.cos(bike.angle) * 150;
  const hy = H / 2 + Math.sin(bike.angle) * 150;
  punch(hx, hy, 260, 0.95);
  punch(W / 2, H / 2, 70, 0.6);

  nctx.globalCompositeOperation = "source-over";
  ctx.drawImage(nightCv, 0, 0);
}

function drawRain() {
  if (weather !== "rain") return;
  ctx.fillStyle = "rgba(120,140,180,0.12)";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(190,205,235,0.35)";
  ctx.lineWidth = 2;
  const t = performance.now() / 1000;
  ctx.beginPath();
  for (let i = 0; i < 160; i++) {
    const x = ((i * 97 + t * 650) % (W + 40)) - 20;
    const y = ((i * 53 + t * 950) % (H + 40)) - 20;
    ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 15);
  }
  ctx.stroke();
}

function drawGrassTexture(camX, camY) {
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
  ctx.lineCap = "round";
  ctx.strokeStyle = "#4a4a4a"; ctx.lineWidth = ROAD_W * 2;
  strokeAllRoads();
  ctx.strokeStyle = "#3a3a3a"; ctx.lineWidth = ROAD_W * 2 - 8;
  strokeAllRoads();
  ctx.strokeStyle = "#e9d96b"; ctx.lineWidth = 4; ctx.setLineDash([26, 22]);
  strokeAllRoads();
  ctx.setLineDash([]);
}
function strokeAllRoads() {
  for (const [a, b] of roads) {
    ctx.beginPath();
    ctx.moveTo(villages[a].x, villages[a].y);
    ctx.lineTo(villages[b].x, villages[b].y);
    ctx.stroke();
  }
}

function drawTrees() {
  for (const t of trees) {
    if (!onScreen(t.x, t.y, 60)) continue;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath(); ctx.ellipse(t.x + 5, t.y + 6, t.r, t.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
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
    ctx.translate(h.x, h.y); ctx.rotate(h.rot);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(-h.w / 2 + 6, -h.h / 2 + 8, h.w, h.h);
    ctx.fillStyle = h.color;
    ctx.fillRect(-h.w / 2, -h.h / 2, h.w, h.h);
    ctx.fillStyle = "#7a4a3a";
    ctx.fillRect(-h.w / 2, -h.h / 2, h.w, h.h * 0.4);
    ctx.restore();
  }
}

function drawGasStations() {
  for (const v of villages) {
    if (!v.gas || !onScreen(v.x, v.y, 200)) continue;
    const gx = v.x + 130, gy = v.y;
    ctx.fillStyle = "#2c3e50";
    roundRect(gx - 26, gy - 20, 52, 40, 6); ctx.fill();
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(gx - 26, gy - 30, 52, 14);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Trebuchet MS"; ctx.textAlign = "center";
    ctx.fillText("⛽", gx, gy + 6);
  }
}

function drawCars() {
  for (const c of cars) {
    if (!onScreen(c.x, c.y, 60)) continue;
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(c.angle);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(-16, -9, 36, 22);
    ctx.fillStyle = c.color;
    roundRect(-18, -11, 36, 22, 5); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    roundRect(-2, -8, 12, 16, 3); ctx.fill();
    ctx.fillStyle = "#ffe07a";
    ctx.fillRect(16, -8, 4, 5); ctx.fillRect(16, 3, 4, 5);
    ctx.restore();
  }
}

function drawTrafficLights() {
  for (const l of lights) {
    const v = villages[l.node];
    if (!onScreen(v.x, v.y, 200)) continue;
    const lx = v.x - 90, ly = v.y - 70;
    ctx.fillStyle = "#222";
    roundRect(lx - 7, ly - 22, 14, 40, 4); ctx.fill();
    const cols = { red: "#e74c3c", yellow: "#f1c40f", green: "#2ecc71" };
    const order = ["red", "yellow", "green"];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = l.state === order[i] ? cols[order[i]] : "rgba(255,255,255,0.12)";
      ctx.beginPath(); ctx.arc(lx, ly - 12 + i * 12, 4.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawVillageSigns() {
  ctx.font = "bold 18px Trebuchet MS"; ctx.textAlign = "center";
  for (const v of villages) {
    if (!onScreen(v.x, v.y, 260)) continue;
    const w = ctx.measureText(v.name).width + 22;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(v.x - w / 2, v.y - 250, w, 26);
    ctx.fillStyle = "#777"; ctx.fillRect(v.x - 2, v.y - 224, 4, 30);
    ctx.fillStyle = "#16221a"; ctx.fillText(v.name, v.x, v.y - 232);
  }
}

function drawBike() {
  drawBikeSprite(bike.x, bike.y, bike.angle, outfit, blinkL, blinkR);
}
function drawBikeSprite(x, y, angle, outfitIdx, bL, bR) {
  const o = OUTFITS[outfitIdx] || OUTFITS[0];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.ellipse(4, 6, 12, 22, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = "#111";
  ctx.fillRect(-4, -24, 8, 12);
  ctx.fillRect(-4, 14, 8, 12);

  ctx.fillStyle = "#2f6fb0"; roundRect(-8, -14, 16, 30, 5); ctx.fill();
  ctx.fillStyle = "#1c1c1c"; roundRect(-7, 2, 14, 14, 4); ctx.fill();
  ctx.fillStyle = "#5aa0e0"; roundRect(-5, -10, 10, 10, 3); ctx.fill();

  ctx.strokeStyle = "#222"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-10, -16); ctx.lineTo(10, -16); ctx.stroke();

  ctx.fillStyle = "#ffe07a";
  ctx.beginPath(); ctx.arc(0, -20, 3.5, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = o.jacket;
  ctx.beginPath(); ctx.ellipse(0, 4, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = o.helmet;
  ctx.beginPath(); ctx.arc(0, -6, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.arc(0, -7, 6, Math.PI * 0.1, Math.PI * 0.9); ctx.fill();

  // Blinker (amber, blinkend)
  const blinkOn = Math.floor(performance.now() / 250) % 2 === 0;
  if (blinkOn) {
    ctx.fillStyle = "#ffae00";
    if (bL) {
      ctx.beginPath(); ctx.arc(-9, -17, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-9, 17, 3, 0, Math.PI * 2); ctx.fill();
    }
    if (bR) {
      ctx.beginPath(); ctx.arc(9, -17, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(9, 17, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  ctx.restore();
}

/* Pfeil zum aktuellen Auftragsziel */
function drawObjectiveArrow() {
  if (!job) return;
  const target = villages[job.stage === "pickup" ? job.from : job.to];
  const dx = target.x - bike.x, dy = target.y - bike.y;
  const onScr = Math.abs(dx) < W / 2 - 60 && Math.abs(dy) < H / 2 - 60;
  if (onScr) return;

  const ang = Math.atan2(dy, dx);
  const r = Math.min(W, H) / 2 - 70;
  const ax = W / 2 + Math.cos(ang) * r;
  const ay = H / 2 + Math.sin(ang) * r;

  ctx.save();
  ctx.translate(ax, ay); ctx.rotate(ang);
  ctx.fillStyle = job.stage === "pickup" ? "#3498db" : "#2ecc71";
  ctx.beginPath();
  ctx.moveTo(18, 0); ctx.lineTo(-10, 11); ctx.lineTo(-10, -11);
  ctx.closePath(); ctx.fill();
  ctx.restore();

  const km = (Math.hypot(dx, dy) / 1000).toFixed(1);
  ctx.fillStyle = "#fff"; ctx.font = "bold 13px Trebuchet MS"; ctx.textAlign = "center";
  ctx.fillText(target.name + " · " + km + " km", ax, ay - 18);
}

function drawMinimap() {
  const mw = 160, mh = 118, pad = 14;
  const x0 = W - mw - pad, y0 = H - mh - pad;
  const sx = mw / WORLD.w, sy = mh / WORLD.h;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(x0 - 6, y0 - 6, mw + 12, mh + 12, 8); ctx.fill();

  ctx.strokeStyle = "#888"; ctx.lineWidth = 2;
  for (const [a, b] of roads) {
    ctx.beginPath();
    ctx.moveTo(x0 + villages[a].x * sx, y0 + villages[a].y * sy);
    ctx.lineTo(x0 + villages[b].x * sx, y0 + villages[b].y * sy);
    ctx.stroke();
  }
  for (let i = 0; i < villages.length; i++) {
    const v = villages[i];
    ctx.fillStyle = v.gas ? "#3aa0ff" : "#ffd23f";
    ctx.beginPath(); ctx.arc(x0 + v.x * sx, y0 + v.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Auftragsziel hervorheben
  if (job) {
    const t = villages[job.stage === "pickup" ? job.from : job.to];
    ctx.strokeStyle = "#2ecc71"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x0 + t.x * sx, y0 + t.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = "#e74c3c";
  ctx.beginPath(); ctx.arc(x0 + bike.x * sx, y0 + bike.y * sy, 4, 0, Math.PI * 2); ctx.fill();
}

/* Helfer */
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function onScreen(x, y, m) {
  return x > bike.x - W / 2 - m && x < bike.x + W / 2 + m &&
         y > bike.y - H / 2 - m && y < bike.y + H / 2 + m;
}

/* ---------------------------------------------------------
   Mehrspieler über WebSocket
   --------------------------------------------------------- */
let ws = null, myId = null, roomCode = null;
const remotes = new Map(); // id -> { profile, x,y,angle, tx,ty,tangle, blinkL,blinkR }

function wsUrl() {
  if (location.host) {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    return proto + "://" + location.host;
  }
  return "ws://localhost:8080"; // Fallback bei Aufruf via file://
}
function mpStatus(text, ok) {
  const el = document.getElementById("mpStatus");
  if (el) { el.textContent = text; el.style.color = ok ? "#9fe6c0" : "#ffb0b0"; }
}

function connect(mode, code) {
  const name = (document.getElementById("mpName").value || "Fahrer").slice(0, 16);
  initAudio();
  if (audio && audio.state === "suspended") audio.resume();
  try { ws = new WebSocket(wsUrl()); }
  catch (e) { mpStatus("Verbindung fehlgeschlagen", false); return; }

  mpStatus("Verbinde…", true);
  ws.onopen = () => ws.send(JSON.stringify({ type: mode, code, name, outfit, model }));
  ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } handleNet(m); };
  ws.onclose = () => { if (running) toast("🔌 Verbindung getrennt"); mpStatus("Getrennt", false); };
  ws.onerror = () => mpStatus("Server nicht erreichbar – läuft node server.js?", false);
}

function handleNet(msg) {
  if (msg.type === "joined") {
    myId = msg.id; roomCode = msg.code;
    for (const p of msg.peers) addRemote(p.id, p.profile, p.state);
    startGame();
    updateMpInfo();
    toast("🎮 Raum " + roomCode);
  } else if (msg.type === "error") {
    mpStatus(msg.msg || "Fehler", false);
  } else if (msg.type === "peerJoined") {
    addRemote(msg.id, msg.profile, null);
    updateMpInfo();
    toast("➕ " + (msg.profile.name || "Fahrer") + " beigetreten");
  } else if (msg.type === "peerLeft") {
    const r = remotes.get(msg.id);
    remotes.delete(msg.id);
    updateMpInfo();
    if (r) toast("➖ " + (r.profile.name || "Fahrer") + " verlässt");
  } else if (msg.type === "state") {
    const r = remotes.get(msg.id);
    if (r && msg.state) {
      r.tx = msg.state.x; r.ty = msg.state.y; r.tangle = msg.state.angle;
      r.blinkL = msg.state.blinkL; r.blinkR = msg.state.blinkR;
      r.profile.outfit = msg.state.outfit | 0;
    }
  }
}

function addRemote(id, profile, state) {
  if (id === myId) return;
  const x = state ? state.x : bike.x;
  const y = state ? state.y : bike.y;
  const a = state ? state.angle : 0;
  remotes.set(id, {
    profile: profile || {}, x, y, angle: a, tx: x, ty: y, tangle: a,
    blinkL: false, blinkR: false,
  });
}

function sendState() {
  if (!ws || ws.readyState !== 1 || myId == null) return;
  ws.send(JSON.stringify({ type: "state", state: {
    x: Math.round(bike.x), y: Math.round(bike.y),
    angle: +bike.angle.toFixed(3), speed: Math.round(bike.speed),
    outfit, model, blinkL, blinkR,
  } }));
}
setInterval(sendState, 60);

function drawRemotePlayers() {
  ctx.textAlign = "center";
  for (const r of remotes.values()) {
    r.x += (r.tx - r.x) * 0.2;
    r.y += (r.ty - r.y) * 0.2;
    let da = r.tangle - r.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    r.angle += da * 0.2;

    if (!onScreen(r.x, r.y, 80)) continue;
    drawBikeSprite(r.x, r.y, r.angle, r.profile.outfit | 0, r.blinkL, r.blinkR);

    const nm = r.profile.name || "Fahrer";
    ctx.font = "bold 13px Trebuchet MS";
    const w = ctx.measureText(nm).width + 14;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    roundRect(r.x - w / 2, r.y - 46, w, 18, 5); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(nm, r.x, r.y - 33);
  }
}

function updateMpInfo() {
  const el = document.getElementById("mpInfo");
  if (!el) return;
  if (roomCode) {
    el.style.display = "block";
    el.textContent = "🎮 Raum " + roomCode + " · " + (remotes.size + 1) + " Fahrer";
  } else {
    el.style.display = "none";
  }
}

/* ---------------------------------------------------------
   Loop
   --------------------------------------------------------- */
function loop(ts) {
  if (!last) last = ts;
  let dt = (ts - last) / 1000; last = ts;
  dt = Math.min(dt, 0.05);
  if (running) update(dt);
  draw();
  requestAnimationFrame(loop);
}

/* ---------------------------------------------------------
   Outfit-Auswahl auf dem Startbildschirm
   --------------------------------------------------------- */
function buildOutfitPicker() {
  const list = document.getElementById("outfitList");
  OUTFITS.forEach((o, i) => {
    const el = document.createElement("div");
    el.className = "outfit" + (i === outfit ? " sel" : "");
    const c = document.createElement("canvas");
    c.width = 40; c.height = 40;
    const g = c.getContext("2d");
    g.translate(20, 22);
    g.fillStyle = o.jacket; g.beginPath(); g.ellipse(0, 4, 9, 11, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = o.helmet; g.beginPath(); g.arc(0, -7, 7, 0, Math.PI * 2); g.fill();
    el.appendChild(c);
    el.appendChild(document.createTextNode(o.name));
    el.addEventListener("click", () => {
      outfit = i;
      document.querySelectorAll(".outfit").forEach((e) => e.classList.remove("sel"));
      el.classList.add("sel");
    });
    list.appendChild(el);
  });
}
buildOutfitPicker();

function buildModelPicker() {
  const list = document.getElementById("modelList");
  MODELS.forEach((m, i) => {
    const el = document.createElement("div");
    el.className = "model" + (i === model ? " sel" : "");
    el.innerHTML = "<b>" + m.name + "</b><small>" +
      Math.round(m.maxSpeed * KMH) + " km/h · " + m.desc + "</small>";
    el.addEventListener("click", () => {
      model = i;
      document.querySelectorAll(".model").forEach((e) => e.classList.remove("sel"));
      el.classList.add("sel");
    });
    list.appendChild(el);
  });
}
buildModelPicker();

function showHighscore() {
  const el = document.getElementById("highscore");
  if (bestMoney > 0 || bestDist > 0) {
    el.textContent = "🏆 Rekord: " + bestMoney + " € · " + (bestDist / 1000).toFixed(1) + " km";
  }
}
showHighscore();

function startGame() {
  if (running) return;
  document.getElementById("start").classList.add("hidden");
  maxSpeed = MODELS[model].maxSpeed;
  accel = MODELS[model].accel;
  running = true;
  newJob();
  initAudio();
  if (audio && audio.state === "suspended") audio.resume();
}

document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("hostBtn").addEventListener("click", () => connect("host", null));
document.getElementById("joinBtn").addEventListener("click", () => {
  const code = (document.getElementById("joinCode").value || "").toUpperCase().trim();
  if (code.length < 3) { mpStatus("Bitte Code eingeben", false); return; }
  connect("join", code);
});

requestAnimationFrame(loop);
