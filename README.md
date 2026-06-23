# 🛵 Simson Tour

Ein kleines Browser-Spiel: Fahr mit einer **Simson S51** über Landstraßen
durch eine Welt mit mehreren Dörfern. Top-Down-Ansicht, einfache Fahrphysik,
prozedural platzierte Häuser und Bäume, Tacho, Minikarte und ein
Zweitakt-Motorsound aus dem Browser.

## Spielen

Keine Installation, kein Build nötig – einfach `index.html` im Browser öffnen.

Oder lokal über einen kleinen Server (empfohlen, falls der Sound blockiert):

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

## Steuerung

| Taste            | Aktion                |
|------------------|-----------------------|
| `↑` / `W`        | Gas geben             |
| `↓` / `S`        | Bremsen / rückwärts   |
| `←` `→` / `A` `D`| Lenken                |

Auf Smartphone/Tablet erscheinen Touch-Buttons.

## Spielprinzip

- **Asphalt** = schnell (bis ~60 km/h), **Gras/Feldweg** = gedrosselt und zäh.
- Fahr von Dorf zu Dorf – der Name des nächsten Orts wird oben angezeigt.
- Häuser blockieren den Weg, die zurückgelegte Strecke wird gezählt.
- Unten rechts zeigt die Minikarte das ganze Straßennetz und deine Position.

## Aufbau

- `index.html` – Grundgerüst, HUD, Startbildschirm
- `style.css`  – Layout & HUD-Design
- `game.js`    – Welt, Fahrphysik, Rendering, Sound (Vanilla JS, Canvas 2D)

Alles in reinem HTML/CSS/JavaScript ohne externe Abhängigkeiten.
