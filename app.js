/* Wörtli-Frosch – Französisch-Wörter lernen mit Léo, dem Frosch (6. Klasse, Schweiz).
   Eine Seite, kein Framework. Wörter aus daten.js, Lernlogik aus lernen.js, Fortschritt auf dem Gerät (localStorage).
   Gleich aufgebaut wie Wörtli-Panda; neu: zwei Wortlisten je Unit (Vocabulaire / Vocabulaire plus), Akzente, Stickeralbum. */
(() => {
'use strict';
const L = window.Lernen;
const D = window.DATEN;
const WORD = Object.fromEntries(D.woerter.map(w => [w.id, w]));
const STICKER = Object.fromEntries(D.stickers.map(s => [s.id, s]));
const img = name => `img/${name}.webp`;
const isPlus = l => /plus/i.test(l.teil);
const UNITS = [...new Set(D.listen.map(l => l.unit))].map(n => {
  const ls = D.listen.filter(l => l.unit === n);
  return { n, lists: ls, aktiv: ls.some(l => l.aktiv), titel: ls[0].titel, thema: ls[0].thema, farbe: ls[0].farbe };
});
const UNIT = Object.fromEntries(UNITS.map(u => [u.n, u]));
const TEILE = [['grund', 'Vocabulaire'], ['plus', 'Vocabulaire plus'], ['beide', 'Beides']];

/* ================================================================ Speicher */
const KEY = 'woertlifrosch.v1';
const DEFAULTS = { name: '', length: 10, hilfe: 'auto', testLength: 0, voice: true, autoplay: true, sounds: true };
let S = load();
function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* privates Fenster o. Ä. */ }
  d = d && typeof d === 'object' ? d : {};
  const firstActive = (UNITS.find(u => u.aktiv) || UNITS[0]).n;
  const arr = (x, n) => (Array.isArray(x) ? x.filter(id => STICKER[id]).slice(0, n) : []);
  return {
    settings: Object.assign({}, DEFAULTS, d.settings || {}),
    w: d.w && typeof d.w === 'object' ? d.w : {},          // Wort-ID -> Lernstand (lernen.js)
    unit: d.unit && UNIT[d.unit] && UNIT[d.unit].aktiv ? d.unit : firstActive,
    teil: TEILE.some(t => t[0] === d.teil) ? d.teil : 'grund',
    round: d.round || 0,                                      // gezählte Runden (für »in einer späteren Runde«)
    tests: Array.isArray(d.tests) ? d.tests.slice(-20) : [],
    stickers: arr(d.stickers, 999),                           // verdiente Sticker (Reihenfolge = wann verdient)
    neu: arr(d.neu, 999),                                     // verdient, aber im Album noch nicht angeschaut
    albumSeen: !!d.albumSeen,
    hintClosed: !!d.hintClosed,
    installed: !!d.installed,
  };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* egal */ } }
const st = id => S.w[id] || L.blank();
/* Die gewählten Listen der Unit: nur Vocabulaire, nur Vocabulaire plus oder beide */
function selLists(n = S.unit, teil = S.teil) {
  const ls = UNIT[n].lists.filter(l => l.aktiv);
  const pick = teil === 'grund' ? ls.filter(l => !isPlus(l)) : teil === 'plus' ? ls.filter(isPlus) : ls;
  return pick.length ? pick : ls;
}
const listWords = ids => D.woerter.filter(w => ids.includes(w.liste));
const words = () => listWords(selLists().map(l => l.id));
const sicher = ws => ws.filter(w => st(w.id).box === L.MAX).length;
const selName = () => (S.teil === 'beide' ? 'Vocabulaire + plus' : selLists()[0].teil);
const name = () => (S.settings.name || '').trim();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const show = t => esc(t).replace(/\.\.\./g, '…');   // »...« im Schulbuch = Lücke (»entre ... et«)
const frHTML = (w, hint = true) => `${show(w.fr)}${hint && w.hinweis ? ` <small class="hint">${esc(w.hinweis)}</small>` : ''}`;

/* ================================================================== Icons */
const I = p => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  gear: I('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.1z"/>'),
  close: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  back: I('<path d="M15 18l-6-6 6-6"/>'),
  next: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  prev: I('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  speaker: I('<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  slow: I('<path d="M3 17c1.2-4.5 4.4-7 8.5-7 3.2 0 5.4 1.6 6.5 3.5"/><path d="M18 13.5l2.6-1.3c.7-.3 1.4.3 1.1 1L21 15.5"/><path d="M6 17v2M14 17v2M3 17h17"/><circle cx="17.6" cy="12" r=".5"/>'),
  abc: I('<path d="M3 17l3-9 3 9M4 14h4"/><path d="M11 8h3a2 2 0 0 1 0 4h-3V8zM11 12h3.5a2.5 2.5 0 0 1 0 5H11v-5z"/><path d="M22 9.5a3 3 0 1 0 0 5.5"/>'),
  del: I('<path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="M17 9.5l-5 5M12 9.5l5 5"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  again: I('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  share: I('<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
  install: I('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>'),
  cards: I('<rect x="3" y="6" width="13" height="15" rx="2.5"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>'),
  ear: I('<path d="M6 9a6 6 0 1 1 12 0c0 3-2 4.2-3 5.5S14 17 14 18.5a3 3 0 0 1-6 .3"/><path d="M9.5 9.5a2.5 2.5 0 1 1 5 0c0 1.6-1.6 2-1.6 3.5"/>'),
  choose: I('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><path d="M14.5 17l2 2 3.5-4"/>'),
  pencil: I('<path d="M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4z"/><path d="M14 7l3 3"/>'),
  memory: I('<rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/><path d="M6.7 6.7h.1M17.2 17.2h.1"/>'),
  test: I('<path d="M8 4h8M9 2h6v4H9z"/><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M8.5 12l2 2 4-4M8.5 18h7"/>'),
  list: I('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
  lock: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  sticker: I('<path d="M20 12V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6"/><path d="M20 12l-8 8c0-4.4 3.6-8 8-8z"/><path d="M8.5 10.5l1.2 1.2 2.6-3"/>'),
  star: I('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>'),
};
/* Lernstufe als 5 Seerosenblätter (0–5 gefüllt) */
function levelHTML(box, cls = '') {
  const b = Math.max(0, Math.min(5, box));
  return `<span class="lvl-dots ${cls} ${b >= 5 ? 'full' : ''}" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= b ? 'on' : ''}"></i>`).join('')}</span>`;
}
const LEVEL = ['neu', 'kennengelernt', 'einmal erkannt', 'erkannt – bereit zum Schreiben', 'einmal richtig geschrieben', 'sicher'];

/* ============================================================== Ton
   Stimme: MP3s aus audio/ nacheinander (Web Audio, damit auf dem iPhone nichts stockt). Geräusche: direkt erzeugt. */
const Sound = (() => {
  let ctx = null, out = null, sfxBus = null, voiceBus = null;
  const bytes = new Map();
  let bufs = new Map(), src = null, queue = [], playing = false, tok = 0;
  function make() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* alt */ }
    try { ctx = new AC(); } catch (e) { ctx = null; return null; }
    bufs = new Map();
    out = ctx.createDynamicsCompressor();
    out.threshold.value = -12; out.knee.value = 10; out.ratio.value = 4; out.attack.value = 0.003; out.release.value = 0.25;
    out.connect(ctx.destination);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 1; voiceBus.connect(out);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(out);
    return ctx;
  }
  function ready() {
    if (!ctx || ctx.state === 'closed') make();
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  }
  function drop() { stop(); if (ctx) { try { ctx.close(); } catch (e) { /* zu */ } } ctx = null; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) drop(); });
  window.addEventListener('pagehide', drop);
  ['pointerup', 'touchend', 'keydown'].forEach(ev => window.addEventListener(ev, ready, { capture: true, passive: true }));
  function fetchBytes(n) {
    if (!bytes.has(n)) bytes.set(n, fetch(`audio/${n}.mp3`).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
    return bytes.get(n);
  }
  async function buffer(n) {
    const c = ctx;
    if (!c) return null;
    if (bufs.has(n)) return bufs.get(n);
    const ab = await fetchBytes(n);
    if (!ab || c !== ctx) return null;
    try {
      const b = await new Promise((res, rej) => c.decodeAudioData(ab.slice(0), res, rej));
      if (c === ctx) bufs.set(n, b);
      return b;
    } catch (e) { return null; }
  }
  const wait = ms => new Promise(res => setTimeout(res, ms));
  function playBuf(b) {
    return new Promise(res => {
      const s = ctx.createBufferSource();
      s.buffer = b; s.connect(voiceBus);
      let done = false;
      const end = () => { if (!done) { done = true; res(); } };
      s.onended = end; src = s;
      const t0 = ctx.currentTime, c = ctx;
      s.start();
      setTimeout(end, b.duration * 1000 + 500);
      setTimeout(() => { if (c === ctx && c.currentTime === t0) drop(); }, 800);   // iOS nach dem Hintergrund
    });
  }
  function stop() { tok++; queue = []; playing = false; if (src) { try { src.stop(); } catch (e) { /* fertig */ } src = null; } }
  /* Zeilen nacheinander; append = hinten anhängen; {pause: ms} = kleine Pause */
  function say(names, append = false) {
    if (!append) stop();
    queue.push(...[].concat(names).filter(Boolean));
    if (!playing) pump();
  }
  async function pump() {
    if (!ready()) { queue = []; return; }
    playing = true;
    const my = tok;
    while (queue.length && my === tok) {
      const item = queue.shift();
      if (typeof item === 'object') { await wait(item.pause); continue; }
      const b = await buffer(item);
      if (my !== tok) return;
      if (!b) continue;
      await playBuf(b);
      if (my !== tok) return;
      await wait(40);
    }
    if (my === tok) { playing = false; src = null; }
  }
  const preload = names => names.forEach(n => typeof n === 'string' && fetchBytes(n));
  const busy = () => playing;
  const note = m => 440 * Math.pow(2, (m - 69) / 12);
  function env(g, t, a, peak, decay) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  }
  function osc(type, f, t, dur, peak, dest, a = 0.004) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); env(g, t, a, peak, dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + 0.05);
  }
  const marimba = (f, t, v = 1) => { osc('sine', f, t, 0.55, 0.3 * v, sfxBus); osc('sine', f * 3.93, t, 0.1, 0.06 * v, sfxBus, 0.002); };
  const bell = (f, t, v = 1) => { osc('sine', f, t, 1.2, 0.14 * v, sfxBus); osc('sine', f * 2.76, t, 0.55, 0.05 * v, sfxBus); };
  const PENTA = [0, 2, 4, 7, 9], step = i => 72 + 12 * Math.floor(i / 5) + PENTA[i % 5];
  const on = () => S.settings.sounds && ready();
  const sfx = {
    tap() {
      if (!on()) return;
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(1300, t); o.frequency.exponentialRampToValueAtTime(620, t + 0.045);
      env(g, t, 0.002, 0.1, 0.055); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.12);
    },
    right(streak) { if (!on()) return; const t = ctx.currentTime + 0.01, i = Math.min(Math.max(streak - 1, 0), 9); marimba(note(step(i)), t); marimba(note(step(i + 2)), t + 0.085, 0.9); },
    wrong() {
      if (!on()) return;
      const t = ctx.currentTime + 0.01;
      [[55, 0], [52, 0.15]].forEach(([m, dt]) => {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = note(m); f.type = 'lowpass'; f.frequency.value = 900;
        env(g, t + dt, 0.012, 0.22, 0.34); o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t + dt); o.stop(t + dt + 0.5);
      });
    },
    done() { if (!on()) return; const t = ctx.currentTime + 0.05, seq = [72, 76, 79, 84, 88]; seq.forEach((m, i) => marimba(note(m), t + i * 0.11, 0.85)); bell(note(100), t + 0.55, 0.8); },
    sparkle() { if (!on()) return; const t = ctx.currentTime + 0.02; [84, 88, 91, 96, 100].forEach((m, i) => bell(note(m), t + i * 0.065, 0.55)); },
    flip() { if (!on()) return; const t = ctx.currentTime; osc('triangle', 520, t, 0.08, 0.08, sfxBus); osc('triangle', 780, t + 0.05, 0.08, 0.06, sfxBus); },
    /* Sticker: kurzes »Quak-Hüpfen« nach oben, dann Glitzern */
    sticker() {
      if (!on()) return;
      const t = ctx.currentTime + 0.02, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.16);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      env(g, t, 0.01, 0.12, 0.18); o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.3);
      [88, 91, 96, 100, 103].forEach((m, i) => bell(note(m), t + 0.22 + i * 0.07, 0.5));
    },
  };
  return { say, stop, preload, sfx, ready, busy };
})();
const sfx = Sound.sfx;
const voiceOn = () => S.settings.voice;
/* Léo spricht (Lob, Hilfe) nur, wenn eingeschaltet; Wörter selbst immer, wenn man sie antippt */
function leo(names, append) { if (voiceOn()) Sound.say(names, append); }
const rnd = n => 1 + Math.floor(Math.random() * n);
const pad2 = n => String(n).padStart(2, '0');
const line = { hallo: () => `leo_hallo_${pad2(rnd(3))}`, lob: () => `leo_lob_${pad2(rnd(12))}`, fast: () => `leo_fast_${pad2(rnd(4))}`, fertig: () => `leo_fertig_${pad2(rnd(3))}`, los: () => `leo_los_${pad2(rnd(2))}` };
function sayWord(id, slow) { Sound.say(slow ? `${id}_slow` : id); }
/* Buchstabieren: die französischen Buchstabennamen nacheinander (é = »e accent aigu«), zwischen Wörtern eine Pause */
const ACC = { 'é': 'e_aigu', 'è': 'e_grave', 'ê': 'e_circ', 'ë': 'e_trema', 'à': 'a_grave', 'â': 'a_circ', 'ç': 'c_cedille',
  'î': 'i_circ', 'ï': 'i_trema', 'ô': 'o_circ', 'ù': 'u_grave', 'û': 'u_circ', "'": 'apostrophe', '-': 'tiret' };
function spell(id) {
  const parts = [];
  L.norm(WORD[id].antworten[0]).split('').forEach(c => {
    if (/[a-z]/.test(c)) parts.push(`letter_${c}`, { pause: 120 });
    else if (ACC[c]) parts.push(`letter_${ACC[c]}`, { pause: 160 });
    else if (c === ' ' || c === '/') parts.push({ pause: 450 });
  });
  Sound.say(parts);
}

/* ================================================================ Bildschirm */
const app = document.getElementById('app');
const sheetRoot = document.getElementById('sheet-root');
const fxRoot = document.getElementById('fx');
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let view = { name: 'home' };
let Q = null;           // laufende Übung
let timer = null;
let reloadPending = false;

function nav(name, params = {}, push = true) {
  closeSheet(true);
  clearTimeout(timer);
  const from = view.name;
  if (['task', 'memory'].includes(from) && !['task', 'result', 'memory'].includes(name)) { Q = null; Sound.stop(); }
  view = Object.assign({ name }, params);
  if (push) { try { history.pushState({ name }, ''); } catch (e) { /* file:// */ } }
  render();
  window.scrollTo(0, 0);
  if (from === 'karten' && name !== 'karten') stickerToast();      // in den Lernkarten verdiente Sticker zeigen
  if (name === 'home' && reloadPending) location.reload();
}
window.addEventListener('popstate', e => {
  const s = e.state || { name: 'home' };
  clearTimeout(timer);
  const from = view.name;
  if (['task', 'memory', 'result'].includes(from)) { Q = null; Sound.stop(); }
  view = ['album', 'karten'].includes(s.name) ? { name: s.name } : { name: 'home' };
  closeSheet(true);
  render();
  if (from === 'karten' && view.name !== 'karten') stickerToast();
});
function render() {
  document.body.dataset.view = view.name;
  const R = { home: homeHTML, album: albumHTML, karten: kartenHTML, result: () => resultHTML(view.res), memory: memoryHTML };
  if (view.name === 'task') { app.innerHTML = taskShellHTML(); showTask(); return; }
  app.innerHTML = R[view.name]();
  if (view.name === 'karten') afterKarte();
  if (view.name === 'album' && S.neu.length) { S.neu = []; S.albumSeen = true; save(); }
}

/* ------------------------------------------------------------- Sticker */
const allPoints = () => L.points(D.woerter, S.w);
/* Neu verdiente Sticker eintragen. ctx: { runde, test100, serie10, memory9 } aus der eben beendeten Übung */
function checkStickers(ctx = {}) {
  const neu = L.stickersEarned(D.stickers, S.stickers, allPoints());
  D.stickers.filter(s => s.art === 'glitzer' && !S.stickers.includes(s.id)).forEach(s => {
    const b = s.bedingung;
    let ok = !!ctx[b];
    if (b.startsWith('liste:')) { const ws = D.woerter.filter(w => w.liste === b.slice(6)); ok = ws.length > 0 && sicher(ws) === ws.length; }
    if (ok) neu.push(s.id);
  });
  if (neu.length) { S.stickers.push(...neu); S.neu.push(...neu); save(); }
  return neu;
}
const BEDINGUNG = { runde1: 'Die erste Runde mit Léo', test100: 'Wörtlitest ohne Fehler (ab 10 Wörtern)', serie10: '10 richtig hintereinander',
  memory9: 'Memory in höchstens 9 Zügen' };
function bedingungText(s) {
  if (s.bedingung.startsWith('liste:')) {
    const l = D.listen.find(x => x.id === s.bedingung.slice(6));
    return l ? `Alle Wörter von ${l.titel} ${l.teil} sicher` : '';
  }
  return BEDINGUNG[s.bedingung] || '';
}
function nextStickerText() {
  const n = L.toNextSticker(D.stickers, S.stickers, allPoints());
  return n == null ? 'Alle normalen Sticker gesammelt!' : `Nächster Sticker: noch ${n} ${n === 1 ? 'Lernpunkt' : 'Lernpunkte'}`;
}
function nextStickerPct() {
  const n = L.toNextSticker(D.stickers, S.stickers, allPoints());
  return n == null ? 100 : Math.round(100 * (L.PER_STICKER - n) / L.PER_STICKER);
}
/* Sticker im Rahmen; Glitzer-Sticker bekommen einen wandernden Lichtstreifen (style.css, Maske = das Bild selbst) */
const stickerImg = (id, cls = '') => `<span class="stk-wrap ${STICKER[id].art === 'glitzer' ? 'glitzer' : ''} ${cls}" style="--m:url(${img(id)})"><img class="stk" src="${img(id)}" alt="${esc(STICKER[id].de)}"></span>`;
const newStickersHTML = ids => `<div class="new-stk">${ids.slice(0, 4).map((id, i) => `<button class="new-stk-i ${STICKER[id].art === 'glitzer' ? 'glitzer' : ''}" data-act="sticker" data-id="${id}" style="--i:${i}">
  ${stickerImg(id)}<span class="stk-t" lang="fr">${esc(STICKER[id].titel)}</span></button>`).join('')}</div>`;
/* Ausserhalb einer Runde verdiente Sticker (z. B. in den Lernkarten): kurz als Blatt zeigen */
function stickerToast() {
  const neu = checkStickers();
  if (!neu.length) return;
  if (view.name === 'home') render();                              // Zähler im Album-Knopf
  setTimeout(() => {
    openSheet('sticker-neu', `<div class="sheet-head"><h2>${neu.length === 1 ? 'Neuer Sticker!' : `${neu.length} neue Sticker!`}</h2><button class="icon-btn" data-act="close-sheet" aria-label="Schliessen">${ICON.close}</button></div>
      <div class="sheet-body center">${newStickersHTML(neu)}<div class="confirm-actions"><button class="btn primary" data-act="album">${ICON.sticker}<span>Zum Album</span></button></div></div>`);
    celebrateSticker(neu);
  }, 250);
}
function celebrateSticker(ids) {
  sfx.sticker();
  leo([{ pause: 200 }, ids.some(id => STICKER[id].art === 'glitzer') ? 'leo_sticker_glitzer' : 'leo_sticker'], true);
}

/* ------------------------------------------------------------------ Start */
const MODES = [
  { k: 'karten', t: 'Lernkarten', s: 'Anschauen und anhören', ic: 'cards' },
  { k: 'hoeren', t: 'Hören', s: 'Hören und Bild wählen', ic: 'ear' },
  { k: 'waehlen', t: 'Wählen', s: 'Deutsch ↔ Französisch', ic: 'choose' },
  { k: 'schreiben', t: 'Schreiben', s: 'Richtig schreiben', ic: 'pencil' },
  { k: 'memory', t: 'Memory', s: 'Bild und Wort finden', ic: 'memory' },
  { k: 'test', t: 'Wörtlitest', s: 'Wie in der Schule', ic: 'test' },
];
function sessionPreview() {
  const tasks = L.buildSession(words(), S, { length: S.settings.length, hilfe: S.settings.hilfe, round: S.round + 1 });
  const neu = tasks.filter(t => t.kind === 'karte').length;
  return `${tasks.length} Aufgaben${neu ? ` · ${neu === 1 ? '1 neues Wort' : `${neu} neue Wörter`}` : ''}`;
}
function homeHTML() {
  const u = UNIT[S.unit], ws = words(), g = sicher(ws), nm = name();
  const hasPlus = u.lists.some(l => l.aktiv && isPlus(l)) && u.lists.some(l => l.aktiv && !isPlus(l));
  return `<div class="screen home">
    <header class="bar">
      <button class="brand" data-act="hello" aria-label="Wörtli-Frosch – Léo sagt Hallo"><img src="icons/favicon.png" alt=""><span>Wörtli-Frosch</span></button>
      <div class="bar-right">
        <button class="pill ${S.neu.length ? 'has-new' : ''}" data-act="album" aria-label="Stickeralbum: ${S.stickers.length} von ${D.stickers.length} Stickern">${ICON.sticker}<span class="pill-t">Album</span><b>${S.stickers.length}/${D.stickers.length}</b></button>
        <button class="icon-btn" data-act="settings" aria-label="Einstellungen">${ICON.gear}</button>
      </div>
    </header>
    <section class="hero">
      <button class="hero-leo" data-act="leo" aria-label="Léo antippen"><img src="${img('leo_hallo')}" alt="Léo, der Frosch, winkt"></button>
      <div class="bubble">
        <p class="bubble-hi" lang="fr">Salut${nm ? ` ${esc(nm)}` : ''} ! Moi, c'est Léo.</p>
        <p>Wir üben <b>${u.titel}</b> · ${esc(selName())}</p>
        <button class="btn primary big" data-act="start-leo"><span><b>Üben mit Léo</b><small>${sessionPreview()}</small></span>${ICON.next}</button>
        <button class="next-stk" data-act="album"><span class="next-stk-t">${ICON.sticker}${nextStickerText()}</span><span class="progress small"><i style="width:${nextStickerPct()}%"></i></span></button>
      </div>
    </section>
    <section class="unit-head" style="--u:${u.farbe}">
      <h2>${u.titel} <span>${esc(u.thema)}</span></h2>
      ${hasPlus ? `<div class="seg teil" role="radiogroup" aria-label="Wortliste">${TEILE.map(([v, l]) => `<button role="radio" aria-checked="${S.teil === v}" data-act="teil" data-v="${v}">${l}</button>`).join('')}</div>` : ''}
      <div class="progress" aria-label="${g} von ${ws.length} Wörtern sicher"><i style="width:${(100 * g / ws.length).toFixed(1)}%"></i></div>
      <p class="unit-sub">${g} von ${ws.length} Wörtern sicher · ${ws.filter(w => st(w.id).box > 0).length} angefangen</p>
    </section>
    <section class="modes">
      ${MODES.map(m => `<button class="mode" data-act="mode" data-mode="${m.k}"><span class="mode-ic">${ICON[m.ic]}</span><span class="mode-t">${m.t}</span><span class="mode-s">${m.s}</span></button>`).join('')}
    </section>
    ${UNITS.length > 1 ? `<h3 class="more-title">Weitere Units</h3>
    <section class="units">
      ${UNITS.filter(x => x.n !== S.unit).map(x => `<button class="unit-tile ${x.aktiv ? '' : 'soon'}" style="--u:${x.farbe}" data-act="unit" data-unit="${x.n}" ${x.aktiv ? '' : 'disabled'}>
        <span class="unit-n">${x.titel}</span><span class="unit-t">${esc(x.thema)}</span><span class="unit-s">${x.aktiv ? `${sicher(listWords(x.lists.map(l => l.id)))} von ${listWords(x.lists.map(l => l.id)).length} sicher` : `${ICON.lock} kommt bald`}</span></button>`).join('')}
    </section>` : ''}
    <div id="install-home">${installHomeHTML()}</div>
    <footer class="foot">Französisch 6. Klasse · Wörter aus dem Schulbuch · funktioniert auch ohne Internet</footer>
  </div>`;
}

/* ---- Als App auf den Startbildschirm (wie Wörtli-Panda) ---- */
const UA = navigator.userAgent;
const isIOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = /Android/i.test(UA);
const androidBrowser = /SamsungBrowser/i.test(UA) ? 'samsung' : /Firefox/i.test(UA) ? 'firefox' : 'chrome';
const standalone = () => !!navigator.standalone || ['standalone', 'fullscreen', 'minimal-ui'].some(m => window.matchMedia(`(display-mode: ${m})`).matches);
let installEvent = null;
window.addEventListener('beforeinstallprompt', e => { if (!isAndroid) return; e.preventDefault(); installEvent = e; refreshInstall(); });
window.addEventListener('appinstalled', () => { installEvent = null; S.installed = true; save(); refreshInstall(); });
const INSTALL_STEPS = {
  ios: 'Tippe auf <b>Teilen</b> (das Quadrat mit dem Pfeil) und dann auf <b>«Zum Home-Bildschirm»</b>.',
  chrome: 'Tippe oben rechts auf <b>⋮</b> und dann auf <b>«App installieren»</b> (oder «Zum Startbildschirm hinzufügen»).',
  samsung: 'Tippe unten auf <b>≡</b>, dann auf <b>«Seite hinzufügen zu»</b> und <b>«Startbildschirm»</b>.',
  firefox: 'Tippe auf <b>⋮</b> und dann auf <b>«Installieren»</b> (oder «Zum Startbildschirm hinzufügen»).',
};
const installable = () => (isIOS || isAndroid) && !standalone();
function installInner(where) {
  if (!installable()) return '';
  if (S.installed && !installEvent) return where === 'set' ? '<p class="set-note">Wörtli-Frosch ist schon installiert – öffne die App über das Symbol auf dem Startbildschirm.</p>' : '';
  const close = where === 'home' ? `<button class="icon-btn small" data-act="hint-close" aria-label="Tipp schliessen">${ICON.close}</button>` : '';
  if (isAndroid && installEvent) {
    return `<div class="tip ${where === 'home' ? 'card' : 'flat'}"><span class="tip-ic">${ICON.install}</span>
      <div class="tip-body"><p><b>Als App installieren:</b> Dann ist Wörtli-Frosch auf dem Startbildschirm und funktioniert auch ohne Internet.</p>
      <button class="btn primary" data-act="install">${ICON.install}<span>App installieren</span></button></div>${close}</div>`;
  }
  return `<div class="tip ${where === 'home' ? 'card' : 'flat'}"><span class="tip-ic">${isIOS ? ICON.share : ICON.install}</span>
    <div class="tip-body"><p><b>${where === 'home' ? 'Tipp' : 'So geht’s'}:</b> ${INSTALL_STEPS[isIOS ? 'ios' : androidBrowser]} Dann ist Wörtli-Frosch wie eine echte App da und funktioniert auch ohne Internet.</p></div>${close}</div>`;
}
const installHomeHTML = () => (S.hintClosed ? '' : installInner('home'));
function installSetHTML() { const i = installInner('set'); return i ? `<section class="set-group"><h3>Auf den ${isIOS ? 'Home-Bildschirm' : 'Startbildschirm'}</h3>${i}</section>` : ''; }
function refreshInstall() {
  const h = document.getElementById('install-home'); if (h) h.innerHTML = installHomeHTML();
  const s = document.getElementById('install-set'); if (s) s.innerHTML = installSetHTML();
}

/* --------------------------------------------------------------- Übungen
   Q.mode: { typ: 'leo' | 'drill' | 'test', drill } – Q.list: [{kind, id}] aus lernen.js */
const MODE_LINE = { hoeren: 'leo_modus_hoeren', waehlen: 'leo_modus_waehlen', schreiben: 'leo_modus_schreiben', test: 'leo_modus_test' };
function startTasks(mode, list, pool) {
  S.round++; save();
  Q = { mode, list, pool, i: 0, tries: 0, hinted: false, input: '', placed: [], streak: 0, maxStreak: 0, results: [], before: {}, locked: false, extra: 0 };
  pool.forEach(w => { Q.before[w.id] = st(w.id).box; });
  Q.ptsBefore = allPoints();
  Sound.preload([...new Set(list.map(t => t.id))].concat(['leo_lob_01', 'leo_lob_02', 'leo_lob_03', 'leo_fast_01', 'leo_fast_02', 'leo_loesung']));
  [...new Set(list.map(t => t.id))].forEach(id => { new Image().src = img(id); });
  nav('task');
  const intro = mode.typ === 'test' ? 'leo_modus_test' : mode.typ === 'drill' ? MODE_LINE[mode.drill] : line.los();
  leo([intro, { pause: 250 }]);
  autoSpeak(true);
}
function startLeo() { startTasks({ typ: 'leo' }, L.buildSession(words(), S, { length: S.settings.length, hilfe: S.settings.hilfe, round: S.round + 1 }), words()); }
function startDrill(kind, ids) {
  const ws = ids ? ids.map(id => WORD[id]) : words();
  const list = L.buildDrill(ws, kind, { hilfe: S.settings.hilfe, S, length: ids ? ws.length : Math.min(ws.length, 12) });
  startTasks({ typ: 'drill', drill: kind }, list, words());
}
function startTest() {
  const ws = words();
  startTasks({ typ: 'test' }, L.buildTest(ws, S.settings.testLength || ws.length), ws);
}
const cur = () => Q.list[Q.i];

function taskShellHTML() {
  const title = Q.mode.typ === 'test' ? 'Wörtlitest' : Q.mode.typ === 'leo' ? 'Üben mit Léo' : (MODES.find(m => m.k === Q.mode.drill) || {}).t;
  return `<div class="screen task" id="task">
    <header class="qbar">
      <button class="icon-btn" data-act="quit" aria-label="Beenden">${ICON.close}</button>
      <div class="qprog"><span class="qtitle">${title}</span><div class="pads" id="pads"></div></div>
      <span class="qleo"><img id="leo" src="${img('leo_denkt')}" alt=""></span>
    </header>
    <section class="qcard" id="qcard"></section>
    <div class="qfoot" id="qfoot"></div>
  </div>`;
}
function setLeo(pose) {
  const el = document.getElementById('leo');
  if (!el) return;
  el.src = img(pose);
  el.classList.remove('bounce', 'wobble'); void el.offsetWidth;
  if (!reduced()) el.classList.add(pose === 'leo_jubel' ? 'bounce' : pose === 'leo_mut' ? 'wobble' : 'x');
}
function updatePads() {
  const el = document.getElementById('pads');
  if (!el) return;
  el.innerHTML = Q.list.map((t, i) => {
    const r = Q.results[i];
    return `<i class="${i < Q.i ? (r && r.first ? 'ok' : 'help') : i === Q.i ? 'now' : ''}"></i>`;
  }).join('');
}
/* Das Wort vorlesen, wenn die Aufgabe es erlaubt (bei »Wählen Französisch« und beim Schreiben nicht – das wäre die Lösung) */
function autoSpeak(append) {
  if (!Q || !S.settings.autoplay) return;
  const t = cur();
  if (['karte', 'hoeren', 'waehlen_de'].includes(t.kind)) Sound.say([{ pause: 200 }, t.id], append);
}
const soundBtns = (id, withSpell) => `<div class="snd">
  <button class="snd-btn" data-act="say" data-id="${id}" aria-label="Anhören">${ICON.speaker}</button>
  <button class="snd-btn" data-act="say-slow" data-id="${id}" aria-label="Langsam anhören">${ICON.slow}</button>
  ${withSpell ? `<button class="snd-btn" data-act="spell" data-id="${id}" aria-label="Buchstabieren">${ICON.abc}</button>` : ''}</div>`;
const picHTML = (id, cls = '') => `<img class="pic ${cls}" src="${img(id)}" alt="">`;

function showTask() {
  const t = cur(), w = WORD[t.id], card = document.getElementById('qcard'), foot = document.getElementById('qfoot');
  Q.tries = 0; Q.hinted = false; Q.input = ''; Q.placed = []; Q.locked = false;
  setLeo('leo_denkt');
  updatePads();
  card.className = `qcard k-${t.kind}`;
  card.dataset.id = t.id;                                     // für die Browser-Tests (Scripts/browser.mjs)
  document.getElementById('task').dataset.kind = t.kind;     // für das Layout (style.css → Hören)
  foot.innerHTML = '';
  if (t.kind === 'karte') {
    card.innerHTML = `<p class="ask">Neues Wort</p>${picHTML(w.id, 'big')}
      <p class="fr" lang="fr">${frHTML(w)}</p>${soundBtns(w.id, w.typ === 'wort')}<p class="de">${esc(w.de)}</p>`;
    foot.innerHTML = `<button class="btn primary big" data-act="next" id="next-btn"><span><b>Weiter</b></span>${ICON.next}</button>`;
    return;
  }
  if (t.kind === 'hoeren') {
    const ch = L.choices(Q.pool, w);
    card.innerHTML = `<p class="ask">Hör gut zu – welches Bild passt?</p>${soundBtns(w.id, false)}
      <div class="fb" id="fb" aria-live="polite"></div>
      <div class="grid4 pics">${ch.map(c => `<button class="opt pic-opt" data-act="choice" data-id="${c.id}">${picHTML(c.id)}<span>${esc(c.de)}</span></button>`).join('')}</div>`;
    return;
  }
  if (t.kind === 'waehlen_fr') {
    const ch = L.choices(Q.pool, w);
    card.innerHTML = `<p class="ask">Wie heisst das auf Französisch?</p>${picHTML(w.id)}<p class="de big">${esc(w.de)}</p>
      <div class="fb" id="fb" aria-live="polite"></div>
      <div class="grid4 words">${ch.map(c => `<button class="opt word-opt" data-act="choice" data-id="${c.id}" lang="fr">${show(c.fr)}</button>`).join('')}</div>`;
    return;
  }
  if (t.kind === 'waehlen_de') {
    const ch = L.choices(Q.pool, w);
    card.innerHTML = `<p class="ask">Was heisst das auf Deutsch?</p><p class="fr" lang="fr">${frHTML(w)}</p>${soundBtns(w.id, false)}
      <div class="fb" id="fb" aria-live="polite"></div>
      <div class="grid4 words de-opts">${ch.map(c => `<button class="opt word-opt" data-act="choice" data-id="${c.id}">${esc(c.de)}</button>`).join('')}</div>`;
    return;
  }
  const isTest = t.kind === 'test';
  const usePuzzle = t.kind === 'puzzle' || (isTest && w.typ === 'satz');
  // Bild, deutsches Wort und Ton nebeneinander, damit Antwort und Tastatur auf denselben Bildschirm passen
  card.innerHTML = `<p class="ask">${isTest ? 'Schreib das französische Wort' : 'Schreib es auf Französisch'}</p>
    <div class="prompt">${isTest ? '' : picHTML(w.id, 'side')}<div class="prompt-t"><p class="de big">${esc(w.de)}${w.hinweis ? ` <small class="hint">${esc(w.hinweis)}</small>` : ''}</p>${isTest ? '' : soundBtns(w.id, false)}</div></div>
    <div class="answer" id="answer"></div><div class="fb" id="fb" aria-live="polite"></div>`;
  if (usePuzzle) {
    Q.puzzle = L.puzzleKind(w) === 'buchstaben' && !isTest ? Object.assign({ typ: 'b' }, L.letterPuzzle(w)) : Object.assign({ typ: 'w' }, L.wordPuzzle(w));
    renderPuzzle();
  } else {
    Q.puzzle = null;
    renderTyping();
  }
}

/* ---- Auswahl ---- */
function choose(id, btn) {
  if (!Q || Q.locked) return;
  const t = cur();
  if (id === t.id) {
    btn.classList.add('right');
    return right(t);
  }
  btn.classList.add('wrong'); btn.disabled = true;
  wrong(t, () => {
    document.querySelectorAll('#qcard [data-act="choice"]').forEach(b => { if (b.dataset.id === t.id) b.classList.add('solution'); b.disabled = true; });
  }, t.kind === 'hoeren' ? () => Sound.say(t.id, true) : null);   // beim Hören das Wort nochmals abspielen
}

/* ---- Puzzle: Buchstaben (b) oder Wörter (w) ----
   Buchstaben: je Wort eine Gruppe; feste Zeichen (' - /) stehen schon da, gelegt werden nur die Lücken.
   Bei der Lösung (zweimal falsch) fallen die Kärtchen weg – so bleibt Platz für »Weiter«, auch auf kleinen Handys.
   --n = längste Gruppe: so breit dürfen die Lücken werden (style.css → .slot). */
function renderPuzzle(state = '') {
  const p = Q.puzzle, a = document.getElementById('answer'), tiles = state !== 'solution';
  if (p.typ === 'b') {
    let k = 0;
    a.innerHTML = `<div class="slots ${state}" lang="fr" style="--n:${Math.max(...p.groups.map(g => g.length))}">${p.groups.map(g => `<span class="slot-group">${g.map(fixed => {
      if (fixed != null) return `<span class="slot fixed">${esc(fixed)}</span>`;
      const i = k++, pl = Q.placed[i];
      return `<button class="slot ${pl != null ? 'filled' : ''} ${state && Q.marks ? Q.marks[i] || '' : ''}" data-act="unplace" data-i="${i}">${pl != null ? p.tiles[pl] : ''}</button>`;
    }).join('')}</span>`).join('')}</div>
    ${tiles ? `<div class="tiles" lang="fr">${p.tiles.map((c, i) => `<button class="tile" data-act="place" data-i="${i}" ${Q.placed.includes(i) ? 'disabled' : ''}>${c}</button>`).join('')}</div>` : ''}`;
  } else {
    a.innerHTML = `<div class="line ${state}" lang="fr">${Q.placed.length ? Q.placed.map((ti, k) => `<button class="wtile placed ${state && Q.marks ? Q.marks[k] : ''}" data-act="unplace" data-i="${k}">${esc(p.tiles[ti].t)}</button>`).join('') : '<span class="line-hint">Tippe die Wörter in der richtigen Reihenfolge an</span>'}</div>
    ${tiles ? `<div class="tiles" lang="fr">${p.tiles.map((x, i) => `<button class="wtile" data-act="place" data-i="${i}" ${Q.placed.includes(i) ? 'disabled' : ''}>${esc(x.t)}</button>`).join('')}</div>` : ''}`;
  }
}
function place(i) {
  if (!Q || Q.locked || !Q.puzzle || Q.placed.includes(i)) return;
  const p = Q.puzzle, need = p.answer.length;      // Buchstaben (Text) oder Wörter (Liste)
  if (Q.placed.length >= need) return;
  Q.placed.push(i); sfx.tap(); renderPuzzle();
  if (Q.placed.length === need) checkPuzzle();
}
function unplace(i) {
  if (!Q || Q.locked || !Q.puzzle) return;
  Q.placed = Q.placed.slice(0, i); sfx.tap(); renderPuzzle();
}
function checkPuzzle() {
  const p = Q.puzzle, t = cur();
  const got = p.typ === 'b' ? Q.placed.map(i => p.tiles[i]) : Q.placed.map(i => p.tiles[i].t);
  const want = p.typ === 'b' ? p.answer.split('') : p.answer;
  const okAll = got.every((x, k) => x === want[k]);
  Q.marks = got.map((x, k) => (x === want[k] ? 'ok' : 'bad'));
  if (okAll) { renderPuzzle('right'); return right(t); }
  if (t.kind === 'test') { renderPuzzle('wrong'); Q.testAnswer = got.join(p.typ === 'b' ? '' : ' '); return wrong(t); }
  renderPuzzle('wrong');
  // nur Akzente falsch (é statt è …)?
  const accentsOnly = p.typ === 'b' && got.every((x, k) => L.bare(x) === L.bare(want[k]));
  wrong(t, () => {
    Q.placed = solveOrder(p, want);
    Q.marks = want.map(() => 'sol');
    renderPuzzle('solution');
  }, () => {
    // nochmals: nur die falschen Teile zurück in den Vorrat
    const keep = [];
    for (let k = 0; k < Q.placed.length; k++) { if (Q.marks[k] === 'ok') keep.push(Q.placed[k]); else break; }
    Q.placed = keep; Q.marks = null; renderPuzzle();
  }, accentsOnly ? ACCENT_MSG : null, accentsOnly);
}
function solveOrder(p, want) {
  const used = new Set();
  return want.map(x => {
    const i = p.tiles.findIndex((tt, k) => !used.has(k) && (p.typ === 'b' ? tt : tt.t) === x);
    used.add(i); return i;
  });
}

/* ---- Tippen (eigene Tastatur mit Akzenten, auch PC-Tastatur) ---- */
const KEYS = ['éèêàâçîôùû', 'qwertzuiop', "asdfghjkl'", 'yxcvbnm-/'];
const DIGITS = '1234567890';
const TYPEABLE = /^[a-zàâäçéèêëîïôöùûüÿœæ0-9'\-\/ ]$/;
const ACCENT_MSG = 'Fast! Achte auf die Akzente (é, è, à …).';
function renderTyping(state = '') {
  const a = document.getElementById('answer');
  a.innerHTML = `<div class="typed ${state}" lang="fr" id="typed">${Q.input ? esc(Q.input) : ''}<i class="caret"></i></div>`;
  const foot = document.getElementById('qfoot');
  if (!foot.querySelector('.kbd')) {
    const w = WORD[cur().id];
    const rows = (/[0-9]/.test(w.antworten.join('')) ? [DIGITS] : []).concat(KEYS);
    foot.innerHTML = `<div class="kbd" lang="fr">${rows.map((r, ri) => `<div class="krow ${ri === rows.length - KEYS.length ? 'acc' : ''}">${r.split('').map(c => `<button class="k" data-act="key" data-v="${c}">${c}</button>`).join('')}${ri === rows.length - 1 ? `<button class="k fn" data-act="bksp" aria-label="Löschen">${ICON.del}</button>` : ''}</div>`).join('')}
      <div class="krow"><button class="k space" data-act="key" data-v=" ">Leerschlag</button><button class="k ok" data-act="ok" aria-label="Fertig">${ICON.check}</button></div></div>`;
  }
}
function typeKey(c) {
  if (!Q || Q.locked || Q.puzzle !== null || !document.getElementById('typed')) return;
  if (Q.input.length >= 48) return;
  if (c === ' ' && (!Q.input || Q.input.endsWith(' '))) return;
  Q.input += c; sfx.tap(); renderTyping();
}
function backspace() {
  if (!Q || Q.locked || !Q.input) return;
  Q.input = Q.input.slice(0, -1); sfx.tap(); renderTyping();
}
function submitTyping() {
  if (!Q || Q.locked || !document.getElementById('typed')) return;
  const t = cur(), w = WORD[t.id];
  if (!Q.input.trim()) { nope(document.getElementById('typed')); return; }
  if (L.isRight(w, Q.input)) { renderTyping('right'); return right(t); }
  if (t.kind === 'test') { Q.testAnswer = Q.input; renderTyping('wrong'); return wrong(t); }
  const near = L.closest(w, Q.input), accents = L.onlyAccents(w, Q.input);
  renderTyping('wrong');
  wrong(t, () => {
    const d = L.diff(near.answer, Q.input);
    document.getElementById('answer').innerHTML = `<div class="typed diff" lang="fr">${d.map(x => `<span class="d-${x.s}">${x.c === ' ' ? '&nbsp;' : esc(x.c)}</span>`).join('')}</div>
      <p class="solution" lang="fr">${show(near.answer)}</p>`;
  }, () => { renderTyping(); }, accents ? ACCENT_MSG : near.dist === 1 ? 'Fast! Nur ein Buchstabe stimmt nicht.' : near.dist === 2 ? 'Fast! Zwei Buchstaben stimmen nicht.' : null, accents);
}

/* ---- richtig / falsch ---- */
function right(t) {
  Q.locked = true;
  const first = Q.tries === 0 && !Q.hinted;
  Q.results[Q.i] = { first, id: t.id, kind: t.kind };
  record(t, first ? 'first' : 'second');
  Q.streak = first ? Q.streak + 1 : 0;
  Q.maxStreak = Math.max(Q.maxStreak, Q.streak);
  setLeo('leo_jubel');
  sfx.right(Q.streak);
  const fb = document.getElementById('fb');
  const serie = { 3: 'leo_serie_3', 5: 'leo_serie_5', 10: 'leo_serie_10' }[Q.streak];
  if (fb) { fb.className = 'fb good'; fb.textContent = serie ? `${Q.streak} richtig hintereinander!` : ['Super!', 'Bravo !', 'Génial !', 'Richtig!'][Math.floor(Math.random() * 4)]; }
  if (!reduced()) burst(document.querySelector('#qcard .right, #answer') || document.getElementById('qcard'), 10);
  if (t.kind === 'test') { timer = setTimeout(advance, 600); return; }
  // Das richtige Wort nochmals hören (ausser es wurde gerade vorgelesen), dann Lob
  const speakWord = !['karte', 'hoeren', 'waehlen_de'].includes(t.kind);
  Sound.say(speakWord ? [t.id] : []);
  leo([{ pause: 150 }, serie || line.lob()], true);
  timer = setTimeout(advance, speakWord ? 2000 : 1300);
}
/* Falsch: beim 1. Mal »nochmal« (retry), beim 2. Mal Lösung (solve) und »Weiter«. Im Wörtlitest gibt es nur einen Versuch.
   accents = nur die Akzente sind falsch: Léo sagt »Attention aux accents !« */
function wrong(t, solve, retry, msg, accents) {
  Q.tries++;
  Q.streak = 0;
  sfx.wrong();
  nope(document.querySelector('#answer, #qcard .wrong'));
  const fb = document.getElementById('fb');
  if (t.kind === 'test') {
    Q.results[Q.i] = { first: false, id: t.id, kind: t.kind, answer: Q.testAnswer };
    record(t, 'wrong');
    Q.locked = true;
    timer = setTimeout(advance, 700);
    return;
  }
  if (Q.tries === 1) {
    Q.locked = true;
    setLeo('leo_mut');
    if (fb) { fb.className = 'fb soft'; fb.textContent = msg || 'Nicht ganz. Versuch es nochmal!'; }
    leo(accents ? 'leo_akzent' : line.fast());
    setTimeout(() => { if (!Q || cur() !== t) return; Q.locked = false; if (retry) retry(); }, 1000);
    return;
  }
  Q.locked = true;
  Q.results[Q.i] = { first: false, id: t.id, kind: t.kind };
  record(t, 'wrong');
  setLeo('leo_mut');
  if (solve) solve();
  if (fb) { fb.className = 'fb soft'; fb.innerHTML = 'So heisst es richtig:'; }
  Sound.say([...(voiceOn() ? ['leo_loesung'] : []), t.id]);
  // später in der Runde nochmals (höchstens 3 Wiederholungen)
  if (!t.repeat && Q.extra < 3 && Q.mode.typ !== 'test') { Q.list.push(Object.assign({}, t, { repeat: true, kind: t.kind === 'tippen' ? L.spellKind(WORD[t.id], 3, 'auto') : t.kind })); Q.extra++; }
  document.getElementById('qfoot').innerHTML = `<button class="btn primary big" data-act="next" id="next-btn"><span><b>Weiter</b></span>${ICON.next}</button>`;
  updatePads();
}
function record(t, result) {
  if (t.repeat && result !== 'wrong') result = 'second';           // Wiederholung zählt nicht doppelt
  const before = st(t.id).box;
  S.w[t.id] = L.record(st(t.id), t.kind, result, S.round, Date.now());
  save();
  return { before, after: S.w[t.id].box };
}
function advance() {
  clearTimeout(timer);
  if (!Q) return;
  if (cur().kind === 'karte' && !Q.results[Q.i]) { Q.results[Q.i] = { first: true, id: cur().id, kind: 'karte' }; record(cur(), 'first'); }
  Q.i++;
  if (Q.i >= Q.list.length) return finish();
  document.getElementById('qfoot').innerHTML = '';
  showTask();
  if (!Sound.busy()) autoSpeak(false); else autoSpeak(true);
}

function finish() {
  const done = Q.results.filter((r, i) => r && !Q.list[i].repeat && Q.list[i].kind !== 'karte');
  const firstRight = done.filter(r => r.first).length;
  const ws = Q.pool;
  const newSafe = ws.filter(w => Q.before[w.id] < L.MAX && st(w.id).box === L.MAX).map(w => w.id);
  const grew = ws.filter(w => st(w.id).box > Q.before[w.id]).map(w => w.id);
  const res = { mode: Q.mode, firstRight, total: done.length, newSafe, grew, mistakes: [], gained: allPoints() - Q.ptsBefore };
  if (Q.mode.typ === 'test') {
    res.mistakes = Q.results.filter(r => r && !r.first).map(r => ({ id: r.id, answer: r.answer || '' }));
    S.tests.push({ unit: S.unit, teil: S.teil, t: Date.now(), right: firstRight, total: done.length });
  }
  res.stickers = checkStickers({ runde1: Q.mode.typ === 'leo', test100: Q.mode.typ === 'test' && res.total >= 10 && firstRight === res.total,
    serie10: Q.maxStreak >= 10 });
  save();
  Q = null;
  nav('result', { res });
  sfx.done();
  if (!reduced()) confetti(res.total && firstRight === res.total ? 70 : 40);
  leo([res.total && firstRight === res.total ? 'leo_perfekt' : line.fertig(), { pause: 300 }]);
  if (res.stickers.length) setTimeout(() => celebrateSticker(res.stickers), 900);
  else if (res.mode.typ === 'test' && res.mistakes.length) leo('leo_test_ueben', true);
}
function resultHTML(res) {
  const ws = words(), g = sicher(ws);
  const pct = res.total ? res.firstRight / res.total : 0;
  const isTest = res.mode.typ === 'test';
  const msg = !res.total ? 'Gut gemacht!' : pct === 1 ? (isTest ? 'Alles richtig – super!' : 'Alles auf Anhieb richtig!') : pct >= 0.8 ? 'Super gemacht!' : pct >= 0.5 ? 'Gut gemacht!' : 'Geschafft! Übung macht den Frosch stark.';
  const again = res.mode.typ === 'leo' ? 'start-leo' : 'mode';
  return `<div class="screen result">
    <div class="res-top"><img class="res-leo" src="${img('leo_jubel')}" alt="Léo jubelt">
      <div class="res-text"><h1>${msg}</h1>
        ${res.total ? `<p class="res-count"><b>${res.firstRight}</b> von ${res.total} ${isTest ? 'richtig geschrieben' : 'beim ersten Mal richtig'}</p>` : ''}
        ${isTest ? `<p class="res-note">${res.total ? Math.round(100 * pct) : 0} % – ${pct >= 0.9 ? 'bereit für den Test in der Schule!' : pct >= 0.7 ? 'fast bereit. Übe die Wörter unten nochmals.' : 'übe die Wörter unten mit Léo, dann nochmals testen.'}</p>` : ''}
      </div></div>
    ${res.stickers.length ? `<section class="res-stk"><h2>${res.stickers.length === 1 ? 'Neuer Sticker!' : `${res.stickers.length} neue Sticker!`}</h2>${newStickersHTML(res.stickers)}</section>` : ''}
    ${res.mistakes.length ? `<section class="mistakes"><h2>Diese Wörter nochmals üben</h2>
      ${res.mistakes.map(m => { const w = WORD[m.id]; return `<div class="mis">${picHTML(w.id, 'mini')}<div><p class="de">${esc(w.de)}</p>
        <p class="fr" lang="fr">${frHTML(w)}</p>${m.answer ? `<p class="yours" lang="fr">Deine Antwort: <s>${show(m.answer)}</s></p>` : ''}</div>
        <button class="snd-btn" data-act="say" data-id="${w.id}" aria-label="Anhören">${ICON.speaker}</button></div>`; }).join('')}
      <button class="btn primary" data-act="drill-mistakes">${ICON.pencil}<span>Diese ${res.mistakes.length} Wörter üben</span></button></section>` : ''}
    <section class="grow">
      <div class="grow-row">${res.grew.slice(0, 12).map(id => `<span class="grow-w">${levelHTML(st(id).box)}<span lang="fr">${show(WORD[id].fr)}</span></span>`).join('')}</div>
      <p>${res.gained > 0 ? `<b>+${res.gained} ${res.gained === 1 ? 'Lernpunkt' : 'Lernpunkte'}.</b> ` : ''}${res.newSafe.length ? `${res.newSafe.length} ${res.newSafe.length === 1 ? 'Wort sitzt' : 'Wörter sitzen'} jetzt sicher. ` : ''}${g} von ${ws.length} Wörtern sicher.</p>
      <button class="next-stk wide" data-act="album"><span class="next-stk-t">${ICON.sticker}${nextStickerText()}</span><span class="progress small"><i style="width:${nextStickerPct()}%"></i></span></button>
    </section>
    <div class="res-actions">
      <button class="btn primary big" data-act="${again}" ${again === 'mode' ? `data-mode="${isTest ? 'test' : res.mode.drill}"` : ''}>${ICON.again}<span><b>Nochmal</b></span></button>
      <button class="btn" data-act="album">${ICON.sticker}<span>Stickeralbum</span></button>
      <button class="btn" data-act="home">${ICON.back}<span>Übersicht</span></button>
    </div>
  </div>`;
}

/* ------------------------------------------------------------ Lernkarten */
let karteI = 0;
function kartenHTML() {
  const ws = words(), w = ws[karteI % ws.length];
  return `<div class="screen karten">
    <header class="bar"><button class="icon-btn" data-act="home" aria-label="Zurück">${ICON.back}</button><h1 class="bar-title">Lernkarten</h1>
      <span class="count">${karteI + 1}/${ws.length}</span><button class="icon-btn" data-act="liste" aria-label="Alle Wörter als Liste">${ICON.list}</button></header>
    <section class="flash" style="--u:${UNIT[S.unit].farbe}">
      <p class="flash-lz">${esc(D.listen.find(l => l.id === w.liste).teil)} · Lernziel ${esc(w.lz)}</p>
      ${picHTML(w.id, 'big')}
      <p class="fr" lang="fr">${frHTML(w)}</p>${soundBtns(w.id, w.typ === 'wort')}<p class="de">${esc(w.de)}</p>
      <p class="lvl">${levelHTML(st(w.id).box)}<span>${LEVEL[st(w.id).box]}</span></p>
    </section>
    <div class="flash-nav">
      <button class="btn" data-act="karte-prev">${ICON.prev}<span>Zurück</span></button>
      <button class="btn primary" data-act="karte-next"><span>Weiter</span>${ICON.next}</button>
    </div>
  </div>`;
}
function afterKarte() {
  const w = words()[karteI];
  if (st(w.id).box === 0) { S.w[w.id] = L.record(st(w.id), 'karte', 'first', S.round, Date.now()); save(); }
  if (S.settings.autoplay) Sound.say([{ pause: 150 }, w.id]);
}
function listeHTML() {
  const ws = words();
  let last = '';
  return `<div class="sheet-head"><h2>Alle Wörter · ${UNIT[S.unit].titel}</h2><button class="icon-btn" data-act="close-sheet" aria-label="Schliessen">${ICON.close}</button></div>
  <div class="sheet-body liste">${ws.map((w, i) => {
    const l = D.listen.find(x => x.id === w.liste), head = `${l.teil} · Lernziel ${w.lz}`;
    const h = head !== last ? `<h3 class="li-h">${esc(head)}</h3>` : '';
    last = head;
    return `${h}<div class="li">${levelHTML(st(w.id).box, 'li-lvl')}
    <button class="li-main" data-act="karte-go" data-i="${i}"><span class="fr" lang="fr">${frHTML(w)}</span><span class="de">${esc(w.de)}</span></button>
    <button class="snd-btn" data-act="say" data-id="${w.id}" aria-label="Anhören">${ICON.speaker}</button></div>`;
  }).join('')}</div>`;
}

/* ---------------------------------------------------------------- Memory */
function startMemory() {
  const deck = L.memoryDeck(words(), 6);
  Q = { memory: true, deck, open: [], found: new Set(), moves: 0, locked: false };
  deck.forEach(c => { new Image().src = img(c.id); });
  Sound.preload(deck.map(c => c.id));
  nav('memory');
  leo('leo_modus_memory');
}
function memoryHTML() {
  return `<div class="screen memory">
    <header class="bar"><button class="icon-btn" data-act="quit" aria-label="Beenden">${ICON.close}</button><h1 class="bar-title">Memory</h1>
      <span class="count" id="moves">${Q.moves} Züge</span></header>
    <p class="mem-hint">Finde zu jedem Bild das französische Wort.</p>
    <section class="mem-grid">${Q.deck.map((c, i) => `<button class="mcard ${Q.found.has(c.id) ? 'found open' : Q.open.includes(i) ? 'open' : ''}" data-act="flip" data-i="${i}" aria-label="Karte ${i + 1}">
      <span class="mback"><img src="icons/favicon.png" alt=""></span>
      <span class="mfront">${c.side === 'bild' ? `<img src="${img(c.id)}" alt="">` : `<b lang="fr">${show(WORD[c.id].fr)}</b>`}</span></button>`).join('')}</section>
  </div>`;
}
function flip(i) {
  if (!Q || !Q.memory || Q.locked) return;
  const c = Q.deck[i];
  if (Q.found.has(c.id) || Q.open.includes(i)) return;
  Q.open.push(i);
  sfx.flip();
  const el = document.querySelector(`.mcard[data-i="${i}"]`);
  if (el) el.classList.add('open');
  if (c.side === 'wort') sayWord(c.id);
  if (Q.open.length < 2) return;
  Q.moves++;
  document.getElementById('moves').textContent = `${Q.moves} Züge`;
  const [a, b] = Q.open.map(k => Q.deck[k]);
  if (a.id === b.id) {
    Q.found.add(a.id); Q.open = [];
    document.querySelectorAll(`.mcard`).forEach(m => { if (Q.deck[+m.dataset.i].id === a.id) m.classList.add('found'); });
    if (st(a.id).box === 0) { S.w[a.id] = L.record(st(a.id), 'karte', 'first', S.round, Date.now()); save(); }
    setTimeout(() => { sfx.right(Q.found.size); if (c.side !== 'wort') sayWord(a.id); }, 250);
    if (Q.found.size === 6) {
      const neu = checkStickers({ memory9: Q.moves <= 9 });
      setTimeout(() => { sfx.done(); if (!reduced()) confetti(50); leo('leo_memory_fertig'); }, 900);
      setTimeout(() => { if (Q && Q.memory) { openSheet('mem-done', memDoneHTML(neu)); if (neu.length) celebrateSticker(neu); } }, 1600);
    } else leo([{ pause: 600 }, 'leo_memory_paar'], true);
    return;
  }
  Q.locked = true;
  setTimeout(() => {
    if (!Q || !Q.memory) return;
    Q.open.forEach(k => { const m = document.querySelector(`.mcard[data-i="${k}"]`); if (m) m.classList.remove('open'); });
    Q.open = []; Q.locked = false;
  }, 1300);
}
const memDoneHTML = neu => `<div class="sheet-head"><h2>Alle Paare gefunden!</h2></div><div class="sheet-body center">
  ${neu.length ? newStickersHTML(neu) : `<img class="sheet-leo" src="${img('leo_jubel')}" alt="">`}<p class="confirm-text">Du hast ${Q ? Q.moves : ''} Züge gebraucht.</p>
  <div class="confirm-actions"><button class="btn" data-act="home">Übersicht</button><button class="btn primary" data-act="mode" data-mode="memory">${ICON.again}<span>Nochmal</span></button></div></div>`;

/* --------------------------------------------------------- Stickeralbum */
function albumHTML() {
  const have = new Set(S.stickers), neu = new Set(S.neu);
  const slot = (s, i) => have.has(s.id)
    ? `<button class="slot-stk got ${s.art === 'glitzer' ? 'glitzer' : ''} ${neu.has(s.id) ? 'is-new' : ''}" data-act="sticker" data-id="${s.id}" aria-label="${esc(s.titel)}">
        ${stickerImg(s.id)}<span class="stk-t" lang="fr">${esc(s.titel)}</span>${neu.has(s.id) ? '<em>Neu</em>' : ''}</button>`
    : `<div class="slot-stk empty ${s.art === 'glitzer' ? 'glitzer' : ''}"><span class="stk-n">${s.art === 'glitzer' ? ICON.star : i + 1}</span>
        <span class="stk-t">${s.art === 'glitzer' ? esc(bedingungText(s)) : '?'}</span></div>`;
  const normal = D.stickers.filter(s => s.art === 'normal'), glitzer = D.stickers.filter(s => s.art === 'glitzer');
  const full = have.size === D.stickers.length;
  return `<div class="screen album">
    <header class="bar"><button class="icon-btn" data-act="home" aria-label="Zurück">${ICON.back}</button><h1 class="bar-title">Stickeralbum</h1><span class="count">${have.size}/${D.stickers.length}</span></header>
    <section class="album-top"><img class="album-leo" src="${img(full ? 'leo_jubel' : 'leo_cool')}" alt="Léo">
      <div><p class="album-intro">Für alle ${L.PER_STICKER} Lernpunkte bekommst du einen neuen Sticker. Jedes Wort bringt bis zu 5 Lernpunkte – je besser du es kannst, desto mehr. Glitzer-Sticker gibt es für besondere Leistungen.</p>
      <div class="next-stk static"><span class="next-stk-t">${ICON.sticker}${nextStickerText()}</span><span class="progress small"><i style="width:${nextStickerPct()}%"></i></span></div>
      <p class="album-pts">${allPoints()} Lernpunkte gesammelt</p></div></section>
    <h2 class="album-h">Sticker <span>${normal.filter(s => have.has(s.id)).length} von ${normal.length}</span></h2>
    <section class="album-grid">${normal.map(slot).join('')}</section>
    <h2 class="album-h">Glitzer-Sticker <span>${glitzer.filter(s => have.has(s.id)).length} von ${glitzer.length}</span></h2>
    <section class="album-grid">${glitzer.map(slot).join('')}</section>
  </div>`;
}
function stickerSheetHTML(id) {
  const s = STICKER[id];
  return `<div class="sheet-head"><h2 lang="fr">${esc(s.titel)}</h2><button class="icon-btn" data-act="close-sheet" aria-label="Schliessen">${ICON.close}</button></div>
  <div class="sheet-body center stk-sheet">${stickerImg(id, 'big')}
    <button class="snd-btn" data-act="say-sticker" data-id="${id}" aria-label="Anhören">${ICON.speaker}</button>
    <p class="de">${esc(s.de)}</p>${s.art === 'glitzer' ? `<p class="set-note">Glitzer-Sticker: ${esc(bedingungText(s))}</p>` : ''}</div>`;
}

/* --------------------------------------------------------- Einstellungen */
let sheetOpen = null;
function openSheet(n, html) {
  sheetOpen = n;
  sheetRoot.innerHTML = `<div class="sheet-bg" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  requestAnimationFrame(() => sheetRoot.classList.add('open'));
}
function closeSheet(now) {
  if (!sheetOpen) return;
  sheetOpen = null;
  sheetRoot.classList.remove('open');
  if (now) sheetRoot.innerHTML = ''; else setTimeout(() => { if (!sheetOpen) sheetRoot.innerHTML = ''; }, 260);
}
const sw = (key, label, sub) => `<div class="set-row"><div><div class="set-label">${label}</div>${sub ? `<div class="set-sub">${sub}</div>` : ''}</div>
  <button class="switch" role="switch" aria-checked="${!!S.settings[key]}" data-act="toggle" data-key="${key}" aria-label="${label}"><i></i></button></div>`;
const seg = (key, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, l]) => `<button role="radio" aria-checked="${S.settings[key] === v}" data-act="seg" data-key="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
function settingsHTML() {
  return `<div class="sheet-head"><h2>Einstellungen</h2><button class="icon-btn" data-act="close-sheet" aria-label="Schliessen">${ICON.close}</button></div>
  <div class="sheet-body">
    <section class="set-group"><h3>Name</h3>
      <input class="name-in" id="name-in" type="text" maxlength="20" autocomplete="off" placeholder="Wie heisst du?" value="${esc(S.settings.name)}">
      <p class="set-note">Léo schreibt deinen Namen auf die Startseite. Er bleibt nur auf diesem Gerät.</p></section>
    <section class="set-group"><h3>Üben</h3>
      <div class="set-row col"><div class="set-label">Aufgaben pro Runde mit Léo</div>${seg('length', [[10, '10'], [15, '15'], [20, '20']])}</div>
      <div class="set-row col"><div class="set-label">Schreiben</div>${seg('hilfe', [['auto', 'Automatisch'], ['puzzle', 'Immer Puzzle'], ['tastatur', 'Immer Tastatur']])}
        <div class="set-sub">Automatisch: zuerst mit Puzzle, wenn das Wort sitzt mit der Tastatur.</div></div>
      <div class="set-row col"><div class="set-label">Wörtlitest</div>${seg('testLength', [[10, '10 Wörter'], [20, '20 Wörter'], [0, 'Alle Wörter']])}</div>
    </section>
    <section class="set-group"><h3>Ton</h3>
      ${sw('autoplay', 'Wörter automatisch vorlesen')}
      ${sw('voice', 'Léo spricht', 'Lob und Hilfe auf Französisch')}
      ${sw('sounds', 'Klänge')}
      <button class="btn" data-act="test-sound">${ICON.speaker}<span>Ton testen</span></button>
    </section>
    <div id="install-set">${installSetHTML()}</div>
    <section class="set-group"><h3>Fortschritt</h3>
      <p class="set-note">${S.round} ${S.round === 1 ? 'Runde' : 'Runden'} geübt · ${allPoints()} Lernpunkte · ${S.stickers.length} Sticker${S.tests.length ? ` · letzter Wörtlitest: ${S.tests[S.tests.length - 1].right} von ${S.tests[S.tests.length - 1].total}` : ''}.</p>
      <button class="btn danger" data-act="reset">Alles zurücksetzen</button>
    </section>
    <p class="version">Wörtli-Frosch · Stand ${esc(window.BUILD || 'dev')} · Stimme: ElevenLabs · Bilder: OpenAI · Schriften: Nunito, Andika (SIL OFL)</p>
  </div>`;
}
const confirmHTML = (title, text, yes, act) => `<div class="sheet-head"><h2>${title}</h2></div><div class="sheet-body"><p class="confirm-text">${text}</p>
  <div class="confirm-actions"><button class="btn" data-act="close-sheet">Abbrechen</button><button class="btn danger" data-act="${act}">${yes}</button></div></div>`;

/* --------------------------------------------------------------- Effekte */
function nope(el) { if (!el || reduced()) return; el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); }
const FX_COLORS = ['#5DBB2F', '#FFC83A', '#F07A1A', '#29A8C4', '#1E2A20'];
function burst(el, n) {
  if (!el) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 60;
    p.className = 'spark';
    p.style.cssText = `left:${cx}px;top:${cy}px;background:${FX_COLORS[i % FX_COLORS.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
    fxRoot.appendChild(p); setTimeout(() => p.remove(), 800);
  }
}
function confetti(n) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = 'conf';
    p.style.cssText = `left:${Math.random() * 100}vw;background:${FX_COLORS[i % FX_COLORS.length]};--d:${1.6 + Math.random() * 1.4}s;--x:${(Math.random() - 0.5) * 160}px;--r:${Math.random() * 720}deg;animation-delay:${Math.random() * 0.5}s`;
    fxRoot.appendChild(p); setTimeout(() => p.remove(), 3600);
  }
}

/* ---------------------------------------------------------------- Tippen */
app.addEventListener('click', onClick);
sheetRoot.addEventListener('click', onClick);
sheetRoot.addEventListener('input', e => { if (e.target.id === 'name-in') { S.settings.name = e.target.value.slice(0, 20); save(); } });
function onClick(e) {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act;
  switch (act) {
    case 'hello': case 'leo': {
      sfx.tap();
      const t = document.querySelector('.hero-leo img');
      if (t && !reduced()) { t.classList.remove('bounce'); void t.offsetWidth; t.classList.add('bounce'); }
      Sound.say(line.hallo());
      break;
    }
    case 'start-leo': sfx.tap(); startLeo(); break;
    case 'mode': {
      sfx.tap();
      const m = b.dataset.mode;
      if (m === 'karten') { karteI = 0; nav('karten'); if (voiceOn() && S.settings.autoplay) Sound.say(['leo_modus_karten', { pause: 200 }, words()[0].id]); }
      else if (m === 'memory') startMemory();
      else if (m === 'test') startTest();
      else startDrill(m);
      break;
    }
    case 'unit': S.unit = +b.dataset.unit; save(); nav('home', {}, false); break;
    case 'teil': S.teil = b.dataset.v; save(); sfx.tap(); render(); break;
    case 'album':
      sfx.tap(); nav('album');
      if (!S.albumSeen) { S.albumSeen = true; save(); leo('leo_album'); }
      else if (S.stickers.length === D.stickers.length) leo('leo_album_voll');
      break;
    case 'sticker': sfx.sparkle(); openSheet('sticker', stickerSheetHTML(b.dataset.id)); Sound.say(b.dataset.id); break;
    case 'say-sticker': Sound.say(b.dataset.id); break;
    case 'settings': sfx.tap(); openSheet('settings', settingsHTML()); break;
    case 'close-sheet': closeSheet(); if (view.name === 'home') render(); break;
    case 'home': sfx.tap(); nav('home'); break;
    case 'say': sayWord(b.dataset.id, false); break;
    case 'say-slow': sayWord(b.dataset.id, true); break;
    case 'spell': spell(b.dataset.id); if (Q && view.name === 'task') Q.hinted = true; break;
    case 'choice': choose(b.dataset.id, b); break;
    case 'place': place(+b.dataset.i); break;
    case 'unplace': unplace(+b.dataset.i); break;
    case 'key': typeKey(b.dataset.v); break;
    case 'bksp': backspace(); break;
    case 'ok': submitTyping(); break;
    case 'next': Sound.stop(); advance(); break;
    case 'quit':
      sfx.tap();
      openSheet('quit', confirmHTML('Beenden?', 'Was du schon geübt hast, bleibt gespeichert.', 'Beenden', 'quit-yes'));
      break;
    case 'quit-yes': Q = null; Sound.stop(); nav('home'); break;
    case 'drill-mistakes': startDrill('schreiben', view.res.mistakes.map(m => m.id)); break;
    case 'karte-next': case 'karte-prev': {
      const n = words().length;
      karteI = (karteI + (act === 'karte-next' ? 1 : n - 1)) % n;
      sfx.flip(); render();
      break;
    }
    case 'liste': openSheet('liste', listeHTML()); break;
    case 'karte-go': karteI = +b.dataset.i; closeSheet(true); render(); break;
    case 'flip': flip(+b.dataset.i); break;
    case 'toggle': {
      const key = b.dataset.key, val = !S.settings[key];
      S.settings[key] = val; save(); sfx.tap();
      b.setAttribute('aria-checked', String(val));
      if (!val && key === 'voice') Sound.stop();
      break;
    }
    case 'seg': {
      const key = b.dataset.key, v = ['length', 'testLength'].includes(key) ? +b.dataset.v : b.dataset.v;
      S.settings[key] = v; save(); sfx.tap();
      b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      break;
    }
    case 'test-sound': sfx.right(3); setTimeout(() => Sound.say(['leo_hallo_02', { pause: 200 }, D.woerter[0].id]), 350); break;
    case 'reset': openSheet('reset', confirmHTML('Alles zurücksetzen?', 'Alle Lernstände und alle Sticker werden gelöscht. Das lässt sich nicht rückgängig machen.', 'Zurücksetzen', 'reset-yes')); break;
    case 'reset-yes': S.w = {}; S.round = 0; S.tests = []; S.stickers = []; S.neu = []; S.albumSeen = false; save(); closeSheet(true); nav('home', {}, false); break;
    case 'hint-close': S.hintClosed = true; save(); refreshInstall(); break;
    case 'install': {
      const ev = installEvent;
      if (!ev) break;
      installEvent = null;
      try { ev.prompt(); ev.userChoice.then(c => { if (c && c.outcome === 'accepted') { S.installed = true; save(); } refreshInstall(); }).catch(refreshInstall); } catch (err) { refreshInstall(); }
      break;
    }
  }
}
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey) return;
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.key === 'Escape' && sheetOpen) { closeSheet(); if (view.name === 'home') render(); e.preventDefault(); return; }
  if (sheetOpen) return;
  if (view.name === 'karten') {
    if (e.key === 'ArrowRight') onClick({ target: document.querySelector('[data-act="karte-next"]') });
    if (e.key === 'ArrowLeft') onClick({ target: document.querySelector('[data-act="karte-prev"]') });
    return;
  }
  if (view.name !== 'task' || !Q) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    if (document.getElementById('next-btn')) { Sound.stop(); advance(); } else submitTyping();
    return;
  }
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (!document.getElementById('typed')) {
    // Puzzle mit der PC-Tastatur: den nächsten passenden Buchstaben nehmen (auch é, è … auf der Schweizer Tastatur)
    if (Q.puzzle && Q.puzzle.typ === 'b' && TYPEABLE.test(k) && k !== ' ') {
      const i = Q.puzzle.tiles.findIndex((c, n) => c === k && !Q.placed.includes(n));
      if (i >= 0) place(i);
      e.preventDefault();
    } else if (e.key === 'Backspace' && Q.puzzle && Q.placed.length) { unplace(Q.placed.length - 1); e.preventDefault(); }
    return;
  }
  if (TYPEABLE.test(k)) { typeKey(k); e.preventDefault(); }
  else if (e.key === 'Backspace') { backspace(); e.preventDefault(); }
});

/* ================================================================== Start */
try { history.replaceState({ name: 'home' }, ''); } catch (e) { /* file:// */ }
render();
['leo_denkt', 'leo_jubel', 'leo_mut'].forEach(n => { new Image().src = img(n); });

if ('serviceWorker' in navigator && window.BUILD !== 'dev' && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (['task', 'result', 'memory'].includes(view.name)) reloadPending = true; else location.reload();
  });
}
})();
