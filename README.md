# 🛵 Simson Tour

Ein kleines Browser-Spiel: Fahr mit einer **Simson S51** über Landstraßen
durch eine Welt mit mehreren Dörfern. Top-Down-Ansicht, einfache Fahrphysik,
prozedural platzierte Häuser und Bäume, Tacho, Minikarte und ein
Zweitakt-Motorsound aus dem Browser.

## Spielen (Solo)

Keine Installation, kein Build nötig – einfach `index.html` im Browser öffnen
und auf **„Allein losfahren"** klicken.

## Mehrspielermodus

Für gemeinsames Spielen läuft ein kleiner WebSocket-Server, der zugleich das
Spiel ausliefert und Räume per **Zugangscode** verwaltet.

```bash
npm install      # einmalig: Abhängigkeit (ws) installieren
npm start        # Server starten -> http://localhost:8080
```

1. Alle öffnen `http://localhost:8080` (im selben Netzwerk:
   `http://<IP-des-Hosts>:8080`).
2. Ein Spieler trägt seinen Namen ein und klickt **„Raum erstellen"** –
   er bekommt einen 4-stelligen Code (z. B. `CQGS`).
3. Die anderen tragen Namen + Code ein und klicken **„Beitreten"**.
4. Alle fahren in derselben Welt; Mitspieler erscheinen mit Namensschild,
   oben links steht der Raumcode und die Anzahl der Fahrer.

Der Port lässt sich über `PORT=3000 npm start` ändern. Für Spiel über das
Internet muss der Server erreichbar sein (z. B. auf einem kleinen Hoster
deployen oder einen Tunnel wie `ngrok` nutzen).

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
- `game.js`    – Welt, Fahrphysik, Rendering, Sound, Mehrspieler-Client (Vanilla JS, Canvas 2D)
- `server.js`  – WebSocket-Server: liefert die Dateien aus und verwaltet Räume
- `package.json` – Start-Skript und die einzige Abhängigkeit (`ws`)

Der Client (HTML/CSS/JS) hat keine externen Abhängigkeiten; nur der optionale
Mehrspieler-Server nutzt das `ws`-Paket.
