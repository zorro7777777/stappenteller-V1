/* ═══════════════════════════════════════════════════════════════
   APP.JS  —  Cockpit Framework  v2.0
   Universele UI-engine — NIET aanpassen per app

   NIEUW IN v2.0  (achtergrond-GPS voor Samsung Flip 6):
     Wake Lock API      — houdt CPU wakker zolang scherm open is
     Visibility recovery — herstart GPS + lock bij heropen
     SW postMessage     — GPS fix cachen in SW, terugsturen na heropen
     Stille notificatie  — optioneel foreground-service trick (Android)

   EERLIJKE BEPERKING:
     navigator.geolocation is NIET beschikbaar in Service Workers.
     Bij dichtgeklapt scherm stopt meting zodra Android tab suspendeert.
     Onderstaande technieken maximaliseren kans op continuiteit maar
     geven geen harde garantie.

   INTERFACE VOOR logic.js (ongewijzigd):
     GPS_BUS.onFix(lat, lng, accuracy, raw)
     GPS_BUS.onError(code, message)
     APP.onTabChange(viewId)
     APP.gps  { lat, lng, accuracy, hasfix, timestamp }
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const GPS_BUS = {
  _fixCallbacks: [], _errorCallbacks: [],
  onFix  (fn) { this._fixCallbacks.push(fn);   return this; },
  onError(fn) { this._errorCallbacks.push(fn); return this; },
  _emitFix  (lat,lng,acc,raw) { this._fixCallbacks.forEach(fn=>fn(lat,lng,acc,raw)); },
  _emitError(code,msg)        { this._errorCallbacks.forEach(fn=>fn(code,msg)); }
};

const APP = {
  gps: { lat:null, lng:null, accuracy:null, hasfix:false, timestamp:null, closedAt:null },
  onTabChange: (_v) => {}
};

/* ── WAKE LOCK ───────────────────────────────────────────────────
   'screen' wake lock houdt de CPU wakker zolang scherm open is.
   Bij dichtklappen geeft Android de lock automatisch vrij.
   Bij heropen (visibilitychange) vragen we hem opnieuw aan.
   ─────────────────────────────────────────────────────────────── */
let _wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    console.warn('[WakeLock] Niet ondersteund.'); _updateWakeLockUI(false); return;
  }
  try {
    _wakeLock = await navigator.wakeLock.request('screen');
    _wakeLock.addEventListener('release', () => {
      console.log('[WakeLock] Vrijgegeven (scherm dicht of tab verborgen).');
      _updateWakeLockUI(false); _wakeLock = null;
    });
    console.log('[WakeLock] Actief.'); _updateWakeLockUI(true);
  } catch (e) {
    console.warn('[WakeLock] Mislukt:', e.message); _updateWakeLockUI(false);
  }
}

function _updateWakeLockUI(active) {
  const el = document.getElementById('wake-lock-indicator');
  if (el) el.style.opacity = active ? '1' : '0.35';
}

/* ── VISIBILITY CHANGE — herstel bij heropen ────────────────────
   Zodra de tab/app terugkomt:
     1. Hernieuw Wake Lock
     2. Herstart GPS watchPosition
     3. Vraag SW om gecachte fix
   ─────────────────────────────────────────────────────────────── */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    console.log('[Visibility] Tab actief — herstel.');
    if (_wakeLock === null) await requestWakeLock();
    _startGps();
    if (_swReg?.active) _swReg.active.postMessage({ type: 'GET_LAST_FIX' });
  } else {
    console.log('[Visibility] Tab verborgen — lock wordt vrijgegeven door browser.');
    /* Stuur TAB_HIDDEN naar SW zodat die het sluitingstijdstip bijhoudt.
       De SW gebruikt dit later voor de crow-flies re-sync berekening.    */
    const ts = Date.now();
    APP.gps.closedAt = ts;  /* ook lokaal bijhouden als backup */
    if (_swReg?.active) _swReg.active.postMessage({ type: 'TAB_HIDDEN', timestamp: ts });
  }
});

/* ── STILLE NOTIFICATIE (optioneel) ─────────────────────────────
   Op sommige Samsung One UI / Android versies dwingt een zichtbare
   notificatie Chrome in een Foreground Service, wat het proces
   langer levend houdt bij een dichtgeklapt scherm.
   Activeer via: await requestSilentNotification() in de bootstrap.
   ─────────────────────────────────────────────────────────────── */
async function requestSilentNotification() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    console.warn('[Notificatie] Toestemming geweigerd.'); return;
  }
  _swReg?.active?.postMessage({ type: 'SHOW_SILENT_NOTIFICATION' });
  console.log('[Notificatie] Verzoek gestuurd naar SW.');
}

function closeSilentNotification() {
  _swReg?.active?.postMessage({ type: 'CLOSE_SILENT_NOTIFICATION' });
}

/* ── GPS ENGINE ─────────────────────────────────────────────────
   watchPosition met enableHighAccuracy.
   maximumAge:5000 = accepteer een fix die max 5s oud is (batterijvriendelijk).
   timeout:15000   = wacht max 15s op een nieuwe fix.
   Herstart automatisch bij timeout (code 3).
   ─────────────────────────────────────────────────────────────── */
const _GPS_OPTS = { enableHighAccuracy:true, timeout:15000, maximumAge:5000 };
const _GPS_ERR  = { 1:'TOESTEMMING GEWEIGERD', 2:'POSITIE NIET BESCHIKBAAR', 3:'GPS TIMEOUT...' };

let _watchId = null, _gpsTimer = null;

function _startGps() {
  if (!navigator.geolocation) { _updateGpsHeaderError('GPS NIET ONDERSTEUND'); return; }
  if (_watchId !== null) { navigator.geolocation.clearWatch(_watchId); _watchId = null; }
  _watchId = navigator.geolocation.watchPosition(_onGpsSuccess, _onGpsError, _GPS_OPTS);
  console.log('[GPS] watchPosition gestart, id:', _watchId);
}

function _onGpsSuccess(pos) {
  const { latitude:lat, longitude:lng, accuracy:acc } = pos.coords;
  const ts = pos.timestamp;
  APP.gps = { lat, lng, accuracy:acc, hasfix:true, timestamp:ts };
  _updateGpsHeader(lat, lng, acc);
  /* Stuur fix naar SW — SW cachet en kan terugsturen na heropen */
  _swReg?.active?.postMessage({ type:'GPS_FIX', lat, lng, accuracy:acc, timestamp:ts });
  GPS_BUS._emitFix(lat, lng, acc, pos);
}

function _onGpsError(err) {
  const msg = _GPS_ERR[err.code] || 'GPS FOUT';
  APP.gps.hasfix = false;
  _updateGpsHeaderError(msg);
  GPS_BUS._emitError(err.code, msg);
  if (err.code === 3) {
    if (_gpsTimer) clearTimeout(_gpsTimer);
    _gpsTimer = setTimeout(() => { console.log('[GPS] Herstart na timeout.'); _startGps(); }, 3000);
  }
}

/* ── GPS HEADER ──────────────────────────────────────────────── */
function _updateGpsHeader(lat, lng, acc) {
  const c = document.getElementById('coords-display');
  const a = document.getElementById('accuracy-display');
  const p = document.getElementById('gps-pulse');
  if (c) c.innerText = lat.toFixed(5)+'N  '+lng.toFixed(5)+'E';
  if (a) { a.innerText = '(+-'+Math.round(acc)+'m)';
           a.style.color = acc<25 ? 'var(--home-blue)' : acc<100 ? 'var(--warn-orange)' : 'var(--danger-red)'; }
  if (p) { p.style.background='var(--glow-green)'; p.classList.add('blink','online'); }
}
function _updateGpsHeaderError(msg) {
  const c=document.getElementById('coords-display');
  const a=document.getElementById('accuracy-display');
  const p=document.getElementById('gps-pulse');
  if (c) c.innerText=msg;
  if (a) { a.innerText=''; a.style.color=''; }
  if (p) { p.style.background='var(--danger-red)'; p.classList.remove('online'); }
}

/* ── SERVICE WORKER ──────────────────────────────────────────── */
let _swReg = null;

async function _registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    _swReg = await navigator.serviceWorker.register('./sw.js');
    console.log('[SW] Geregistreerd:', _swReg.scope);
    navigator.serviceWorker.addEventListener('message', _onSwMessage);
  } catch (e) { console.warn('[SW] Mislukt:', e); }
}

function _onSwMessage(event) {
  const msg = event.data; if (!msg) return;
  if (msg.type === 'LAST_FIX' && msg.lat && !APP.gps.hasfix) {
    console.log('[SW->UI] Gecachte fix ontvangen:', msg.lat, msg.lng);
    APP.gps = { lat:msg.lat, lng:msg.lng, accuracy:msg.accuracy||999, hasfix:true, timestamp:msg.timestamp||Date.now() };
    _updateGpsHeader(msg.lat, msg.lng, msg.accuracy||999);
    GPS_BUS._emitFix(msg.lat, msg.lng, msg.accuracy||999, null);
  }
}

/* ── TAB SWITCHING ───────────────────────────────────────────── */
function showView(viewId, navEl) {
  document.querySelectorAll('.instrument-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const panel = document.getElementById('view-'+viewId);
  if (panel) panel.classList.add('active');
  if (navEl) navEl.classList.add('active');
  APP.onTabChange(viewId);
}

function setInfoLang(lang, btn) {
  document.querySelectorAll('.info-block').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.info-lang-btn').forEach(b=>b.classList.remove('active'));
  const block = document.getElementById('info-'+lang);
  if (block) block.classList.add('active');
  if (btn)   btn.classList.add('active');
}

function _updateZoneDisplay() {
  const el = document.getElementById('zone-display'); if (!el) return;
  const h = (-new Date().getTimezoneOffset())/60;
  el.innerText = 'ZONE: UTC'+(h>=0?'+':'')+h;
}

function _autoNavGrid() {
  const nav=document.querySelector('.cockpit-nav'), items=document.querySelectorAll('.nav-item');
  if (nav&&items.length) nav.style.gridTemplateColumns=`repeat(${items.length},1fr)`;
}

document.addEventListener('contextmenu', e=>e.preventDefault());

/* ── BOOTSTRAP ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  _autoNavGrid();
  _updateZoneDisplay();
  setInterval(_updateZoneDisplay, 10000);

  await _registerSW();     /* 1. SW eerste — GPS_FIX kan direct door */
  await requestWakeLock(); /* 2. Wake Lock */
  _startGps();             /* 3. GPS engine */

  /* 4. Stille notificatie — optioneel, verwijder commentaar om te activeren.
        VRAAGT TOESTEMMING — alleen inschakelen als gebruiker dat begrijpt.    */
  // await requestSilentNotification();

  if (typeof LOGIC_INIT === 'function') LOGIC_INIT(); /* 5. logic.js */
});
