# Stappenteller — Cockpit Framework PWA

GPS-stappenteller voor Samsung Flip 6 (en andere Android-toestellen).
Gebouwd als Progressive Web App op het Cockpit Framework.

## Functies

- **GPS Doppler stappentelling** via `pos.coords.speed` — interne GPS-chipsnelheid,
  veel stabieler dan positieverandering (geen last van GPS-jitter)
- **Calorieënmeting** via ACSM-formule met MET-tabel op basis van wandelsnelheid
- **Instelbaar lichaamsgewicht** voor nauwkeurige calorie-berekening
- **Snelheidsvenster** — alleen wandeltempo telt: 2.5 – 7.0 km/u
- **3-seconden bewegingsbevestiging** — voorkomt valse start bij GPS-opstart
- **Dagdoel** — voortgangsbalk naar 10.000 stappen + dagelijkse kcal
- **Audio keepalive** — onhoorbare WAV-loop + MediaSession API zodat Android
  Chrome actief blijft (behandeld als mediaspeler, zoals Spotify)
- **Zwarte doos** — sessie-snapshot elke 3 seconden in localStorage;
  automatisch herstel na crash inclusief calorieën
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

De **▶ START / ⏸ PAUZE / ▶ HERVAT** knop is één wisselknop.
**STOP & RESET** staat er apart onder en wist de volledige sessie.

## Hoe stappen worden geteld (v5.0)

```
pos.coords.speed  (m/s)  ← GPS-chip Doppler-snelheid, intern gefilterd
  → Filter 1: GPS-accuratesse > 20m          → fix negeren
  → Filter 2: snelheid < 2.5 km/u           → stilstand, niet tellen
  → Filter 3: snelheid > 7.0 km/u           → te snel, niet tellen
  → Filter 4: moveSeconds < 3               → wacht op bevestiging
  → stappen += (speed_m/s ÷ staplengte_m) × delta_seconden
```

**Waarom Doppler en niet positieverandering?**
Bij wandeltempo (~1 m/s) legt een wandelaar per GPS-fix (~1s) slechts
~1 meter af. GPS-jitter bedraagt ook ~1-2 meter — de ruis is even groot
als het signaal. `pos.coords.speed` is de Doppler-snelheid die de GPS-chip
intern berekent over meerdere satellietcycli. Die is immuun voor
positionele jitter en geeft een stabiele, nauwkeurige snelheidsmeting.
Dit is dezelfde methode als de bewezen WaypointAssistent-app.

## Calorieënberekening

```
MET-tabel (wandelen):
  < 1.5 km/u → MET 1.0  (stilstand)
  < 4.0 km/u → MET 3.0  (rustig wandelen)
  < 5.5 km/u → MET 3.5  (normaal wandelen)
  > 5.5 km/u → MET 4.5  (stevig wandelen)

Formule (ACSM):
  kcal/min = MET × gewicht_kg × 3.5 / 200
```

Stel gewicht in via de **Config-tab**. Standaard: 75 kg.

## Config-tab

| Instelling | Standaard | Bereik |
|---|---|---|
| Staplengte | 0.67 m | 0.30 – 1.20 m |
| Lichaamsgewicht | 75 kg | 30 – 250 kg |

Beide instellingen worden bewaard in localStorage en herladen bij herstart.

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
├── logic.js            ← Stappenteller-logica v5.0  (app-specifiek)
├── app.js              ← UI-engine + GPS-bus         (framework)
├── cockpit-master.css  ← Design tokens + layout      (framework)
├── sw.js               ← Service Worker              (framework)
├── manifest.json       ← PWA-manifest                (app-specifiek)
├── icon-192.png        ← App-icoon 192×192
└── icon-512.png        ← App-icoon 512×512
```

Bij een update van de **logica**: vervang alleen `logic.js` en `index.html`.  
Bij een update van het **framework**: vervang `app.js`, `cockpit-master.css` en `sw.js`.  
`manifest.json` blijft normaal ongewijzigd.

## Beperkingen achtergrond-GPS

Bij een dichtgeklapt scherm stopt GPS zodra Android de browser-tab suspendeert.
De audio keepalive (MediaSession) en Wake Lock verlengen de actieve tijd maar
geven geen harde garantie. Voor continue meting bij gesloten scherm is een
native Android-app met Foreground Service de enige betrouwbare oplossing.

## Versiegeschiedenis

| Versie | Methode | Probleem |
|---|---|---|
| v1–v3 | Haversine positieverandering | Jitter te groot bij wandeltempo |
| v4.0 | Accumulatie 5m-venster | Snelheidsfilter blokkeerde te veel |
| **v5.0** | **GPS Doppler `coords.speed`** | **Stabiel, bewezen methode** |

## Gebouwd met

HTML5 · CSS3 · Vanilla JS · Web Audio API · MediaSession API ·
Wake Lock API · Geolocation API (Doppler speed) · Service Worker · localStorage
