# 🛵 Simson Tour

Ein kleines Browser-Spiel: Fahr mit einer **Simson S51** über Landstraßen
durch eine Welt mit mehreren Dörfern. Top-Down-Ansicht, einfache Fahrphysik,
prozedural platzierte Häuser und Bäume, Tacho, Minikarte und ein
Zweitakt-Motorsound aus dem Browser.

## Spielen (Solo)

Keine Installation, kein Build nötig – einfach `index.html` im Browser öffnen
und auf **„Allein losfahren"** klicken.

## Ansicht & Pause-Menü

- **Ansicht wechseln:** Taste `V` oder der 👁️-Button – zwischen
  **Vogelperspektive** (Top-Down) und **Ego-Perspektive** (First Person).
- **Pause:** Taste `P` / `Esc` oder der ⏸️-Button öffnet das Menü
  (Weiter, Ansicht wechseln, zurück zum Hauptmenü).

## Mehrspielermodus (weltweit, nur per Code)

Der Mehrspielermodus läuft **serverlos über PeerJS** (Browser-zu-Browser via
den kostenlosen PeerJS-Broker). Es ist **kein eigener Server nötig** und kein
gemeinsames Netzwerk – ein Zugangscode genügt. Das passt zu statischem Hosting
wie **Vercel**, das keine dauerhaften WebSocket-Verbindungen ausführen kann.

1. Spiel öffnen (lokal `index.html` oder die deployte URL).
2. Ein Spieler gibt seinen Namen ein und klickt **„Raum erstellen"** –
   er bekommt einen 4-stelligen Code (z. B. `CQGS`).
3. Die anderen tragen Namen + Code ein und klicken **„Beitreten"** –
   von überall auf der Welt.
4. Alle fahren in derselben Welt; Mitspieler erscheinen mit Namensschild,
   oben links stehen Raumcode und Fahrerzahl.

Der **Host** ist die Drehscheibe (Sterntopologie) und leitet die Positionen an
alle weiter – er sollte währenddessen online bleiben.

### Auf Vercel deployen

Das Repo ist als **statische Seite** konfiguriert (`vercel.json`). Einfach das
Repository mit Vercel verbinden – es werden `index.html`, `style.css` und
`game.js` ausgeliefert, PeerJS kommt per CDN dazu. Es ist **kein** Build und
**kein** Server-Prozess nötig.

> Hinweis: Wird per **Code** verbunden, nicht über das Netzwerk – funktioniert
> also auch außerhalb des eigenen WLANs.

### Optional: eigener Server (Selbst-Hosting)

`server.js` enthält weiterhin einen kleinen WebSocket-Server für reines
Selbst-Hosting im eigenen Netzwerk (`npm install && npm start`). Für Vercel
und „weltweit per Code" wird er **nicht** benutzt – dort übernimmt PeerJS.

## Steuerung

| Taste            | Aktion                |
|------------------|-----------------------|
| `↑` / `W`        | Gas geben             |
| `↓` / `S`        | Bremsen / rückwärts   |
| `←` `→` / `A` `D`| Lenken                |
| `H` / `Leertaste`| Hupe                  |
| `Q` / `E`        | Blinker links/rechts  |
| `V`              | Ansicht wechseln (Top-Down / Ego) |
| `P` / `Esc`      | Pause-Menü            |
| `T`              | Abschleppen lassen (zur nächsten Tankstelle) |

Auf Smartphone/Tablet erscheinen Touch-Buttons.

## Spielprinzip

- **Asphalt** = schnell (bis ~60 km/h), **Gras/Feldweg** = gedrosselt und zäh.
- **Paket-Aufträge:** Hol ein Paket im Startdorf ab und liefere es ins Zieldorf
  für **Geld**. Ein Pfeil am Bildschirmrand und ein grüner Ring auf der Karte
  zeigen dir das aktuelle Ziel.
- **Tank & Tankstellen:** Fahren verbraucht Sprit. Bei leerem Tank geht der
  Motor aus – halte an einer **⛽ Tankstelle** (blaue Dörfer) langsam an, um
  automatisch nachzutanken.
- **Abschleppen:** Bleibst du liegen (z. B. leerer Tank), drücke `T` oder nutze
  den Button im Pause-Menü – ein 🪝 Abschleppwagen zieht dich zur nächsten
  Tankstelle und tankt voll.
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

- `index.html` – Grundgerüst, HUD, Start- und Pause-Menü
- `style.css`  – Layout & HUD-Design
- `game.js`    – Welt, Fahrphysik, Top-Down- & Ego-Rendering, Sound,
  PeerJS-Mehrspieler (Vanilla JS, Canvas 2D)
- `vercel.json` – statisches Hosting auf Vercel
- `server.js` / `package.json` – optionaler WebSocket-Server fürs Selbst-Hosting

Der Client nutzt nur **PeerJS** (per CDN) für den Mehrspielermodus; sonst keine
externen Abhängigkeiten.
