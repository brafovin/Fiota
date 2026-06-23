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
| `H` / `Leertaste`| Hupe                  |
| `Q` / `E`        | Blinker links/rechts  |

Auf Smartphone/Tablet erscheinen Touch-Buttons.

## Spielprinzip

- **Asphalt** = schnell (bis ~60 km/h), **Gras/Feldweg** = gedrosselt und zäh.
- **Paket-Aufträge:** Hol ein Paket im Startdorf ab und liefere es ins Zieldorf
  für **Geld**. Ein Pfeil am Bildschirmrand und ein grüner Ring auf der Karte
  zeigen dir das aktuelle Ziel.
- **Tank & Tankstellen:** Fahren verbraucht Sprit. Bei leerem Tank geht der
  Motor aus – halte an einer **⛽ Tankstelle** (blaue Dörfer) langsam an, um
  automatisch nachzutanken.
- **Verkehr:** NPC-Autos fahren auf den Straßen und halten an roten Ampeln.
- **Ampeln:** An großen Kreuzungen stehen Ampeln. Bei Rot durchrauschen kostet
  **10 €**.
- **Outfits:** Wähle vor dem Start dein Fahrer-Outfit (Klassik, Förster, Post, Nacht).
- **Simson-Modelle:** Wähle dein Modell (S51, Schwalbe, S70, SR50) – jedes mit
  eigenem Tempo und eigener Beschleunigung.
- **Tag/Nacht:** Ein voller Tag vergeht in ~4 Minuten. Nachts beleuchten dein
  Scheinwerfer und die Dorflaternen die Umgebung.
- **Wetter:** Es kann anfangen zu regnen – dann wird die Straße rutschig
  (weniger Grip, etwas langsamer).
- **Hupe & Blinker:** `H` / `Leertaste` für die Hupe, `Q` / `E` für die Blinker.
- **Highscore:** Bestes Guthaben und weiteste Strecke werden lokal gespeichert
  und auf dem Startbildschirm angezeigt.
- **11 Dörfer** auf einer großen Karte, verbunden durch ein Straßennetz.
- Unten rechts zeigt die Minikarte das ganze Netz, Tankstellen, dein Ziel und
  deine Position.

## Aufbau

- `index.html` – Grundgerüst, HUD, Startbildschirm
- `style.css`  – Layout & HUD-Design
- `game.js`    – Welt, Fahrphysik, Rendering, Sound (Vanilla JS, Canvas 2D)

Alles in reinem HTML/CSS/JavaScript ohne externe Abhängigkeiten.
