# Stappenteller — Cockpit Framework PWA

GPS-stappenteller voor Samsung Flip 6 (en andere Android-toestellen).
Gebouwd als Progressive Web App op het Cockpit Framework.

## Functies

- **GPS stappentelling** via Haversine-formule (afgelegde afstand → stappen)
- **Paslengte-correctie** — GPS meet paslengte (2 stappen); instelling is staplengte
- **5-fix mediaanfilter** — jitter en dansende GPS-signalen worden weggemiddeld
- **Snelheidsvenster** — alleen wandeltempo telt: min 0.37 m/s · max 1.944 m/s (7 km/u)
- **Dagdoel** — voortgangsbalk naar 10.000 stappen
- **Audio keepalive** — onhoorbare WAV-loop + MediaSession API zodat Android Chrome actief blijft
- **Zwarte doos** — sessie-snapshot elke 3 seconden in localStorage; automatisch herstel na crash
- **Wake Lock** — houdt CPU wakker zolang scherm open staat
- **Volledig offline** via Service Worker (cache-first)
- **Instelbare staplengte** (0.30 m – 1.20 m) via Config-tab

## Bediening

| Knop | Wat er gebeurt |
|---|---|
| **▶ START METING** | Sessie starten, audio keepalive aan |
| **⏸ PAUZE** | Meting pauzeren, pauzetijd wordt bijgehouden |
| **▶ HERVAT** | Meting hervatten vanaf huidige positie |
| **■ STOP & RESET** | Sessie stoppen en naar nul wissen |

De **▶ START / ⏸ PAUZE / ▶ HERVAT** knop is één wisselknop die automatisch
de juiste toestand toont. STOP & RESET staat er apart onder.

## Filterketen (in volgorde)

```
Ruwe GPS fix
  → Filter 1: Accuratesse > 50m           → weggooien
  → Filter 2: Fix-afstand > 150m          → teleport, weggooien
  → Accumuleer afstand over meerdere fixes tot ≥ 5m
  → Filter 3: Snelheid < 0.37 m/s         → stilstand, reset
  → Filter 4: Snelheid > 1.944 m/s        → te snel, reset
  → Stappen berekenen over geaccumuleerde afstand
```

**Waarom accumulatie?**
Bij GPS-fix elke 1-3s legt een wandelaar per fix slechts 0.5-2m af.
Snelheid meten over zo'n korte afstand is onbetrouwbaar door GPS-jitter.
Door fixes op te tellen tot 5m, wordt de snelheid berekend over een
stabiel venster van 6-15 seconden — veel nauwkeuriger.

**Stap-berekening:**
```
Paslengte  = staplengte × 2       (bijv. 0.67m × 2 = 1.34m)
Passen     = round(afstand / paslengte)
Stappen    = passen × 2
```

## Live gebruiken (GitHub Pages)

1. Upload alle bestanden naar een GitHub repository
2. Ga naar **Settings → Pages → Deploy from branch → main**
3. Open `https://jouwgebruikersnaam.github.io/stappenteller-pwa/` in Chrome
4. Tik op de drie puntjes → **"Toevoegen aan startscherm"**

De app werkt nu als geïnstalleerde PWA, volledig offline beschikbaar.

## Bestandsstructuur

```
stappenteller-pwa/
├── index.html          ← App-shell + tab-HTML       (app-specifiek)
├── logic.js            ← Stappenteller-logica v4.0  (app-specifiek)
├── app.js              ← UI-engine + GPS-bus         (framework)
├── cockpit-master.css  ← Design tokens + layout      (framework)
├── sw.js               ← Service Worker              (framework)
├── manifest.json       ← PWA-manifest                (app-specifiek)
├── icon-192.png        ← App-icoon 192×192
└── icon-512.png        ← App-icoon 512×512
```

Bij een update van de **logica**: vervang alleen `logic.js`.  
Bij een update van het **framework**: vervang `app.js`, `cockpit-master.css` en `sw.js`.  
`index.html` en `manifest.json` blijven normaal ongewijzigd.

## Beperkingen achtergrond-GPS

Bij een dichtgeklapt scherm stopt GPS zodra Android de browser-tab suspendeert.
De audio keepalive (MediaSession) en Wake Lock verlengen de actieve tijd maar
geven geen harde garantie. Voor continue meting bij gesloten scherm is een
native Android-app met Foreground Service de enige betrouwbare oplossing.

## Gebouwd met

HTML5 · CSS3 · Vanilla JS · Haversine · Web Audio API · MediaSession API ·
Wake Lock API · Geolocation API · Service Worker · localStorage
