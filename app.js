/* Wörtli-Frosch – Französisch-Wörter lernen mit Léo, dem Frosch (6. Klasse, Schweiz).
   Eine Seite, kein Framework. Wörter aus daten.js, Lernlogik aus lernen.js, Fortschritt auf dem Gerät (localStorage).
   Gleich aufgebaut wie Wörtli-Panda; neu: zwei Wortlisten je Unit (Vocabulaire / Vocabulaire plus), Akzente, Stickeralbum
   mit einer Seite je Unité (Unité 1: Léo-Sticker, Unité 2: Panini-Album der Frosch-WM mit Päckchen und Tauschen). */
(() => {
'use strict';
const L = window.Lernen;
const D = window.DATEN;
const WORD = Object.fromEntries(D.woerter.map(w => [w.id, w]));
const STICKER = Object.fromEntries(D.stickers.map(s => [s.id, s]));
const img = name => `img/${name}.webp`;
// Farbe mischen: t = 0 … 1 Richtung `to` (hell = heller, #000000 = dunkler) – für den Unit-farbigen Kopf der Startseite
// (wie Wörtli-Panda); oben links mit warmem Hellgelb statt Weiss, damit der Verlauf leuchtet
const mix = (hex, to, t) => '#' + [1, 3, 5].map(i => {
  const a = parseInt(hex.substr(i, 2), 16), b = parseInt(to.substr(i, 2), 16);
  return Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
}).join('');
const unitColors = u => `--u:${u.farbe};--u-hi:${mix(u.farbe, '#fff3b0', .3)};--u-lo:${mix(u.farbe, '#000000', .13)};--u-deep:${mix(u.farbe, '#000000', .3)}`;
const isPlus = l => /plus/i.test(l.teil);
const UNITS = [...new Set(D.listen.map(l => l.unit))].map(n => {
  const ls = D.listen.filter(l => l.unit === n);
  return { n, lists: ls, aktiv: ls.some(l => l.aktiv), titel: ls[0].titel, thema: ls[0].thema, farbe: ls[0].farbe, album: ls[0].album || 'leo' };
});
const UNIT = Object.fromEntries(UNITS.map(u => [u.n, u]));
const ACTIVE = UNITS.filter(u => u.aktiv);
const TEAM = Object.fromEntries((D.teams || []).map(t => [t.id, t]));
const TEILE = [['grund', 'Vocabulaire'], ['plus', 'Vocabulaire plus'], ['beide', 'Beides']];
/* Sammelbuch: Seite 0 = Umschlag, 1 = »Dieses Buch gehört«, 2 = Titelseite, 3–36 = 17 gemalte Doppelseiten (neue kommen immer ans Ende,
   damit eingeklebte Sticker auf ihren Seiten bleiben).
   Hinein kommen nur Léo-Sticker (Album »leo«), keine Panini-Karten (Wunsch des Benutzers 2026-10-26). */
const SZENEN = [['teich', 'Am Seerosenteich'], ['meer', 'Am Meer'], ['berge', 'In den Bergen'], ['unterwasser', 'Unter Wasser'],
  ['winter', 'Im Winter'], ['nacht', 'In der Nacht'], ['burg', 'In der Burg'], ['gipfel', 'Auf dem Gipfel'],
  ['haus', 'Zu Hause'], ['see', 'Am See'], ['insel', 'Auf der Insel'], ['regen', 'Im Regen'], ['buehne', 'Auf der Bühne'],
  ['weihnachten', 'An Weihnachten'], ['herbst', 'Im Herbst'], ['wanderweg', 'Auf dem Wanderweg'],
  ['garten', 'Im Garten']];
const BUCH_SEITEN = 3 + 2 * SZENEN.length;
const buchSticker = id => !!STICKER[id] && !!UNIT[STICKER[id].unit] && UNIT[STICKER[id].unit].album !== 'panini';

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
    dup: d.dup && typeof d.dup === 'object' ? Object.fromEntries(Object.entries(d.dup).filter(([id, n]) => STICKER[id] && n > 0)) : {},   // Doppelte (Panini)
    pk: d.pk && typeof d.pk === 'object' ? d.pk : {},          // Päckchen je Unité (Panini): { pts, bonus, special, opened }
    buch: buchLaden(d.buch),                                  // Sammelbuch: { placed: [{ s, p, x, y, r }], p, seen }
    albumSeen: !!d.albumSeen,
    hintClosed: !!d.hintClosed,
    installed: !!d.installed,
  };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* egal */ } }
/* Sammelbuch: jeder Sticker höchstens einmal eingeklebt, x/y = Mitte in % der Seite, r = Drehung in Grad */
function buchLaden(b) {
  b = b && typeof b === 'object' ? b : {};
  const seen = new Set();
  const placed = (Array.isArray(b.placed) ? b.placed : [])
    .filter(x => x && buchSticker(x.s) && !seen.has(x.s) && seen.add(x.s) && x.p >= 1 && x.p < BUCH_SEITEN)
    .map(x => ({ s: x.s, p: Math.round(x.p), x: +x.x || 50, y: +x.y || 50, r: +x.r || 0 }));
  return { placed, p: Math.min(BUCH_SEITEN - 1, Math.max(0, Math.round(b.p) || 0)), seen: !!b.seen };
}
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
  fwd: I('<path d="M9 18l6-6-6-6"/>'),
  book: I('<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/>'),
  rotL: I('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  rotR: I('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>'),
  peel: I('<path d="M5 4h9l5 5v11H5z"/><path d="M14 4v5h5"/><path d="M9 14l2 2 4-4"/>'),
  pack: I('<path d="M6 3l1.5 1.5L9 3l1.5 1.5L12 3l1.5 1.5L15 3l1.5 1.5L18 3v18l-1.5-1.5L15 21l-1.5-1.5L12 21l-1.5-1.5L9 21l-1.5-1.5L6 21z"/><circle cx="12" cy="11" r="3"/><path d="M9 16.5h6"/>'),
  swap: I('<path d="M4 8h13M13 4l4 4-4 4"/><path d="M20 16H7M11 12l-4 4 4 4"/>'),
};
/* Flaggen der Panini-Seite (selbst gezeichnet, keine Wappen der Verbände) */
const star5 = (cx, cy, R) => Array.from({ length: 10 }, (_, k) => {
  const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? R * 0.4 : R;
  return `${(cx + r * Math.cos(a)).toFixed(3)},${(cy + r * Math.sin(a)).toFixed(3)}`;
}).join(' ');
const FLAG = {
  SUI: '<rect width="32" height="32" fill="#D52B1E"/><path d="M13 6h6v7h7v6h-7v7h-6v-7H6v-6h7z" fill="#fff"/>',
  FRA: '<rect width="10" height="20" fill="#002395"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ED2939"/>',
  GER: '<rect width="30" height="6" fill="#000"/><rect y="6" width="30" height="6" fill="#DD0000"/><rect y="12" width="30" height="6" fill="#FFCE00"/>',
  ESP: '<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>',
  ITA: '<rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#CE2B37"/>',
  BRA: '<rect width="30" height="21" fill="#009C3B"/><path d="M15 2.5L27.5 10.5 15 18.5 2.5 10.5z" fill="#FFDF00"/><circle cx="15" cy="10.5" r="5.2" fill="#002776"/>',
  ARG: '<rect width="30" height="20" fill="#74ACDF"/><rect y="6.67" width="30" height="6.67" fill="#fff"/><circle cx="15" cy="10" r="2.4" fill="#F6B40E"/>',
  SEN: `<rect width="10" height="20" fill="#00853F"/><rect x="10" width="10" height="20" fill="#FDEF42"/><rect x="20" width="10" height="20" fill="#E31B23"/><polygon points="${star5(15, 10.4, 3.6)}" fill="#00853F"/>`,
};
const FLAG_BOX = { SUI: '0 0 32 32', GER: '0 0 30 18', BRA: '0 0 30 21' };
const flagHTML = code => (FLAG[code] ? `<svg class="flag" viewBox="${FLAG_BOX[code] || '0 0 30 20'}" aria-hidden="true">${FLAG[code]}</svg>` : '');
/* Lernstufe als 5 Seerosenblätter (0–5 gefüllt) */
function levelHTML(box, cls = '') {
  const b = Math.max(0, Math.min(5, box));
  return `<span class="lvl-dots ${cls} ${b >= 5 ? 'full' : ''}" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= b ? 'on' : ''}"></i>`).join('')}</span>`;
}
const LEVEL = ['neu', 'kennengelernt', 'einmal erkannt', 'erkannt – bereit zum Schreiben', 'einmal richtig geschrieben', 'sicher'];

/* ============================================================== Ton
   Stimme: MP3s aus audio/ nacheinander (Web Audio, damit auf dem iPhone nichts stockt). Geräusche: direkt erzeugt. */
const Sound = (() => {
  let ctx = null, out = null, sfxBus = null, voiceBus = null, fxBus = null;
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
    fxBus = ctx.createGain(); fxBus.gain.value = 0.8; fxBus.connect(out);
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
    /* Päckchen aufreissen: kurzes Rauschen, das tiefer wird */
    tear() {
      if (!on()) return;
      const t = ctx.currentTime + 0.01, len = 0.32, b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.random());
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = b; f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(700, t + len);
      env(g, t, 0.01, 0.5, len); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + len + 0.05);
    },
    /* Gold-Sticker: kleine Fanfare */
    gold() {
      if (!on()) return;
      const t = ctx.currentTime + 0.02;
      [67, 72, 76, 79].forEach((m, i) => { marimba(note(m), t + i * 0.09, 0.9); osc('triangle', note(m), t + i * 0.09, 0.25, 0.05, sfxBus); });
      [84, 88, 91, 96].forEach(m => bell(note(m), t + 0.4, 0.45));
      [100, 103, 108].forEach((m, i) => bell(note(m), t + 0.7 + i * 0.08, 0.4));
    },
  };
  /* Geräusch aus audio/ (Sammelbuch: Blättern, Kleben): sofort, neben der Stimme, ohne ihre Warteschlange anzufassen */
  async function fx(n) {
    if (!S.settings.sounds || !ready()) return;
    const b = await buffer(n);
    if (!b || !ctx) return;
    const s = ctx.createBufferSource();
    s.buffer = b; s.connect(fxBus); s.start();
  }
  return { say, stop, preload, sfx, ready, busy, fx };
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
  if (from === 'buch') buchAufraeumen();
  view = Object.assign({ name }, params);
  if (push) { try { history.pushState({ name }, ''); } catch (e) { /* file:// */ } }
  render();
  window.scrollTo(0, 0);
  if (from === 'karten' && name !== 'karten') stickerToast();      // in den Lernkarten verdiente Sticker zeigen
  if (name === 'home' && reloadPending) location.reload();
}
window.addEventListener('popstate', e => {
  const s = e.state || { name: 'home' };
  if (PK) { PK = null; packRoot.classList.remove('open'); packRoot.innerHTML = ''; }
  clearTimeout(timer);
  const from = view.name;
  if (['task', 'memory', 'result'].includes(from)) { Q = null; Sound.stop(); }
  if (from === 'buch') buchAufraeumen();
  view = ['album', 'karten', 'buch'].includes(s.name) ? { name: s.name } : { name: 'home' };
  closeSheet(true);
  render();
  if (from === 'karten' && view.name !== 'karten') stickerToast();
});
function render() {
  document.body.dataset.view = view.name;
  const R = { home: homeHTML, album: albumHTML, karten: kartenHTML, result: () => resultHTML(view.res), memory: memoryHTML };
  if (view.name === 'task') { app.innerHTML = taskShellHTML(); showTask(); return; }
  if (view.name === 'buch') { app.innerHTML = buchHTML(); buchZeigen(); return; }
  app.innerHTML = R[view.name]();
  if (view.name === 'karten') afterKarte();
  if (view.name === 'album') {                                       // »Neu« gilt, bis man die Seite gesehen hat
    const n = albumPage();
    if (S.neu.some(id => STICKER[id].unit === n)) { S.neu = S.neu.filter(id => STICKER[id].unit !== n); S.albumSeen = true; save(); }
  }
}

/* ------------------------------------------------------------- Sticker
   Jede Unité hat eine Albumseite (Listen.csv → Album): »leo« = Léo-Sticker der Reihe nach (Unité 1),
   »panini« = Päckchen mit Seltenheit, Doppelten und Tauschen (Unité 2; Regeln in lernen.js → Panini-Seite). */
const allPoints = () => L.points(D.woerter, S.w);
const unitWords = n => D.woerter.filter(w => w.unit === n);
const unitPoints = n => L.points(unitWords(n), S.w);
const unitStickers = (n, art) => D.stickers.filter(s => s.unit === n && (!art || s.art === art));
const isPanini = n => !!UNIT[n] && UNIT[n].album === 'panini';
const allSafe = ws => ws.length > 0 && sicher(ws) === ws.length;
const NUM = {};                                                     // Nummer im Album wie bei Panini (je Seite 1 …)
ACTIVE.forEach(u => unitStickers(u.n).forEach((s, i) => { NUM[s.id] = i + 1; }));
/* Päckchen einer Unité: pts = aus Päckchen-Punkten verdiente Päckchen, ans = Punkte für richtige Antworten, lp = höchster
   Stand der Lernpunkte, bonus = Bedingungen schon erfüllt, special = Pochette spéciale (0 nein, 1 verdient, 2 geöffnet),
   opened = geöffnete Päckchen. v 2 (2026-10-26): Päckchen-Punkte statt Lernpunkte – beim Übergang beginnt ans so, dass das
   nächste Päckchen nach PER_PACK weiteren Punkten kommt (nichts geht verloren, nichts gibt es doppelt). */
const PK_START = { pts: 0, special: 0, opened: 0, ans: 0, lp: 0 };
const pk = n => {
  const p = S.pk[n] || (S.pk[n] = {});                  // immer dasselbe Objekt (nicht kopieren: sonst gehen Änderungen verloren)
  Object.keys(PK_START).forEach(k => { if (typeof p[k] !== 'number') p[k] = PK_START[k]; });
  if (!Array.isArray(p.bonus)) p.bonus = [];
  if (p.v !== 2) { p.lp = unitPoints(n); p.ans = Math.max(0, p.pts * L.PER_PACK - p.lp); p.v = 2; }
  return p;
};
/* Päckchen-Punkte (lernen.js → Panini-Seite): richtige Antworten + höchster Stand der Lernpunkte */
const packPoints = n => { const p = pk(n); p.lp = Math.max(p.lp, unitPoints(n)); return p.lp + p.ans; };
/* Eine richtige Antwort (1. Versuch) zu diesem Wort: 1 Päckchen-Punkt, wenn seine Unité eine Panini-Seite hat */
function answerPoint(id) { const n = WORD[id] && WORD[id].unit; if (isPanini(n)) pk(n).ans++; }
const packsPending = n => { const p = pk(n); return p.pts + p.bonus.length + (p.special ? 1 : 0) - p.opened; };
/* Welches Päckchen kommt als nächstes? Die Pochette spéciale immer zuletzt (vorher können die anderen noch Lücken füllen) */
function nextPackKind(n) {
  const p = pk(n), normal = p.pts + p.bonus.length - (p.opened - (p.special === 2 ? 1 : 0));
  return normal > 0 ? 'normal' : p.special === 1 ? 'special' : null;
}
const pageFull = n => unitStickers(n).every(s => S.stickers.includes(s.id));
const pageDups = n => L.dupCount(S.dup, unitStickers(n).map(s => s.id));
const BONUS = ['runde1', 'test100', 'serie10', 'memory9'];
/* Neu Verdientes eintragen. ctx: { unit, runde1, test100, serie10, memory9 } aus der eben beendeten Übung.
   Ergebnis: { stickers: neue Léo-Sticker, packs: neue Päckchen ('punkte', eine Bedingung oder 'special') } */
function checkStickers(ctx = {}) {
  const res = { stickers: [], packs: [] };
  ACTIVE.forEach(u => {
    const n = u.n, pts = unitPoints(n);
    if (!isPanini(n)) {
      const neu = L.stickersEarned(unitStickers(n), S.stickers, pts);
      unitStickers(n, 'glitzer').filter(s => !S.stickers.includes(s.id)).forEach(s => {
        const b = s.bedingung;
        if (b.startsWith('liste:') ? allSafe(listWords([b.slice(6)])) : ctx.unit === n && ctx[b]) neu.push(s.id);
      });
      res.stickers.push(...neu);
      return;
    }
    const p = pk(n), earned = L.packsFromPoints(packPoints(n));
    for (; p.pts < earned; p.pts++) res.packs.push('punkte');
    BONUS.forEach(b => { if (ctx.unit === n && ctx[b] && !p.bonus.includes(b)) { p.bonus.push(b); res.packs.push(b); } });
    u.lists.filter(l => l.aktiv).forEach(l => {
      const b = `liste:${l.id}`;
      if (!p.bonus.includes(b) && allSafe(listWords([l.id]))) { p.bonus.push(b); res.packs.push(b); }
    });
    if (!p.special && allSafe(unitWords(n))) { p.special = 1; res.packs.push('special'); }
  });
  if (res.stickers.length) { S.stickers.push(...res.stickers); S.neu.push(...res.stickers); }
  if (res.stickers.length || res.packs.length) save();
  return res;
}
const BEDINGUNG = { runde1: 'Die erste Runde mit Léo', test100: 'Wörtlitest ohne Fehler (ab 10 Wörtern)', serie10: '10 richtig hintereinander',
  memory9: 'Memory in höchstens 9 Zügen' };
function bedingungText(b) {
  if (b.startsWith('liste:')) {
    const l = D.listen.find(x => x.id === b.slice(6));
    return l ? `Alle Wörter von ${l.titel} ${l.teil} sicher` : '';
  }
  return BEDINGUNG[b] || '';
}
/* Wofür gab es das Päckchen? */
const packWhy = k => (k === 'punkte' ? `${L.PER_PACK} Punkte` : k === 'special' ? 'Alle Wörter sicher – Pochette spéciale!' : `Bonus: ${bedingungText(k)}`);
/* Nächster Sticker / nächstes Päckchen der Unité n: { text, pct, act } */
function nextInfo(n = S.unit) {
  const plural = k => `${k} ${k === 1 ? 'Lernpunkt' : 'Lernpunkte'}`;
  if (isPanini(n)) {
    const open = packsPending(n);
    if (open > 0) return { text: open === 1 ? 'Ein Päckchen zum Öffnen!' : `${open} Päckchen zum Öffnen!`, pct: 100, act: 'open-pack', icon: 'pack' };
    if (pageFull(n)) return { text: 'Album-Seite voll!', pct: 100, icon: 'pack' };
    const left = L.toNextPack(packPoints(n), pk(n).pts);
    return { text: `Nächstes Päckchen: noch ${left} ${left === 1 ? 'Punkt' : 'Punkte'}`, pct: Math.round(100 * (L.PER_PACK - Math.min(left, L.PER_PACK)) / L.PER_PACK), icon: 'pack' };
  }
  const left = L.toNextSticker(unitStickers(n), S.stickers, unitPoints(n));
  return left == null ? { text: 'Alle normalen Sticker gesammelt!', pct: 100, icon: 'sticker' }
    : { text: `Nächster Sticker: noch ${plural(left)}`, pct: Math.round(100 * (L.PER_STICKER - left) / L.PER_STICKER), icon: 'sticker' };
}
/* Der Knopf »Nächster Sticker …« (Startseite, Ergebnis, Album). static = im Album ohne Klick, ausser es gibt ein Päckchen */
function nextStkHTML(cls = '', n = S.unit) {
  const i = nextInfo(n), tag = cls.includes('static') && !i.act ? 'div' : 'button';
  return `<${tag} class="next-stk ${cls} ${i.act ? 'has-pack' : ''}" ${tag === 'button' ? `data-act="${i.act || 'album'}" data-unit="${n}"` : ''}><span class="next-stk-t">${ICON[i.icon]}${i.text}</span><span class="progress small"><i style="width:${i.pct}%"></i></span></${tag}>`;
}
/* Sticker im Rahmen; Glitzer-Sticker bekommen einen wandernden Lichtstreifen (style.css, Maske = das Bild selbst) */
const stickerImg = (id, cls = '') => `<span class="stk-wrap ${STICKER[id].art === 'glitzer' ? 'glitzer' : ''} ${cls}" style="--m:url(${img(id)})"><img class="stk" src="${img(id)}" alt="${esc(STICKER[id].de)}"></span>`;
const newStickersHTML = ids => `<div class="new-stk">${ids.slice(0, 4).map((id, i) => `<button class="new-stk-i ${STICKER[id].art === 'glitzer' ? 'glitzer' : ''}" data-act="sticker" data-id="${id}" style="--i:${i}">
  ${stickerImg(id)}<span class="stk-t" lang="fr">${esc(STICKER[id].titel)}</span></button>`).join('')}</div>`;
/* Panini-Karte: Bild mit Band (Flagge, Kürzel, Aufschrift, Nummer); glitzer/gold mit Folien-Effekt (style.css) */
const teamColors = s => { const t = TEAM[s.team]; return t ? `--t1:${t.farben[0]};--t2:${t.farben[1] || t.farben[0]}` : '--t1:#2D781B;--t2:#FFC83A'; };
const cardHTML = (id, cls = '') => {
  const s = STICKER[id];
  return `<span class="pcard ${s.art} ${s.format} ${cls}" style="${teamColors(s)}"><img src="${img(id)}" alt="${esc(s.de)}" loading="lazy">
    <span class="pc-band">${s.team ? flagHTML(s.team) : '<b class="pc-wm">★</b>'}<span lang="fr">${esc(s.kurz)}</span><i>${NUM[id]}</i></span></span>`;
};
/* Ein Päckchen als Bild (CSS): klein auf dem Ergebnis-Bildschirm, gross zum Aufreissen */
const pochetteHTML = (kind = 'normal', cls = '') => `<span class="pochette ${kind === 'special' ? 'special' : ''} ${cls}"><span class="poch-top"></span>
  <span class="poch-body"><img src="${img('leo_fussball')}" alt=""><b lang="fr">Coupe du monde<br>des grenouilles</b><small>${kind === 'special' ? 'Pochette spéciale' : `Pochette · ${L.PACK_SIZE} stickers`}</small></span></span>`;
/* Ausserhalb einer Runde Verdientes (Lernkarten, Memory): kurz als Blatt zeigen */
function stickerToast() {
  const r = checkStickers();
  if (!r.stickers.length && !r.packs.length) return;
  if (view.name === 'home') render();                              // Zähler im Album-Knopf
  setTimeout(() => { openSheet('sticker-neu', rewardSheetHTML(r)); celebrate(r); }, 250);
}
function rewardSheetHTML(r, head) {
  const t = r.packs.length ? (r.packs.length === 1 ? 'Neues Päckchen!' : `${r.packs.length} neue Päckchen!`) : r.stickers.length === 1 ? 'Neuer Sticker!' : `${r.stickers.length} neue Sticker!`;
  return `<div class="sheet-head"><h2>${head || t}</h2><button class="icon-btn" data-act="close-sheet" aria-label="Schliessen">${ICON.close}</button></div>
    <div class="sheet-body center">${r.stickers.length ? newStickersHTML(r.stickers) : ''}${r.packs.length ? packsGotHTML(r.packs) : ''}
    ${r.packs.length ? '' : `<div class="confirm-actions"><button class="btn primary" data-act="album">${ICON.sticker}<span>Zum Album</span></button></div>`}</div>`;
}
/* Neue Päckchen: Bild, wofür, Knopf zum Öffnen */
const packsGotHTML = packs => `<div class="pack-row">${packs.slice(0, 4).map((k, i) => `<span class="pack-got" style="--i:${i}">${pochetteHTML(k, 'mini')}</span>`).join('')}</div>
  <p class="pack-why">${[...new Set(packs.map(packWhy))].map(esc).join(' · ')}</p>
  <button class="btn primary big" data-act="open-pack" data-unit="${paniniUnit()}">${ICON.pack}<span><b>Jetzt öffnen</b></span></button>`;
const paniniUnit = () => (isPanini(S.unit) ? S.unit : (ACTIVE.find(u => isPanini(u.n)) || { n: S.unit }).n);
function celebrate(r) {
  if (r.stickers.length) return celebrateSticker(r.stickers);
  if (!r.packs.length) return;
  sfx.sticker();
  leo([{ pause: 200 }, r.packs.includes('special') ? 'leo_champion' : r.packs.includes('punkte') ? 'leo_pochette' : 'leo_pochette_bonus'], true);
}
function celebrateSticker(ids) {
  sfx.sticker();
  leo([{ pause: 200 }, ids.some(id => STICKER[id].art === 'glitzer') ? 'leo_sticker_glitzer' : 'leo_sticker'], true);
}

/* ------------------------------------------------- Päckchen öffnen (Panini)
   Ein Overlay über allem: zuerst das Päckchen (antippen = aufreissen), dann die Sticker verdeckt; jeder wird mit Antippen
   umgedreht – seltene glitzern, Gold gibt eine Fanfare. Gezogen und eingeklebt wird beim Aufreissen (dann ist es gespeichert). */
const packRoot = document.getElementById('pack-root');
let PK = null;                       // { n, kind, got: [{id, neu}], shown: Set, torn }
function openPack(n) {
  if (!isPanini(n) || !nextPackKind(n)) return;
  closeSheet(true);
  PK = { n, kind: nextPackKind(n), got: [], shown: new Set(), torn: false };
  renderPack();
  requestAnimationFrame(() => packRoot.classList.add('open'));
  sfx.tap();
}
function tearPack() {
  if (!PK || PK.torn) return;
  const n = PK.n, p = pk(n), cards = unitStickers(n);
  const ids = PK.kind === 'special' ? L.specialPack(cards, S.stickers) : L.drawPack(cards);
  PK.got = L.stick({ have: S.stickers, dup: S.dup }, ids);
  PK.got.filter(g => g.neu).forEach(g => S.neu.push(g.id));
  p.opened++;
  if (PK.kind === 'special') p.special = 2;
  save();
  PK.torn = true;
  ids.forEach(id => { new Image().src = img(id); });
  Sound.preload(ids);
  sfx.tear();
  const el = packRoot.querySelector('.pack-stage');
  if (el && !reduced()) { el.classList.add('tearing'); setTimeout(renderPack, 650); } else renderPack();
}
function flipCard(i) {
  if (!PK || !PK.torn || PK.shown.has(i)) return;
  PK.shown.add(i);
  const g = PK.got[i], s = STICKER[g.id], el = packRoot.querySelector(`.pk-card[data-i="${i}"]`);
  if (el) el.classList.add('flipped');
  const lines = [];
  if (s.art === 'gold') { sfx.gold(); if (!reduced()) confetti(60); if (g.neu && voiceOn()) lines.push('leo_or', { pause: 150 }); }
  else if (s.art === 'glitzer') { sfx.sparkle(); if (el && !reduced()) burst(el, 14); if (g.neu && voiceOn()) lines.push('leo_rare', { pause: 150 }); }
  else sfx.flip();
  Sound.say(lines.concat([g.id]));
  if (PK.shown.size === PK.got.length) setTimeout(() => { if (PK) { const a = packRoot.querySelector('.pack-after'); if (a) a.innerHTML = packAfterHTML(); } }, 500);
}
function flipAll() { if (PK) PK.got.forEach((g, i) => { if (!PK.shown.has(i)) { PK.shown.add(i); } }); renderPack(); }
function packAfterHTML() {
  if (!PK || PK.shown.size < PK.got.length) return PK && PK.got.length > L.PACK_SIZE ? `<button class="btn" data-act="pack-all">Alle umdrehen</button>` : '<p class="pack-hint">Tippe die Sticker an, um sie umzudrehen!</p>';
  const neu = PK.got.filter(g => g.neu).length, dup = PK.got.length - neu, more = packsPending(PK.n);
  return `<p class="pack-sum">${neu ? `<b>${neu} neu</b>` : 'Nichts Neues'}${dup ? ` · ${dup} doppelt` : ''}${dup ? ' – Doppelte kannst du im Album tauschen.' : ''}</p>
    <div class="confirm-actions">${more ? `<button class="btn primary" data-act="open-pack" data-unit="${PK.n}">${ICON.pack}<span>Nächstes Päckchen (${more})</span></button>` : ''}
    <button class="btn ${more ? '' : 'primary'}" data-act="pack-album">${ICON.sticker}<span>Ins Album</span></button></div>`;
}
function renderPack() {
  if (!PK) { packRoot.innerHTML = ''; return; }
  const stage = !PK.torn
    ? `<button class="pack-stage" data-act="pack-tear" aria-label="Päckchen aufreissen">${pochetteHTML(PK.kind, 'big')}</button><p class="pack-hint">Tippe aufs Päckchen, um es aufzureissen!</p>`
    : `<div class="pk-cards n${PK.got.length <= L.PACK_SIZE ? L.PACK_SIZE : 'x'} ${PK.got.some(g => STICKER[g.id].format === 'quer') ? 'has-quer' : ''}">${PK.got.map((g, i) => {
        const s = STICKER[g.id], open = PK.shown.has(i);
        return `<button class="pk-card ${s.art} ${s.format} ${open ? 'flipped' : ''}" data-act="pack-flip" data-i="${i}" style="--i:${i}" aria-label="${open ? esc(s.titel) : 'Sticker umdrehen'}">
          <span class="pk-in"><span class="pk-back"><img src="icons/icon-192.png" alt=""></span>
          <span class="pk-front">${cardHTML(g.id)}<span class="pk-tags">${g.neu ? '<em class="t-neu">Neu</em>' : '<em class="t-dup">Doppelt</em>'}${s.art === 'gold' ? '<em class="t-gold">★★ Gold</em>' : s.art === 'glitzer' ? '<em class="t-glitzer">★ Glitzer</em>' : ''}</span></span></span>
          <span class="pk-name" lang="fr">${esc(s.rolle ? s.titel.split(',')[0] : s.titel)}</span></button>`;   // Spieler: nur der Name (Léo sagt den ganzen Titel)
      }).join('')}</div>`;
  packRoot.innerHTML = `<div class="pack-bg"></div><div class="pack-box" role="dialog" aria-modal="true" aria-label="Päckchen">
    <button class="icon-btn pack-x" data-act="pack-close" aria-label="Schliessen">${ICON.close}</button>
    <h2 class="pack-h">${PK.kind === 'special' ? 'Pochette spéciale!' : PK.torn ? 'Was ist drin?' : 'Ein Päckchen für dich!'}</h2>
    ${stage}<div class="pack-after">${PK.torn ? packAfterHTML() : ''}</div></div>`;
}
function closePack(then) {
  const n = PK ? PK.n : S.unit;
  PK = null;
  packRoot.classList.remove('open');
  packRoot.innerHTML = '';
  Sound.stop();
  if (then === 'album') { albumN = n; nav('album'); }
  else if (['home', 'album', 'result'].includes(view.name)) render();
  checkComplete(n);
}
/* Seite voll: einmal feiern */
function checkComplete(n) {
  if (!isPanini(n) || !pageFull(n) || pk(n).complete) return;
  pk(n).complete = true; save();
  setTimeout(() => { leo('leo_coupe_complete', true); sfx.gold(); if (!reduced()) confetti(80); }, 500);
}

/* ------------------------------------------------------ Tauschen bei Léo */
function tradeHTML(n, gotId) {
  const cards = unitStickers(n), ids = cards.map(s => s.id), dups = pageDups(n);
  const missing = cards.filter(s => !S.stickers.includes(s.id));
  const dupList = Object.entries(S.dup).filter(([id, k]) => ids.includes(id) && k > 0).sort((a, b) => NUM[a[0]] - NUM[b[0]]);
  const RAR = { normal: '', glitzer: '★ ', gold: '★★ ' };
  return `<div class="sheet-head"><h2>Tauschen bei Léo</h2><button class="icon-btn" data-act="close-sheet" aria-label="Schliessen">${ICON.close}</button></div>
  <div class="sheet-body tausch">
    ${gotId ? `<div class="tausch-got">${cardHTML(gotId, 'big')}<p><b>Eingetauscht und eingeklebt!</b></p></div>` : ''}
    <p class="tausch-info">Du hast <b>${dups} ${dups === 1 ? 'Doppelten' : 'Doppelte'}</b>. ${missing.length ? `Wähle einen Sticker, der dir fehlt. Preis: normal ${L.TRADE.normal}, ★ Glitzer ${L.TRADE.glitzer}, ★★ Gold ${L.TRADE.gold} Doppelte.` : 'Dir fehlt kein Sticker mehr!'}</p>
    ${missing.length ? `<div class="tausch-grid">${missing.map(s => {
      const cost = L.tradeCost(s), ok = dups >= cost;
      return `<button class="tausch-i ${s.art} ${ok ? '' : 'zu-teuer'}" data-act="trade" data-id="${s.id}" style="${teamColors(s)}">
        <span class="ti-num">${NUM[s.id]}</span><span class="ti-team">${s.team ? flagHTML(s.team) : ''}${s.team || 'WM'}</span>
        <span class="ti-kurz" lang="fr">${esc(s.kurz)}</span><span class="ti-cost">${RAR[s.art]}${cost} Doppelte</span></button>`;
    }).join('')}</div>` : ''}
    <h3 class="tausch-h">Deine Doppelten</h3>
    ${dupList.length ? `<div class="dup-list">${dupList.map(([id, k]) => `<button class="dup-i" data-act="sticker" data-id="${id}">${cardHTML(id, 'mini')}<b>×${k}</b></button>`).join('')}</div>` : '<p class="set-note">Noch keine Doppelten. Die bekommst du in den Päckchen.</p>'}
  </div>`;
}
function doTrade(id, btn) {
  const n = STICKER[id].unit, s = STICKER[id];
  if (!L.trade({ have: S.stickers, dup: S.dup }, s, unitStickers(n).map(x => x.id))) {
    nope(btn);
    const info = document.querySelector('.tausch-info');
    if (info) info.innerHTML = `Für <b lang="fr">${esc(s.kurz)}</b> brauchst du ${L.tradeCost(s)} Doppelte – du hast ${pageDups(n)}. Öffne weitere Päckchen!`;
    return;
  }
  S.neu.push(id); save();
  sfx.sticker();
  leo('leo_echange_ok');
  Sound.say(id, true);
  openSheet('tausch', tradeHTML(n, id));
  if (view.name === 'album') { const y = window.scrollY; render(); window.scrollTo(0, y); }
  checkComplete(n);
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
      <button class="brand" data-act="hello" aria-label="Wörtli-Frosch – Léo sagt Hallo"><img src="icons/icon-192.png" alt=""><span>Wörtli-Frosch</span></button>
      <div class="bar-right">
        <button class="pill ${S.neu.length || ACTIVE.some(x => isPanini(x.n) && packsPending(x.n) > 0) ? 'has-new' : ''}" data-act="album" aria-label="Stickeralbum: ${S.stickers.length} von ${D.stickers.length} Stickern">${ICON.sticker}<span class="pill-t">Album</span><b>${S.stickers.length}/${D.stickers.length}</b></button>
        <button class="icon-btn" data-act="settings" aria-label="Einstellungen">${ICON.gear}</button>
      </div>
    </header>
    <section class="hero" style="${unitColors(u)}">
      <button class="hero-leo" data-act="leo" aria-label="Léo antippen"><img src="${img('leo_hallo')}" alt="Léo, der Frosch, winkt"></button>
      <div class="bubble">
        <p class="bubble-hi" lang="fr">Salut${nm ? ` ${esc(nm)}` : ''} ! Moi, c'est Léo.</p>
        <p>Wir üben <b>${u.titel}</b> · ${esc(selName())}</p>
        <button class="btn primary big" data-act="start-leo"><span><b>Üben mit Léo</b><small>${sessionPreview()}</small></span>${ICON.next}</button>
        ${nextStkHTML()}
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
    ${buchKnopfHTML()}
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
  Q.packBefore = isPanini(S.unit) ? packPoints(S.unit) : 0;
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
  if (result === 'first' && t.kind !== 'karte') answerPoint(t.id);   // Päckchen-Punkt (nur Panini-Seiten)
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
  const res = { mode: Q.mode, firstRight, total: done.length, newSafe, grew, mistakes: [], gained: allPoints() - Q.ptsBefore,
    packGained: isPanini(S.unit) ? packPoints(S.unit) - Q.packBefore : 0 };
  if (Q.mode.typ === 'test') {
    res.mistakes = Q.results.filter(r => r && !r.first).map(r => ({ id: r.id, answer: r.answer || '' }));
    S.tests.push({ unit: S.unit, teil: S.teil, t: Date.now(), right: firstRight, total: done.length });
  }
  const got = checkStickers({ unit: S.unit, runde1: Q.mode.typ === 'leo', test100: Q.mode.typ === 'test' && res.total >= 10 && firstRight === res.total,
    serie10: Q.maxStreak >= 10 });
  res.stickers = got.stickers; res.packs = got.packs;
  save();
  Q = null;
  nav('result', { res });
  sfx.done();
  if (!reduced()) confetti(res.total && firstRight === res.total ? 70 : 40);
  leo([res.total && firstRight === res.total ? 'leo_perfekt' : line.fertig(), { pause: 300 }]);
  if (got.stickers.length || got.packs.length) setTimeout(() => celebrate(got), 900);
  else if (res.mode.typ === 'test' && res.mistakes.length) leo('leo_test_ueben', true);
}
function resultHTML(res) {
  const ws = words(), g = sicher(ws);
  const pct = res.total ? res.firstRight / res.total : 0;
  const isTest = res.mode.typ === 'test';
  const msg = !res.total ? 'Gut gemacht!' : pct === 1 ? (isTest ? 'Alles richtig – super!' : 'Alles auf Anhieb richtig!') : pct >= 0.8 ? 'Super gemacht!' : pct >= 0.5 ? 'Gut gemacht!' : 'Geschafft! Übung macht den Frosch stark.';
  const again = res.mode.typ === 'leo' ? 'start-leo' : 'mode';
  const showPack = !!(res.packs && res.packs.length && packsPending(paniniUnit()) > 0);   // Päckchen, die noch zu sind
  return `<div class="screen result">
    <div class="res-top"><img class="res-leo" src="${img('leo_jubel')}" alt="Léo jubelt">
      <div class="res-text"><h1>${msg}</h1>
        ${res.total ? `<p class="res-count"><b>${res.firstRight}</b> von ${res.total} ${isTest ? 'richtig geschrieben' : 'beim ersten Mal richtig'}</p>` : ''}
        ${isTest ? `<p class="res-note">${res.total ? Math.round(100 * pct) : 0} % – ${pct >= 0.9 ? 'bereit für den Test in der Schule!' : pct >= 0.7 ? 'fast bereit. Übe die Wörter unten nochmals.' : 'übe die Wörter unten mit Léo, dann nochmals testen.'}</p>` : ''}
      </div></div>
    ${res.stickers.length ? `<section class="res-stk"><h2>${res.stickers.length === 1 ? 'Neuer Sticker!' : `${res.stickers.length} neue Sticker!`}</h2>${newStickersHTML(res.stickers)}</section>` : ''}
    ${showPack ? `<section class="res-stk res-pack"><h2>${res.packs.length === 1 ? 'Neues Päckchen!' : `${res.packs.length} neue Päckchen!`}</h2>${packsGotHTML(res.packs)}</section>` : ''}
    ${res.mistakes.length ? `<section class="mistakes"><h2>Diese Wörter nochmals üben</h2>
      ${res.mistakes.map(m => { const w = WORD[m.id]; return `<div class="mis">${picHTML(w.id, 'mini')}<div><p class="de">${esc(w.de)}</p>
        <p class="fr" lang="fr">${frHTML(w)}</p>${m.answer ? `<p class="yours" lang="fr">Deine Antwort: <s>${show(m.answer)}</s></p>` : ''}</div>
        <button class="snd-btn" data-act="say" data-id="${w.id}" aria-label="Anhören">${ICON.speaker}</button></div>`; }).join('')}
      <button class="btn primary" data-act="drill-mistakes">${ICON.pencil}<span>Diese ${res.mistakes.length} Wörter üben</span></button></section>` : ''}
    <section class="grow">
      <div class="grow-row">${res.grew.slice(0, 12).map(id => `<span class="grow-w">${levelHTML(st(id).box)}<span lang="fr">${show(WORD[id].fr)}</span></span>`).join('')}</div>
      <p>${res.gained > 0 ? `<b>+${res.gained} ${res.gained === 1 ? 'Lernpunkt' : 'Lernpunkte'}.</b> ` : ''}${res.packGained > 0 ? `<b>+${res.packGained} ${res.packGained === 1 ? 'Punkt' : 'Punkte'} fürs Album.</b> ` : ''}${res.newSafe.length ? `${res.newSafe.length} ${res.newSafe.length === 1 ? 'Wort sitzt' : 'Wörter sitzen'} jetzt sicher. ` : ''}${g} von ${ws.length} Wörtern sicher.</p>
      ${showPack ? '' : nextStkHTML('wide')}
    </section>
    <div class="res-actions">
      <button class="btn primary big" data-act="${again}" ${again === 'mode' ? `data-mode="${isTest ? 'test' : res.mode.drill}"` : ''}>${ICON.again}<span><b>Nochmal</b></span></button>
      <button class="btn" data-act="album">${ICON.sticker}<span>Stickeralbum</span></button>
      ${res.stickers.length ? `<button class="btn" data-act="buch">${ICON.book}<span>Einkleben</span></button>` : ''}
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
      <span class="mback"><img src="icons/icon-192.png" alt=""></span>
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
    if (st(a.id).box === 0) S.w[a.id] = L.record(st(a.id), 'karte', 'first', S.round, Date.now());
    answerPoint(a.id);                                                // jedes Paar: 1 Päckchen-Punkt (Panini-Seiten)
    save();
    setTimeout(() => { sfx.right(Q.found.size); if (c.side !== 'wort') sayWord(a.id); }, 250);
    if (Q.found.size === 6) {
      const got = checkStickers({ unit: S.unit, memory9: Q.moves <= 9 });
      setTimeout(() => { sfx.done(); if (!reduced()) confetti(50); leo('leo_memory_fertig'); }, 900);
      setTimeout(() => { if (Q && Q.memory) { openSheet('mem-done', memDoneHTML(got)); celebrate(got); } }, 1600);
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
const memDoneHTML = got => `<div class="sheet-head"><h2>Alle Paare gefunden!</h2></div><div class="sheet-body center">
  ${got.stickers.length ? newStickersHTML(got.stickers) : got.packs.length ? packsGotHTML(got.packs) : `<img class="sheet-leo" src="${img('leo_jubel')}" alt="">`}<p class="confirm-text">Du hast ${Q ? Q.moves : ''} Züge gebraucht.</p>
  <div class="confirm-actions"><button class="btn" data-act="home">Übersicht</button><button class="btn primary" data-act="mode" data-mode="memory">${ICON.again}<span>Nochmal</span></button></div></div>`;

/* --------------------------------------------------------- Stickeralbum */
/* Eine Seite je Unité, oben umschalten (albumN = gewählte Seite, sonst die Unité, die man gerade übt) */
let albumN = null;
const albumPage = () => (albumN && UNIT[albumN] && UNIT[albumN].aktiv ? albumN : S.unit);
const PAGE_NAME = n => (isPanini(n) ? 'Coupe du monde' : 'Léo');
function albumHTML() {
  const n = albumPage(), page = unitStickers(n), have = new Set(S.stickers);
  const tabs = ACTIVE.length > 1 ? `<div class="seg album-seg" role="radiogroup" aria-label="Albumseite">${ACTIVE.map(x => {
    const dot = x.n !== n && (S.neu.some(id => STICKER[id].unit === x.n) || (isPanini(x.n) && packsPending(x.n) > 0));
    return `<button role="radio" aria-checked="${x.n === n}" data-act="album-page" data-v="${x.n}">${x.titel} · ${PAGE_NAME(x.n)}${dot ? ' <i class="dot"></i>' : ''}</button>`;
  }).join('')}</div>` : '';
  return `<div class="screen album ${isPanini(n) ? 'panini' : ''}">
    <header class="bar"><button class="icon-btn" data-act="home" aria-label="Zurück">${ICON.back}</button><h1 class="bar-title">Stickeralbum</h1><span class="count">${page.filter(s => have.has(s.id)).length}/${page.length}</span></header>
    ${tabs}${isPanini(n) ? paniniPageHTML(n) : leoPageHTML(n)}
  </div>`;
}
function leoPageHTML(n) {
  const have = new Set(S.stickers), neu = new Set(S.neu);
  const slot = (s, i) => have.has(s.id)
    ? `<button class="slot-stk got ${s.art === 'glitzer' ? 'glitzer' : ''} ${neu.has(s.id) ? 'is-new' : ''}" data-act="sticker" data-id="${s.id}" aria-label="${esc(s.titel)}">
        ${stickerImg(s.id)}<span class="stk-t" lang="fr">${esc(s.titel)}</span>${neu.has(s.id) ? '<em>Neu</em>' : ''}</button>`
    : `<div class="slot-stk empty ${s.art === 'glitzer' ? 'glitzer' : ''}"><span class="stk-n">${s.art === 'glitzer' ? ICON.star : i + 1}</span>
        <span class="stk-t">${s.art === 'glitzer' ? esc(bedingungText(s.bedingung)) : '?'}</span></div>`;
  const normal = unitStickers(n, 'normal'), glitzer = unitStickers(n, 'glitzer');
  const full = normal.concat(glitzer).every(s => have.has(s.id));
  return `<section class="album-top"><img class="album-leo" src="${img(full ? 'leo_jubel' : 'leo_cool')}" alt="Léo">
      <div><p class="album-intro">Für alle ${L.PER_STICKER} Lernpunkte in ${UNIT[n].titel} bekommst du einen neuen Sticker. Jedes Wort bringt bis zu 5 Lernpunkte – je besser du es kannst, desto mehr. Glitzer-Sticker gibt es für besondere Leistungen.</p>
      ${nextStkHTML('static', n)}
      <p class="album-pts">${unitPoints(n)} Lernpunkte in ${UNIT[n].titel}</p></div></section>
    ${buchKnopfHTML('small', 'Ins Sammelbuch einkleben')}
    <h2 class="album-h">Sticker <span>${normal.filter(s => have.has(s.id)).length} von ${normal.length}</span></h2>
    <section class="album-grid">${normal.map(slot).join('')}</section>
    <h2 class="album-h">Glitzer-Sticker <span>${glitzer.filter(s => have.has(s.id)).length} von ${glitzer.length}</span></h2>
    <section class="album-grid">${glitzer.map(slot).join('')}</section>`;
}
/* Panini-Seite: wie ein echtes Album – je Mannschaft ein Feld in ihren Farben, leere Plätze mit Nummer und Aufschrift */
const RAR_LABEL = { normal: '', glitzer: '★', gold: '★★' };
function paniniPageHTML(n) {
  const have = new Set(S.stickers), neu = new Set(S.neu), page = unitStickers(n), got = page.filter(s => have.has(s.id)).length;
  const dups = pageDups(n), cheapest = Math.min(...page.filter(s => !have.has(s.id)).map(L.tradeCost));
  const slot = s => have.has(s.id)
    ? `<button class="pslot got ${s.format} ${neu.has(s.id) ? 'is-new' : ''}" data-act="sticker" data-id="${s.id}" aria-label="${esc(s.titel)}">${cardHTML(s.id)}${neu.has(s.id) ? '<em>Neu</em>' : ''}${S.dup[s.id] ? `<b class="pdup">×${S.dup[s.id] + 1}</b>` : ''}</button>`
    : `<div class="pslot empty ${s.format} ${s.art}"><span class="pnum">${NUM[s.id]}</span><span class="plabel" lang="fr">${esc(s.kurz)}</span>${s.rolle ? `<span class="prole" lang="fr">${esc(s.rolle)}</span>` : ''}${RAR_LABEL[s.art] ? `<span class="prar">${RAR_LABEL[s.art]}</span>` : ''}</div>`;
  const block = (title, sub, list, style, flag) => `<section class="pteam" style="${style}">
    <header class="pband">${flag}<b lang="fr">${title}</b><span>${sub}</span><i>${list.filter(s => have.has(s.id)).length}/${list.length}</i></header>
    <div class="pgrid">${list.map(slot).join('')}</div></section>`;
  const spezial = page.filter(s => !s.team);
  return `<section class="ptop">
      <img class="ptop-leo" src="${img(got === page.length ? 'leo_jubel' : 'leo_fussball')}" alt="Léo">
      <div class="ptop-t"><h2 lang="fr">La Coupe du monde des grenouilles</h2><p class="ptop-sub">Die Frosch-WM · ${UNIT[n].titel} · ${got} von ${page.length} Stickern</p>
      <p class="album-intro">In ${UNIT[n].titel} gibt jede richtige Antwort einen Punkt – in allen Übungen –, und jeder Lernfortschritt auch. Alle ${L.PER_PACK} Punkte gibt es ein Päckchen mit ${L.PACK_SIZE} Stickern – manche sind selten! Doppelte kannst du bei Léo gegen fehlende tauschen. Sind alle Wörter sicher, ist die Seite voll.</p>
      ${nextStkHTML('static', n)}
      <div class="ptop-row"><button class="btn ${dups >= cheapest ? 'primary' : ''}" data-act="trade-open" data-unit="${n}" ${got === page.length && !dups ? 'disabled' : ''}>${ICON.swap}<span>Tauschen · ${dups} ${dups === 1 ? 'Doppelter' : 'Doppelte'}</span></button>
        <span class="plegend"><span class="lg normal">Normal</span><span class="lg glitzer">★ Glitzer: selten</span><span class="lg gold">★★ Gold: super selten</span></span></div></div></section>
    ${block('Spécial', 'Stadion, Ball, Pokal …', spezial, '--t1:#2D781B;--t2:#FFC83A', '<b class="pc-wm">★</b>')}
    ${D.teams.map(t => block(t.land, t.de, page.filter(s => s.team === t.id), `--t1:${t.farben[0]};--t2:${t.farben[1] || t.farben[0]}`, flagHTML(t.id))).join('')}`;
}
function stickerSheetHTML(id) {
  const s = STICKER[id];
  if (s.format) {
    const k = S.dup[id] || 0;
    return `<div class="sheet-head"><h2 lang="fr">${esc(s.titel)}</h2><button class="icon-btn" data-act="close-sheet" aria-label="Schliessen">${ICON.close}</button></div>
    <div class="sheet-body center stk-sheet">${cardHTML(id, 'big')}
      <button class="snd-btn" data-act="say-sticker" data-id="${id}" aria-label="Anhören">${ICON.speaker}</button>
      <p class="de">${esc(s.de)}</p><p class="set-note">Nr. ${NUM[id]}${s.art === 'gold' ? ' · ★★ Gold: super selten' : s.art === 'glitzer' ? ' · ★ Glitzer: selten' : ''}${k ? ` · ${k}× doppelt` : ''}</p></div>`;
  }
  return `<div class="sheet-head"><h2 lang="fr">${esc(s.titel)}</h2><button class="icon-btn" data-act="close-sheet" aria-label="Schliessen">${ICON.close}</button></div>
  <div class="sheet-body center stk-sheet">${stickerImg(id, 'big')}
    <button class="snd-btn" data-act="say-sticker" data-id="${id}" aria-label="Anhören">${ICON.speaker}</button>
    <p class="de">${esc(s.de)}</p>${s.art === 'glitzer' ? `<p class="set-note">Glitzer-Sticker: ${esc(bedingungText(s.bedingung))}</p>` : ''}</div>`;
}

/* ----------------------------------------------------------- Sammelbuch
   Wie beim Rechentiger und Wörtli-Panda (2026-10-26): ein Buch zum freien Einkleben der Léo-Sticker (ohne Panini-Karten) – aus dem Stapel unten auf eine Seite
   ziehen (oder antippen), verschieben, drehen (Knöpfe oder zwei Finger), wieder ablösen. Blättern mit den Pfeilen, Wischen
   oder den Pfeiltasten. Breiter Bildschirm: Doppelseite, sonst eine Seite. Jeder Sticker lässt sich genau einmal einkleben.
   Überarbeitet 2026-10-28 nach einem Video vom iPad (in allen drei Apps gleich): Blättern ohne Flackern (blaettern), Sticker
   ohne Aufblitzen (einkleben), Ziehen mit dem Finger auf iPhone/iPad (»Ziehen«). */
const BK = { busy: false, pend: null, drag: null, swipe: null, roll: null, rollRaf: 0, sel: null, L: null, from: 'home', nr: 0, schluck: false };
const STICKER_BREITE = 0.32;                  // Anteil der Seitenbreite (gleich wie .pst in style.css)
const stickerBild = s => img(s);
const stickerName = s => STICKER[s].de;
const eingeklebt = () => S.buch.placed.filter(x => S.stickers.includes(x.s));
const buchAlle = () => S.stickers.filter(buchSticker);                                    // nur Léo-Sticker, keine Panini-Karten
const freieSticker = () => buchAlle().filter(s => !S.buch.placed.some(x => x.s === s)).reverse();      // der neuste zuerst
const buchStand = () => (buchAlle().length ? `${eingeklebt().length} von ${buchAlle().length} Stickern eingeklebt` : 'Hier klebst du deine Sticker ein');
const buchKnopfHTML = (cls = '', title = 'Mein Sammelbuch') => `<button class="book-banner ${cls}" data-act="buch">
  <span class="bb-book" aria-hidden="true">${ICON.book}</span><span class="bb-text"><b>${title}</b><small>${buchStand()}</small></span>${ICON.fwd}</button>`;
function seiteInfo(p) {
  if (p === 0) return { art: 'umschlag' };
  if (p === 1) return { art: 'exlibris' };
  if (p === 2) return { art: 'titel' };
  return { art: 'szene', szene: Math.floor((p - 3) / 2), links: (p - 3) % 2 === 0, nr: p - 2 };
}
/* Doppelseiten: 0 = zu (nur der Umschlag, rechts), 1 = Seiten 1 + 2, 2 = 3 + 4 … */
const blattVon = p => (p === 0 ? 0 : Math.ceil(p / 2));
const seitenVon = s => (s === 0 ? [null, 0] : [2 * s - 1, 2 * s]);
const LETZTES_BLATT = blattVon(BUCH_SEITEN - 1);
const knoten = html => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };   // lädt die Bilder schon
const pstEl = s => document.querySelector(`#book .spread .pst[data-s="${CSS.escape(s)}"]`);

function buchHTML() {
  return `<div class="screen buch" id="buch">
    <header class="bar">
      <button class="icon-btn" data-act="buch-zu" aria-label="Zurück">${ICON.back}</button>
      <h1 class="bar-title">Sammelbuch</h1>
      <span class="count" id="buch-count"></span>
    </header>
    <div class="stage" id="stage"><div class="book" id="book"></div></div>
    <nav class="buch-nav">
      <button class="icon-btn" data-act="blatt" data-d="-1" id="blatt-zurueck" aria-label="Zurückblättern">${ICON.back}</button>
      <span class="buch-wo" id="buch-wo"></span>
      <button class="icon-btn" data-act="blatt" data-d="1" id="blatt-vor" aria-label="Weiterblättern">${ICON.fwd}</button>
    </nav>
    <section class="tray" id="tray" aria-label="Deine Sticker zum Einkleben"></section>
    <div class="st-tools" id="st-tools" hidden>
      <button data-act="st-rot" data-d="-15" aria-label="Nach links drehen">${ICON.rotL}</button>
      <button data-act="st-rot" data-d="15" aria-label="Nach rechts drehen">${ICON.rotR}</button>
      <button class="weg" data-act="st-weg">${ICON.peel}<span>Ablösen</span></button>
    </div>
  </div>`;
}
function oeffneBuch() {
  BK.from = view.name === 'album' ? 'album' : 'home';
  Sound.preload(['blaettern', 'kleben', 'abloesen', 'leo_buch_start', 'leo_buch_klebt', 'leo_buch_leer']);
  nav('buch');
  if (!S.buch.seen) { S.buch.seen = true; save(); leo('leo_buch_start'); }        // die Erklärung nur beim ersten Mal
  else if (buchAlle().length && !freieSticker().length) leo('leo_buch_leer');
}
function buchZeigen() { zeichneStapel(); zeichneBuch(); }          // zuerst der Stapel: seine Höhe bestimmt die Buchgrösse
function buchAufraeumen() {
  if (BK.drag) BK.drag.g.remove();
  stoppeRollen();
  Object.assign(BK, { drag: null, pend: null, swipe: null, roll: null, sel: null, busy: false, nr: BK.nr + 1 });
}
/* Wie gross wird eine Seite? Seiten sind 3 : 4 (hoch). Doppelseite, wenn genug Breite da ist (iPad quer, PC). */
function buchMasse() {
  const st = document.getElementById('stage'), W = st.clientWidth, H = st.clientHeight - 20;
  const doppel = W >= 640 && W / H >= 1.15;
  const pw = Math.floor(Math.max(120, doppel ? Math.min(W / 2 - 16, H * 0.75) : Math.min(W - 20, H * 0.75)));
  return { doppel, pw, ph: Math.round(pw / 0.75) };
}
const masseNeu = () => { const L = buchMasse(); return !BK.L || L.pw !== BK.L.pw || L.doppel !== BK.L.doppel; };
/* Das ganze Buch neu – nur beim Öffnen, bei einer neuen Bildschirmgrösse und ohne Animationen; sonst wird nur verschoben */
function zeichneBuch() {
  const book = document.getElementById('book');
  if (!book) return;
  const L = BK.L = buchMasse(), s = blattVon(S.buch.p);
  const [l, r] = L.doppel ? seitenVon(s) : [null, S.buch.p];
  book.className = `book ${L.doppel ? 'doppel' : 'einzel'}${L.doppel && s === 0 ? ' zu' : ''}`;
  book.style.setProperty('--pw', `${L.pw}px`);
  book.style.setProperty('--ph', `${L.ph}px`);
  book.innerHTML = `<div class="spread">${L.doppel ? seiteHTML(l, 'links') : ''}${seiteHTML(r, L.doppel ? 'rechts' : 'solo')}</div>`;
  buchLeiste();
}
/* Pfeile, »Seite … · …«, Zähler oben rechts und Werkzeug – passend zur aufgeschlagenen Seite */
function buchLeiste() {
  const L = BK.L, s = blattVon(S.buch.p);
  document.getElementById('blatt-vor').disabled = L.doppel ? s >= LETZTES_BLATT : S.buch.p >= BUCH_SEITEN - 1;
  document.getElementById('blatt-zurueck').disabled = S.buch.p === 0;
  document.getElementById('buch-wo').textContent = woText(L.doppel, s);
  const n = eingeklebt().length, c = document.getElementById('buch-count');
  c.textContent = `${n}/${buchAlle().length}`;
  c.setAttribute('aria-label', `${n} von ${buchAlle().length} Stickern eingeklebt`);
  if (BK.sel != null && !pstEl(BK.sel)) BK.sel = null;
  zeigeWerkzeug();
}
function woText(doppel, s) {
  const p = S.buch.p;
  if (p === 0) return 'Umschlag';
  if (doppel ? s === 1 : p <= 2) return doppel ? 'Vorne im Buch' : p === 1 ? 'Dieses Buch gehört …' : 'Titelseite';
  const a = seiteInfo(doppel ? 2 * s - 1 : p);
  return doppel ? `Seite ${a.nr}–${a.nr + 1} · ${SZENEN[a.szene][1]}` : `Seite ${a.nr} von ${2 * SZENEN.length} · ${SZENEN[a.szene][1]}`;
}
const pstHTML = x => `<img class="pst${BK.sel === x.s ? ' sel' : ''}" data-act="pst" data-s="${x.s}" src="${stickerBild(x.s)}" alt="${esc(stickerName(x.s))}" draggable="false" style="left:${x.x}%;top:${x.y}%;--r:${x.r}deg">`;
/* Eine Seite mit ihren Stickern (zuletzt geklebt = zuoberst) */
function seiteHTML(p, seite) {
  if (p == null) return `<div class="page ${seite} leer"></div>`;
  const a = seiteInfo(p);
  if (a.art === 'umschlag') {
    return `<div class="page ${seite} umschlag" data-act="buch-auf" style="background-image:url(${img('buch_umschlag')})">
      <span class="u-titel"><small>Mein</small><b>Frosch-Sammelbuch</b></span>
      <span class="u-bild"><img src="${img('leo_hallo')}" alt=""></span>
      <span class="u-name">${esc(name())}</span>
    </div>`;
  }
  let inhalt = '', stil = '', cls = a.art;
  if (a.art === 'exlibris') {
    inhalt = `<div class="exlibris-rahmen"><img src="${img('leo_hallo')}" alt=""><span class="ex-klein">Dieses Buch gehört</span>
      <span class="ex-name">${esc(name()) || '…………'}</span><span class="ex-deko">${ICON.star}${ICON.star}${ICON.star}</span></div>`;
  } else if (a.art === 'titel') {
    inhalt = `<div class="titel-inhalt"><span class="t-klein">Mein</span><span class="t-gross">Frosch-Sammelbuch</span><img src="${img('leo_jubel')}" alt="">
      <span class="t-text">Zieh deine Sticker von unten auf eine Seite und kleb sie ein, wo du willst. Tippst du einen an, kannst du ihn drehen oder ablösen.</span></div>`;
  } else {
    stil = ` style="background-image:url(${img('seite_' + SZENEN[a.szene][0])})"`;
    cls += a.links ? ' halb-l' : ' halb-r';
    inhalt = `${a.links ? `<span class="szene-name">${SZENEN[a.szene][1]}</span>` : ''}<span class="seiten-nr">${a.nr}</span>`;
  }
  const st = S.buch.placed.filter(x => x.p === p && S.stickers.includes(x.s));
  return `<div class="page ${seite} ${cls}" data-p="${p}"${stil}>${inhalt}${st.map(pstHTML).join('')}<i class="falz" aria-hidden="true"></i></div>`;
}
const stapelKnopfHTML = s => `<button class="tray-st" data-act="tray-st" data-s="${s}" aria-label="${esc(stickerName(s))} einkleben"><img src="${stickerBild(s)}" alt="" draggable="false"></button>`;
function zeichneStapel() {
  const t = document.getElementById('tray');
  if (!t) return;
  const frei = freieSticker();
  t.innerHTML = frei.length
    ? `<div class="tray-kopf"><b>Deine Sticker (${frei.length})</b><span>Nach oben auf eine Seite ziehen oder antippen</span></div>
      <div class="tray-row">${frei.map(stapelKnopfHTML).join('')}</div>`
    : `<p class="tray-leer">${buchAlle().length ? 'Alle deine Sticker sind eingeklebt. Neue bekommst du, wenn du Wörter lernst.' : 'Noch keine Léo-Sticker. Übe mit Léo – dann bekommst du den ersten! (Die Fussball-Sticker bleiben im Album.)'}</p>`;
}
/* Stapel ohne ihn neu zu zeichnen: einen Sticker herausnehmen / zurücklegen (bild = sein <img>, wird wiederverwendet) */
function stapelWeg(s) {
  const b = document.querySelector(`#tray .tray-st[data-s="${CSS.escape(s)}"]`), n = freieSticker().length;
  if (b) b.remove();
  if (!n || !b) { zeichneStapel(); if (masseNeu()) zeichneBuch(); return; }
  document.querySelector('#tray .tray-kopf b').textContent = `Deine Sticker (${n})`;
}
function stapelDazu(s, bild) {
  const row = document.querySelector('#tray .tray-row'), frei = freieSticker();
  if (!row) { zeichneStapel(); if (masseNeu()) zeichneBuch(); return; }
  const b = knoten(stapelKnopfHTML(s)), i = frei.indexOf(s), nach = frei.slice(i + 1).map(x => row.querySelector(`.tray-st[data-s="${CSS.escape(x)}"]`)).find(Boolean);
  if (bild) {
    ['class', 'style', 'data-act', 'data-s'].forEach(a => bild.removeAttribute(a));
    bild.alt = '';
    b.firstElementChild.replaceWith(bild);
  }
  row.insertBefore(b, nach || null);
  document.querySelector('#tray .tray-kopf b').textContent = `Deine Sticker (${frei.length})`;
}

/* ---- Blättern (neu 2026-10-28): das Blatt hebt sich vom Buchrücken, steht senkrecht und legt sich auf die andere Seite.
   Das sind zwei flache Hälften nacheinander (.halb.hoch, dann .halb.runter) statt einer 3D-Karte mit Vorder- und Rückseite:
   bei der Karte liess Safari auf dem iPad die Rückseite gespiegelt durchscheinen und zeigte am Ende kurz die alte Seite.
   Nichts wird neu gezeichnet: die aufgeschlagene Seite wird zum Blatt, das Blatt am Ende wieder zur Seite. Neue Seiten werden
   vorher fertig geladen (decode), damit kein Bild und kein Sticker nachträglich aufblitzt. danach = was nach dem Blättern kommt. */
const BLATT_MS = 700;                          // beide Hälften zusammen (style.css: je .35s)
function blaettern(d, danach) {
  if (BK.busy || BK.drag || !BK.L) return;
  const L = BK.L, p0 = S.buch.p;
  let p1;
  if (L.doppel) {
    const s1 = blattVon(p0) + d;
    if (s1 < 0 || s1 > LETZTES_BLATT) return;
    p1 = s1 === 0 ? 0 : 2 * s1 - 1;
  } else {
    p1 = p0 + d;
    if (p1 < 0 || p1 >= BUCH_SEITEN) return;
  }
  waehle(null);
  S.buch.p = p1;
  save();
  if (reduced()) { Sound.fx('blaettern'); zeichneBuch(); if (danach) danach(); return; }
  BK.busy = true;
  const nr = ++BK.nr, book = document.getElementById('book'), spread = book.querySelector('.spread');
  book.classList.add('blaettert');
  // hoch = aufgeschlagene Seite, die sich hebt; unten = neue Seite darunter; runter = Seite, die sich hinlegt und am Ende ersetzt
  let hoch = null, unten = null, runter = null, ersetzt = null, art;
  if (L.doppel) {
    const [l1, r1] = seitenVon(blattVon(p1)), [links, rechts] = spread.children;
    if (d > 0) { art = 'vor'; hoch = rechts; unten = knoten(seiteHTML(r1, 'rechts')); runter = knoten(seiteHTML(l1, 'links')); ersetzt = links; }
    else { art = 'zurueck'; hoch = links; unten = knoten(seiteHTML(l1, 'links')); runter = knoten(seiteHTML(r1, 'rechts')); ersetzt = rechts; }
  } else if (d > 0) { art = 'weg'; hoch = spread.firstElementChild; unten = knoten(seiteHTML(p1, 'solo')); }
  else { art = 'her'; runter = knoten(seiteHTML(p1, 'solo')); ersetzt = spread.firstElementChild; }
  bilderBereit([unten, runter]).then(() => {
    if (nr !== BK.nr || !book.isConnected) return;
    Sound.fx('blaettern');
    const leaf = document.createElement('div');
    leaf.className = `leaf ${art}`;
    if (hoch) { hoch.replaceWith(unten); leaf.appendChild(document.createElement('div')).className = 'halb hoch'; leaf.lastChild.appendChild(hoch); }
    if (runter) { leaf.appendChild(document.createElement('div')).className = 'halb runter'; leaf.lastChild.appendChild(runter); }
    book.appendChild(leaf);
    if (L.doppel) book.classList.toggle('zu', blattVon(p1) === 0);              // zuklappen / aufklappen: das Buch rutscht in die Mitte
    document.getElementById('buch-wo').textContent = woText(L.doppel, blattVon(p1));
    let fertig = false;
    const ende = () => {
      if (fertig || nr !== BK.nr) return;
      fertig = true;
      if (runter) ersetzt.replaceWith(runter);
      leaf.remove();
      book.classList.remove('blaettert');
      BK.busy = false;
      buchLeiste();
      if (danach && view.name === 'buch') danach();
    };
    const letzte = leaf.lastChild;
    leaf.addEventListener('animationend', e => { if (e.target === letzte && e.animationName.startsWith('halb')) ende(); });
    setTimeout(ende, BLATT_MS + 250);                                          // falls kein animationend kommt
  });
}
/* Wartet, bis die Bilder der Seiten entpackt sind (höchstens ms), damit sie beim Blättern gleich ganz da sind */
function bilderBereit(seiten, ms = 400) {
  const warte = i => (i.decode ? i.decode().catch(() => {}) : Promise.resolve());
  const jobs = [];
  seiten.filter(Boolean).forEach(e => {
    e.querySelectorAll('img').forEach(i => jobs.push(warte(i)));
    const bg = /url\(["']?([^"')]+)/.exec(e.style.backgroundImage || '');
    if (bg) { const i = new Image(); i.src = bg[1]; jobs.push(warte(i)); }
  });
  return Promise.race([Promise.all(jobs), new Promise(res => setTimeout(res, ms))]);
}

/* ---- Einkleben, auswählen, drehen, ablösen. Seit 2026-10-28 ohne das Buch neu zu zeichnen (sonst blitzten auf dem iPad alle
   Sticker kurz auf): das Bild, das man gezogen oder angetippt hat, wird selbst zum eingeklebten Sticker. ---- */
function einkleben(s, p, x, y, r, bild) {
  const alt = S.buch.placed.findIndex(i => i.s === s), neu = alt < 0;
  const item = neu ? { s } : S.buch.placed.splice(alt, 1)[0];
  Object.assign(item, { p, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: Math.round(r) });
  S.buch.placed.push(item);                    // zuletzt geklebt = zuoberst
  save();
  Sound.fx('kleben');
  BK.sel = null;
  const e = pstEl(s) || (bild && bild.tagName === 'IMG' ? bild : knoten(pstHTML(item)));
  e.className = 'pst';
  e.style.cssText = `left:${item.x}%;top:${item.y}%;--r:${item.r}deg`;
  Object.assign(e.dataset, { act: 'pst', s });
  e.alt = stickerName(s);
  e.draggable = false;
  const seite = document.querySelector(`#book .spread .page[data-p="${p}"]`);
  if (seite) seite.insertBefore(e, seite.querySelector('.falz'));
  if (neu) stapelWeg(s);
  if (!reduced()) { void e.offsetWidth; e.classList.add('klebt'); }
  buchLeiste();
  if (neu && eingeklebt().length === 1) leo('leo_buch_klebt');        // beim allerersten Sticker
}
/* Antippen im Stapel: auf die sichtbare Seite mit weniger Stickern, ungefähr in die Mitte */
function antippenEinkleben(s) {
  if (BK.schluck) { BK.schluck = false; return; }           // das »click« am Ende von Ziehen/Scrollen (Maus) zählt nicht
  if (BK.busy || BK.drag) return;
  if (S.buch.p === 0) { blaettern(1, () => antippenEinkleben(s)); return; }
  const ziel = [...document.querySelectorAll('#book .spread .page[data-p]')].map(e => +e.dataset.p).filter(p => p > 0)
    .map(p => ({ p, n: S.buch.placed.filter(x => x.p === p).length })).sort((a, b) => a.n - b.n || b.p - a.p)[0];
  const b = document.querySelector(`#tray .tray-st[data-s="${CSS.escape(s)}"] img`);
  if (ziel) einkleben(s, ziel.p, 30 + Math.random() * 40, 30 + Math.random() * 40, Math.random() * 20 - 10, b);
}
function waehle(s) {
  BK.sel = s;
  document.querySelectorAll('#book .pst.sel').forEach(e => e.classList.remove('sel'));
  const el = s != null && pstEl(s);
  if (el) el.classList.add('sel'); else BK.sel = null;
  zeigeWerkzeug();
}
/* Die kleine Leiste über dem gewählten Sticker: drehen, ablösen */
function zeigeWerkzeug() {
  const t = document.getElementById('st-tools');
  if (!t) return;
  const el = BK.sel != null && pstEl(BK.sel);
  t.hidden = !el;
  if (!el) return;
  const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth;
  let top = r.top - t.offsetHeight - 10;
  if (top < 8) top = r.bottom + 10;
  t.style.left = `${Math.max(8, Math.min(vw - t.offsetWidth - 8, r.left + r.width / 2 - t.offsetWidth / 2))}px`;
  t.style.top = `${top}px`;
}
function drehen(d) {
  const x = S.buch.placed.find(i => i.s === BK.sel);
  if (!x) return;
  x.r = ((x.r + d + 540) % 360) - 180;
  save();
  sfx.tap();
  const el = pstEl(BK.sel);
  if (el) el.style.setProperty('--r', `${x.r}deg`);
  zeigeWerkzeug();
}
function abloesen(s, leise) {
  const k = S.buch.placed.findIndex(i => i.s === s);
  if (k < 0) return;
  S.buch.placed.splice(k, 1);
  save();
  if (leise) sfx.tap(); else Sound.fx('abloesen');
  BK.sel = null;
  const e = pstEl(s);
  stapelDazu(s, e);
  if (e && e.closest('#book')) e.remove();
  buchLeiste();
}

/* ---- Ziehen: mit einem Finger (oder der Maus) verschieben, ein zweiter Finger dreht.
   iPhone/iPad (2026-10-28): Safari nahm das Ziehen aus dem Stapel als Scrollen und brach es ab (pointercancel). Darum
   scrollt der Stapel jetzt selbst (touch-action: none in style.css): seitwärts wischen = Stapel scrollen, nach oben ziehen =
   Sticker nehmen. Solange etwas gezogen wird, verhindert touchmove zusätzlich jedes Scrollen der Seite. ---- */
const punkt = e => ({ x: e.clientX, y: e.clientY });
app.addEventListener('pointerdown', e => {
  if (view.name !== 'buch') return;
  BK.schluck = false;
  if (BK.busy) return;
  if (BK.drag) {                                // zweiter Finger: ab jetzt wird gedreht
    if (e.pointerType === 'touch' && BK.drag.ptr.size === 1) { BK.drag.ptr.set(e.pointerId, punkt(e)); BK.drag.w0 = null; }
    return;
  }
  if (BK.roll) return;
  stoppeRollen();
  const tray = e.target.closest('.tray-st'), pst = e.target.closest('#book .spread .pst'), row = e.target.closest('.tray-row');
  if (tray) BK.pend = { art: 'neu', s: tray.dataset.s, el: tray, row, id: e.pointerId, ...punkt(e) };
  else if (pst) { BK.pend = { art: 'zug', s: pst.dataset.s, el: pst, id: e.pointerId, ...punkt(e) }; e.preventDefault(); }
  else if (row) rollStart({ row, id: e.pointerId, ...punkt(e) });
  else if (e.target.closest('#book')) BK.swipe = { id: e.pointerId, ...punkt(e) };
  if (!e.target.closest('.st-tools, #book .pst')) waehle(null);
});
window.addEventListener('pointermove', e => {
  if (view.name !== 'buch') return;
  const pd = BK.pend;
  if (pd && e.pointerId === pd.id) {
    const dx = e.clientX - pd.x, dy = e.clientY - pd.y;
    if (pd.art === 'neu') {             // schräg nach oben (auch flach, zum Buch auf dem breiten iPad): den Sticker nehmen
      const weit = Math.hypot(dx, dy), scrollt = pd.row && pd.row.scrollWidth > pd.row.clientWidth + 2;
      if (weit > 8 && (!scrollt || -dy >= Math.abs(dx) * 0.35 || (weit > 24 && dy < 0))) ziehStart(pd, e);
      else if ((Math.abs(dx) > 10 && Math.abs(dy) < Math.abs(dx) * 0.35) || weit > 24) { BK.pend = null; rollStart(pd); }   // seitwärts: Stapel scrollen
    } else if (Math.hypot(dx, dy) > 6) ziehStart(pd, e);
  }
  if (BK.roll && e.pointerId === BK.roll.id) rollen(e);
  const dr = BK.drag;
  if (dr && dr.ptr.has(e.pointerId)) { dr.ptr.set(e.pointerId, punkt(e)); ziehBewegen(); }
}, { passive: true });
// Safari (iPhone/iPad): solange im Buch etwas gezogen, gewischt oder gescrollt wird, nicht die Seite verschieben
document.addEventListener('touchmove', e => {
  if (view.name === 'buch' && (BK.pend || BK.drag || BK.roll || BK.swipe) && e.cancelable) e.preventDefault();
}, { passive: false });
/* Den Stapel mit dem Finger scrollen, mit etwas Schwung beim Loslassen */
function rollStart(pd) { BK.roll = { id: pd.id, row: pd.row, x: pd.x, left: pd.row.scrollLeft, lx: pd.x, t: performance.now(), v: 0 }; }
function rollen(e) {
  const ro = BK.roll, t = performance.now(), dt = t - ro.t;
  if (dt > 0) ro.v = 0.7 * ((ro.lx - e.clientX) / dt) + 0.3 * ro.v;       // Pixel pro Millisekunde
  ro.t = t; ro.lx = e.clientX;
  ro.row.scrollLeft = ro.left - (e.clientX - ro.x);
}
function rollEnde() {
  const ro = BK.roll;
  BK.roll = null;
  BK.schluck = true;
  let v = performance.now() - ro.t > 90 ? 0 : ro.v, t0 = performance.now();
  const schritt = t => {
    const dt = t - t0; t0 = t;
    ro.row.scrollLeft += v * dt;
    v *= Math.pow(0.995, dt);
    BK.rollRaf = Math.abs(v) > 0.02 && ro.row.isConnected ? requestAnimationFrame(schritt) : 0;
  };
  if (Math.abs(v) > 0.05) BK.rollRaf = requestAnimationFrame(schritt);
}
function stoppeRollen() { if (BK.rollRaf) cancelAnimationFrame(BK.rollRaf); BK.rollRaf = 0; }
function ziehStart(pd, e) {
  BK.pend = null;
  const zug = pd.art === 'zug', x = zug && S.buch.placed.find(i => i.s === pd.s);
  if (zug && !x) return;
  const size = BK.L.pw * STICKER_BREITE;
  let off = { x: 0, y: size * 0.3 };          // ein neuer Sticker hängt etwas über dem Finger, damit man ihn sieht
  if (zug) {
    const r = pd.el.getBoundingClientRect();
    off = { x: pd.x - (r.left + r.width / 2), y: pd.y - (r.top + r.height / 2) };
    pd.el.style.visibility = 'hidden';
  } else pd.el.classList.add('weg');
  const g = document.createElement('img');
  g.className = 'ghost'; g.alt = ''; g.draggable = false; g.src = stickerBild(pd.s);
  g.style.width = `${size}px`;
  fxRoot.appendChild(g);
  BK.drag = { art: pd.art, s: pd.s, el: pd.el, g, off, r: zug ? x.r : Math.round(Math.random() * 16 - 8),
    ptr: new Map([[pd.id, punkt(e)]]), haupt: pd.id, w0: null, r0: 0, cx: 0, cy: 0 };
  waehle(null);
  Sound.fx('abloesen');
  ziehBewegen();
}
function ziehBewegen() {
  const dr = BK.drag, pts = [...dr.ptr.values()];
  if (pts.length >= 2) {
    const w = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) * 180 / Math.PI;
    if (dr.w0 == null) { dr.w0 = w; dr.r0 = dr.r; }
    dr.r = Math.round(dr.r0 + w - dr.w0);
  }
  const h = dr.ptr.get(dr.haupt) || pts[0];
  dr.cx = h.x - dr.off.x; dr.cy = h.y - dr.off.y;
  dr.g.style.transform = `translate3d(${dr.cx}px, ${dr.cy}px, 0) translate(-50%, -50%) rotate(${dr.r}deg) scale(1.08)`;
  const ziel = zielBei(dr.cx, dr.cy, dr.art);
  document.querySelectorAll('#buch .ziel').forEach(e => { if (e !== ziel) e.classList.remove('ziel'); });
  if (ziel) ziel.classList.add('ziel');
}
/* Wohin würde der Sticker jetzt geklebt? Eine Seite (nicht der Umschlag) – oder zurück in den Stapel */
function zielBei(x, y, art) {
  for (const e of document.elementsFromPoint(x, y)) {
    if (e.closest('#tray')) return art === 'zug' ? document.getElementById('tray') : null;
    const p = e.closest('#book .spread .page[data-p]');
    if (p && +p.dataset.p > 0) return p;
  }
  return null;
}
function buchLos(e) {
  if (view.name !== 'buch') return;
  if (BK.pend && e.pointerId === BK.pend.id) BK.pend = null;          // nur getippt: das macht »click«
  if (BK.roll && e.pointerId === BK.roll.id) rollEnde();
  const sw = BK.swipe;
  if (sw && e.pointerId === sw.id) {
    BK.swipe = null;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (e.type === 'pointerup' && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) blaettern(dx < 0 ? 1 : -1);
  }
  const dr = BK.drag;
  if (!dr || !dr.ptr.has(e.pointerId)) return;
  dr.ptr.delete(e.pointerId);
  dr.w0 = null;
  if (e.pointerId === dr.haupt && dr.ptr.size) {      // der erste Finger ist weg: der andere zieht weiter
    const [id, p] = [...dr.ptr.entries()][0];
    dr.haupt = id; dr.off = { x: p.x - dr.cx, y: p.y - dr.cy };
  }
  if (!dr.ptr.size) ziehEnde(e.type === 'pointercancel');
}
window.addEventListener('pointerup', buchLos);
window.addEventListener('pointercancel', buchLos);
function ziehEnde(abbruch) {
  const dr = BK.drag;
  BK.drag = null;
  BK.schluck = true;
  document.querySelectorAll('#buch .ziel').forEach(e => e.classList.remove('ziel'));
  const ziel = abbruch ? null : zielBei(dr.cx, dr.cy, dr.art);
  if (ziel && ziel.dataset.p) {                                        // der gezogene Sticker (bzw. sein Bild) wird eingeklebt
    const r = ziel.getBoundingClientRect(), fit = v => Math.min(94, Math.max(6, v));
    if (dr.art === 'zug') dr.g.remove();
    einkleben(dr.s, +ziel.dataset.p, fit((dr.cx - r.left) / r.width * 100), fit((dr.cy - r.top) / r.height * 100), dr.r, dr.art === 'zug' ? dr.el : dr.g);
    return;
  }
  dr.g.remove();
  if (ziel && dr.art === 'zug') abloesen(dr.s, true);         // in den Stapel gezogen = abgelöst
  else {                                                         // daneben: alles bleibt, wie es war
    dr.el.style.visibility = '';
    dr.el.classList.remove('weg');
    sfx.tap();
  }
}
window.addEventListener('resize', () => { if (view.name === 'buch' && !BK.busy && !BK.drag && masseNeu()) zeichneBuch(); });

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
packRoot.addEventListener('click', onClick);
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
      sfx.tap(); albumN = b.dataset.unit ? +b.dataset.unit : S.unit; nav('album');
      if (!S.albumSeen) { S.albumSeen = true; save(); leo('leo_album'); }
      else if (S.stickers.length === D.stickers.length) leo('leo_album_voll');
      break;
    case 'album-page': sfx.tap(); albumN = +b.dataset.v; render(); window.scrollTo(0, 0); break;
    case 'open-pack': openPack(+b.dataset.unit || paniniUnit()); break;
    case 'pack-tear': tearPack(); break;
    case 'pack-flip': flipCard(+b.dataset.i); break;
    case 'pack-all': flipAll(); break;
    case 'pack-close': closePack(); break;
    case 'pack-album': closePack('album'); break;
    case 'trade-open': sfx.tap(); openSheet('tausch', tradeHTML(+b.dataset.unit || albumPage())); leo('leo_echange'); break;
    case 'trade': doTrade(b.dataset.id, b); break;
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
    case 'reset': openSheet('reset', confirmHTML('Alles zurücksetzen?', 'Alle Lernstände, alle Sticker und das Sammelbuch werden gelöscht. Das lässt sich nicht rückgängig machen.', 'Zurücksetzen', 'reset-yes')); break;
    case 'reset-yes': S.w = {}; S.round = 0; S.tests = []; S.stickers = []; S.neu = []; S.dup = {}; S.pk = {}; S.buch = buchLaden(null); S.albumSeen = false; save(); closeSheet(true); nav('home', {}, false); break;
    case 'hint-close': S.hintClosed = true; save(); refreshInstall(); break;
    case 'buch': sfx.tap(); oeffneBuch(); break;
    case 'buch-zu': sfx.tap(); nav(BK.from); break;
    case 'blatt': blaettern(+b.dataset.d); break;
    case 'buch-auf': blaettern(1); break;
    case 'tray-st': antippenEinkleben(b.dataset.s); break;
    case 'pst': sfx.tap(); waehle(BK.sel === b.dataset.s ? null : b.dataset.s); break;
    case 'st-rot': drehen(+b.dataset.d); break;
    case 'st-weg': if (BK.sel != null) abloesen(BK.sel); break;
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
  if (PK) {                                                    // Päckchen: Leertaste/Enter = aufreissen bzw. nächsten umdrehen
    if (e.key === 'Escape') closePack();
    else if (e.key === ' ' || e.key === 'Enter') { if (!PK.torn) tearPack(); else { const i = PK.got.findIndex((g, k) => !PK.shown.has(k)); if (i >= 0) flipCard(i); } }
    e.preventDefault();
    return;
  }
  if (e.key === 'Escape' && sheetOpen) { closeSheet(); if (view.name === 'home') render(); e.preventDefault(); return; }
  if (sheetOpen) return;
  if (view.name === 'buch') {
    if (e.key === 'ArrowRight') { blaettern(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { blaettern(-1); e.preventDefault(); }
    else if (e.key === 'Escape') waehle(null);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && BK.sel != null) { abloesen(BK.sel); e.preventDefault(); }
    return;
  }
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
    if (['task', 'result', 'memory', 'buch'].includes(view.name)) reloadPending = true; else location.reload();
  });
}
})();
