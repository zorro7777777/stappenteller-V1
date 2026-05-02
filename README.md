# Stappenteller — Cockpit Framework PWA

GPS-stappenteller voor Samsung Flip 6 (en andere Android-toestellen).
Gebouwd als Progressive Web App op het [Cockpit Framework](https://github.com/jouwgebruikersnaam/cockpit-framework).

## Functies

- **GPS stappentelling** via Haversine-formule (afstand → stappen)
- **Dagdoel** — voortgangsbalk naar 10.000 stappen
- **Audio keepalive** — onhoorbare WAV-loop + MediaSession API zodat Android Chrome actief blijft (zoals Spotify)
- **Crow-flies re-sync** — bij heropen na dichtklappen schat de app de gemiste stappen via vogelvlucht
- **Zwarte doos** — sessie-snapshot elke 3 seconden in localStorage; automatisch herstel na crash
- **Wake Lock** — houdt CPU wakker zolang scherm open staat
- **Volledig offline** via Service Worker (cache-first)
- **Instelbare staplengte** (0.30m – 1.50m) via Config-tab

## Live gebruiken (GitHub Pages)

1. Fork of upload deze repo naar GitHub  
2. Ga naar **Settings → Pages → Deploy from branch → main**  
3. Open `https://jouwgebruikersnaam.github.io/stappenteller-pwa/` in Chrome op je telefoon  
4. Tik op de drie puntjes → **"Toevoegen aan startscherm"**

De app werkt nu als geïnstalleerde PWA.

## Bestandsstructuur

```
stappenteller-pwa/
├── index.html          ← App-shell + tab-HTML (app-specifiek)
├── logic.js            ← Stappenteller-logica (app-specifiek)
├── app.js              ← UI-engine + GPS-bus (framework, niet aanpassen)
├── cockpit-master.css  ← Design tokens + layout (framework, niet aanpassen)
├── sw.js               ← Service Worker (framework, niet aanpassen)
├── manifest.json       ← PWA-manifest (app-specifiek naam/beschrijving)
├── icon-192.png        ← App-icoon 192×192
└── icon-512.png        ← App-icoon 512×512
```

**Gouden regel:** alleen `index.html`, `logic.js` en `manifest.json` zijn app-specifiek.
De overige bestanden zijn identiek aan het framework en mogen worden vervangen bij een framework-update.

## Beperkingen achtergrond-GPS

Bij een dichtgeklapt scherm stopt GPS zodra Android de browser-tab suspendeert.
De audio keepalive en stille notificatie (optioneel) verlengen de actieve tijd maar geven geen garantie.
Voor continue meting bij gesloten scherm is een native Android-app met Foreground Service vereist.

## Framework updaten

Vervang `app.js`, `cockpit-master.css` en `sw.js` met de nieuwe versies uit het cockpit-framework.
`index.html`, `logic.js` en `manifest.json` blijven ongewijzigd.

## Gebouwd met

- HTML5 · CSS3 · Vanilla JS · Canvas API
- Web Audio API · MediaSession API · Wake Lock API
- Geolocation API · Service Worker · localStorage
- [Nominatim / OpenStreetMap](https://nominatim.org) voor geo-reverse
