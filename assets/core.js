// EduNest web apps: shared core (theme, data access, small UI kit). No build step: plain ES modules.
import * as F from './lib.js';
import { ICONS } from './icons.js';

export const CFG = window.EDUNEST || {};
const qs = new URLSearchParams(location.search);
export const DEMO = qs.has('demo') || !(CFG.firebase && CFG.firebase.apiKey);
export const DOMAIN = 'p.edunest.app'; // must match cloud_parent.py DOMAIN
export const KEEP_DAYS = 60;            // must match cloud_parent.py KEEP_DAYS
const SITE = new URL('../', import.meta.url);
export const siteUrl = (p) => (p ? new URL(p, SITE).href : '');

// ------------------------------------------------------------------ DOM helpers
export function h(tag, props, ...kids) {
  const el = tag === 'svg' || tag === 'path' || tag === 'circle'
    ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string' && !(el instanceof SVGElement)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  add(el, kids);
  return el;
}
function add(el, kids) {
  for (const c of kids) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) add(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function icon(name, cls = '') {
  const d = ICONS[name] || ICONS[name.replace('-fill', '')] || '';
  return h('svg', { class: 'ic ' + cls, viewBox: '0 -960 960 960', 'aria-hidden': 'true' }, h('path', { d }));
}
export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };

// ------------------------------------------------------------------ theme (Material 3 dynamic color from one seed)
const ROLES = ['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'secondary', 'onSecondary', 'secondaryContainer',
  'onSecondaryContainer', 'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer', 'error', 'onError', 'errorContainer',
  'onErrorContainer', 'surface', 'onSurface', 'onSurfaceVariant', 'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer',
  'surfaceContainerHigh', 'surfaceContainerHighest', 'outline', 'outlineVariant', 'inverseSurface', 'inverseOnSurface', 'inversePrimary'];
const kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
let themeSurface = { light: '#fff8f9', dark: '#181215' };

export function applyTheme(hex) {
  let seed;
  try { seed = F.argbFromHex(hex || '#59164C'); } catch { seed = F.argbFromHex('#59164C'); }
  const css = [];
  for (const dark of [false, true]) {
    const s = new F.SchemeTonalSpot(F.Hct.fromInt(seed), dark, 0);
    const v = ROLES.map((r) => `--${kebab(r)}:${F.hexFromArgb(F.MaterialDynamicColors[r].getArgb(s))}`);
    // status colours (present / leave), harmonised with the school colour
    const pal = (c) => F.TonalPalette.fromInt(F.Blend.harmonize(F.argbFromHex(c), seed));
    const g = pal('#1e8e3e'), w = pal('#e37400');
    const t = (p, l, d) => F.hexFromArgb(p.tone(dark ? d : l));
    v.push(`--ok:${t(g, 40, 80)}`, `--ok-container:${t(g, 90, 30)}`, `--on-ok-container:${t(g, 10, 90)}`,
      `--warn:${t(w, 50, 80)}`, `--warn-container:${t(w, 90, 30)}`, `--on-warn-container:${t(w, 10, 90)}`);
    const surf = F.hexFromArgb(F.MaterialDynamicColors.surface.getArgb(s));
    themeSurface[dark ? 'dark' : 'light'] = surf;
    css.push(dark ? `@media (prefers-color-scheme: dark){:root{${v.join(';')}}}` : `:root{${v.join(';')}}`);
  }
  let st = document.getElementById('m3-theme');
  if (!st) { st = h('style', { id: 'm3-theme' }); document.head.append(st); }
  st.textContent = css.join('\n');
  syncThemeColor();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', syncThemeColor);
}
function syncThemeColor() {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  let m = document.querySelector('meta[name=theme-color]');
  if (!m) { m = h('meta', { name: 'theme-color' }); document.head.append(m); }
  m.content = themeSurface[dark ? 'dark' : 'light'];
}

// ------------------------------------------------------------------ small key-value store on the phone
const P = 'edunest:';
export const Prefs = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(P + k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch { /* storage full / private mode */ } },
  remove: (k) => { try { localStorage.removeItem(P + k); } catch { /* ignore */ } },
};

// ------------------------------------------------------------------ dates (India time, whatever the phone's zone is)
export const istNow = () => new Date(Date.now() + 330 * 60000);           // read with getUTC*
export const ymd = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
export function istDay(daysAgo) {
  const n = istNow();
  return ymd(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() - daysAgo)));
}
export function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}
const fmt = (o) => new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', ...o });
const fNice = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fShort = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
const fDayMon = fmt({ day: 'numeric', month: 'short' });
const fWeek = fmt({ weekday: 'short' });
export const niceDate = (s) => { const d = parseYmd(s); return d ? fNice.format(d) : s; };
export const shortDate = (s) => { const d = parseYmd(s); return d ? fShort.format(d) : s; };
export const dayMon = (s) => { const d = parseYmd(s); return d ? fDayMon.format(d) : s; };
export const weekDay = (s) => { const d = parseYmd(s); return d ? fWeek.format(d) : ''; };
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
export const rupees = (v) => '₹ ' + inr.format(Number(v) || 0);
export function dateTimeText(ms) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(new Date(ms));
}

// ------------------------------------------------------------------ data access: Firebase, or the built-in demo
export class AppError extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }
const snap = (s) => ({ exists: s.exists(), data: s.exists() ? s.data() : null, fromCache: s.metadata.fromCache });

function firebaseApi() {
  const app = F.initializeApp(CFG.firebase);
  const auth = F.initializeAuth(app, { persistence: [F.indexedDBLocalPersistence, F.browserLocalPersistence] });
  let db;
  try {
    db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch {
    db = F.initializeFirestore(app, { localCache: F.memoryLocalCache() });
  }
  const wrap = async (p) => {
    try { return await p; } catch (e) { throw new AppError(String(e.code || 'unknown').replace(/^(auth|firestore)\//, ''), e.message); }
  };
  return {
    onAuth: (cb) => F.onAuthStateChanged(auth, cb),
    user: () => auth.currentUser,
    signIn: (email, pw) => wrap(F.signInWithEmailAndPassword(auth, email, pw)),
    signOut: () => F.signOut(auth),
    claims: async (refresh) => auth.currentUser ? (await F.getIdTokenResult(auth.currentUser, !!refresh)).claims : {},
    changePassword: async (pw, current) => {
      const u = auth.currentUser;
      if (current) await wrap(F.reauthenticateWithCredential(u, F.EmailAuthProvider.credential(u.email, current)));
      await wrap(F.updatePassword(u, pw));
    },
    getCache: (path) => wrap(F.getDocFromCache(F.doc(db, path)).then(snap)),
    getServer: (path) => wrap(F.getDocFromServer(F.doc(db, path)).then(snap)),
    setMerge: (path, data) => wrap(F.setDoc(F.doc(db, path), data, { merge: true })),
    removeField: (path, field, extra) => wrap(F.updateDoc(F.doc(db, path), { [field]: F.deleteField(), ...extra })),
  };
}

let _api;
export async function api() {
  if (_api) return _api;
  _api = DEMO ? (await import('./demo.js')).demoApi() : firebaseApi();
  return _api;
}

/// Phone's copy first (free). Only when the phone never saw this document is the server asked (1 read).
export async function getCacheFirst(path) {
  const a = await api();
  try { return await a.getCache(path); } catch { return a.getServer(path); }
}

/// Server copy, but at most once per maxAge (the rest of the time the phone's copy is used). force = pull to refresh.
export async function getFresh(path, maxAgeMs, force = false) {
  const a = await api();
  const key = 'fetched:' + path, now = Date.now(), last = Prefs.get(key);
  if (!force && last && now - last < maxAgeMs) {
    try { return await a.getCache(path); } catch { /* storage cleared: ask the server */ }
  }
  try {
    const s = await a.getServer(path);
    Prefs.set(key, now);
    return s;
  } catch (e) {
    try { return await a.getCache(path); } catch { throw e; }
  }
}

export function loginErrorText(code, who) {
  const first = who === 'p' ? 'Mobile No 1 (10 digits)' : 'your mobile number (10 digits)';
  const office = who === 'p' ? 'school office' : 'office';
  switch (code) {
    case 'wrong-password': case 'invalid-credential': case 'invalid-login-credentials': case 'user-not-found':
      return `Wrong password. First time? Use ${first}. Forgot it? Ask the ${office} to reset it.`;
    case 'user-disabled': return `This login is blocked. Please contact the ${office}.`;
    case 'too-many-requests': return 'Too many wrong attempts. Please try again after some time.';
    case 'network-request-failed': case 'unavailable': return 'No internet connection. Please try again.';
    case 'invalid-api-key': case 'api-key-not-valid.-please-pass-a-valid-api-key.': return 'App settings (config.js) are wrong. Please contact the school.';
    default: return `Could not log in (${code}).`;
  }
}

export function errorText(e) {
  const s = String((e && (e.code || e.message)) || e);
  if (s.includes('permission-denied')) return 'You do not have permission to see this. Please log out and log in again.';
  if (s.includes('unavailable') || s.includes('network') || s.includes('offline')) return 'No internet connection. Pull down to try again.';
  return 'Something went wrong: ' + s;
}

/// Login helpers shared by both apps.
export async function claims(refresh) {
  const a = await api(), uid = a.user()?.uid;
  let c;
  try {
    c = (await a.claims(refresh)) || {};
    if (uid && c.r) Prefs.set('claims:' + uid, c);
  } catch (e) {
    c = uid && Prefs.get('claims:' + uid);   // offline with an old token: use the last known list
    if (!c) throw e;
  }
  const list = (k) => Array.isArray(c[k]) ? c[k].map(String) : [];
  return { role: String(c.r || ''), children: list('a'), sections: list('s'), mustChange: String(c.np || '') === '1' };
}
export async function needsNewPassword() {
  const u = (await api()).user();
  if (!u) return false;
  if (Prefs.get('pwdone:' + u.uid)) return false;
  return (await claims()).mustChange;
}
export async function changePassword(pw, current) {
  const a = await api(), u = a.user();
  if (!u) throw new AppError('x', 'Please log in again');
  if (pw.length < 6) throw new AppError('x', 'Password must be at least 6 characters');
  try {
    await a.changePassword(pw, current || null);
    Prefs.set('pwdone:' + u.uid, true);
  } catch (e) {
    if (e.code === 'requires-recent-login') throw new AppError('RECENT_LOGIN');
    if (e.code === 'weak-password') throw new AppError('x', 'Password is too weak, choose a longer one');
    if (e.code === 'wrong-password' || e.code === 'invalid-credential') throw new AppError('x', 'Current password is wrong');
    if (e.code === 'x') throw e;
    throw new AppError('x', `Password not changed (${e.code})`);
  }
}

// ------------------------------------------------------------------ back button / layers (screens, sheets, dialogs)
const layers = [];
export function pushLayer(close) { layers.push(close); history.pushState({ layer: layers.length }, ''); }
export function popLayer() { if (layers.length) history.back(); }
addEventListener('popstate', () => { const c = layers.pop(); if (c) c(); });
export function dropAllLayers() { const n = layers.length; while (layers.length) layers.pop()(); if (n) history.go(-n); }

// ------------------------------------------------------------------ UI kit
export function spinner(size = 48) {
  return h('div', { class: 'spinner', style: { width: size + 'px', height: size + 'px' }, role: 'progressbar', 'aria-label': 'Loading' },
    h('svg', { viewBox: '0 0 48 48' }, h('circle', { cx: 24, cy: 24, r: 20 })));
}

export function ripple(el) {
  el.addEventListener('pointerdown', (e) => {
    const r = el.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.2;
    const s = h('span', { class: 'ripple', style: { width: size + 'px', height: size + 'px', left: e.clientX - r.left - size / 2 + 'px', top: e.clientY - r.top - size / 2 + 'px' } });
    el.append(s);
    const end = () => { s.classList.add('out'); setTimeout(() => s.remove(), 450); };
    el.addEventListener('pointerup', end, { once: true });
    el.addEventListener('pointerleave', end, { once: true });
    el.addEventListener('pointercancel', end, { once: true });
  });
  return el;
}

export function btn(kind, label, onclick, opts = {}) {
  const b = h('button', { type: opts.type || 'button', class: `btn btn-${kind} ${opts.class || ''}`, onclick, disabled: opts.disabled, 'aria-label': opts.aria },
    opts.icon ? icon(opts.icon) : null, label ? h('span', { class: 'btn-label' }, label) : null);
  return ripple(b);
}
export function iconBtn(name, onclick, aria, cls = '') {
  return ripple(h('button', { type: 'button', class: 'icon-btn ' + cls, onclick, 'aria-label': aria, title: aria }, icon(name)));
}
export function setBusy(b, busy) {
  b.disabled = busy;
  b.classList.toggle('busy', busy);
  if (busy && !b.querySelector('.spinner')) b.append(spinner(22));
  if (!busy) b.querySelector('.spinner')?.remove();
}

/// Material outlined text field with floating label.
export function field({ label, type = 'text', value = '', helper, lead, inputmode, autocomplete, multiline, rows = 4, maxlength, onenter, name, autocapitalize }) {
  const input = multiline
    ? h('textarea', { rows, placeholder: ' ', maxlength, autocapitalize: autocapitalize || 'sentences' })
    : h('input', { type, placeholder: ' ', inputmode, autocomplete, name, spellcheck: 'false', autocapitalize: autocapitalize || 'off', maxlength });
  input.value = value;
  const id = 'f' + Math.random().toString(36).slice(2, 8);
  input.id = id;
  const wrap = h('div', { class: 'tf' + (lead ? ' has-lead' : '') + (multiline ? ' multi' : '') },
    lead ? icon(lead, 'tf-lead') : null, input, h('label', { for: id }, label));
  if (type === 'password') {
    const t = iconBtn('visibility', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      t.replaceChildren(icon(show ? 'visibility_off' : 'visibility'));
      t.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    }, 'Show password', 'tf-trail');
    wrap.append(t);
    wrap.classList.add('has-trail');
  }
  if (onenter) input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !multiline) { e.preventDefault(); onenter(); } });
  const help = helper ? h('div', { class: 'tf-help' }, helper) : null;
  const counter = maxlength && multiline ? h('div', { class: 'tf-count' }, `${input.value.length}/${maxlength}`) : null;
  if (counter) input.addEventListener('input', () => { counter.textContent = `${input.value.length}/${maxlength}`; });
  const root = h('div', { class: 'tf-root' }, wrap, (help || counter) ? h('div', { class: 'tf-foot' }, help || h('span'), counter) : null);
  root.input = input;
  return root;
}

export function snackbar(text) {
  document.querySelector('.snackbar')?.remove();
  const s = h('div', { class: 'snackbar', role: 'status' }, text);
  document.body.append(s);
  requestAnimationFrame(() => s.classList.add('show'));
  setTimeout(() => { s.classList.remove('show'); setTimeout(() => s.remove(), 300); }, 3200);
}

/// Basic M3 dialog. actions: [{label, value, kind}] -> resolves with value (undefined on back / scrim).
export function dialog({ icon: ic, title, text, actions }) {
  return new Promise((resolve) => {
    let result;
    const scrim = h('div', { class: 'scrim', onclick: () => popLayer() });
    const box = h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true' },
      ic ? h('div', { class: 'dialog-icon' }, icon(ic)) : null,
      h('h2', { class: ic ? 'center' : '' }, title),
      text ? h('p', null, text) : null,
      h('div', { class: 'dialog-actions' }, actions.map((a) => btn(a.kind || 'text', a.label, () => { result = a.value; popLayer(); }))));
    const layer = h('div', { class: 'layer dialog-layer' }, scrim, box);
    document.body.append(layer);
    requestAnimationFrame(() => layer.classList.add('open'));
    pushLayer(() => { layer.classList.remove('open'); setTimeout(() => layer.remove(), 220); resolve(result); });
  });
}

/// Modal bottom sheet. build(done) returns the content; call done(value) to close with a value.
export function sheet(build) {
  return new Promise((resolve) => {
    let result;
    const done = (v) => { result = v; popLayer(); };
    const scrim = h('div', { class: 'scrim', onclick: () => popLayer() });
    const panel = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' }, h('div', { class: 'sheet-handle' }), build(done));
    const layer = h('div', { class: 'layer sheet-layer' }, scrim, panel);
    document.body.append(layer);
    requestAnimationFrame(() => layer.classList.add('open'));
    // drag the handle down to close
    let y0 = null, dy = 0;
    const handle = panel.querySelector('.sheet-handle');
    handle.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; handle.setPointerCapture(e.pointerId); panel.style.transition = 'none'; });
    handle.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); panel.style.transform = `translateY(${dy}px)`; });
    handle.addEventListener('pointerup', () => { panel.style.transition = ''; panel.style.transform = ''; if (dy > 90) popLayer(); y0 = null; });
    pushLayer(() => { layer.classList.remove('open'); setTimeout(() => layer.remove(), 280); resolve(result); });
  });
}

/// Full-screen page pushed over the current one (Android back closes it).
export function pushPage(title, content, { actions } = {}) {
  const main = h('main', { class: 'content' }, content);
  const bar = topBar({ title, back: () => popLayer(), actions });
  const page = h('div', { class: 'page pushed' }, bar, main);
  watchScroll(main, bar);
  document.getElementById('app').append(page);
  requestAnimationFrame(() => page.classList.add('in'));
  pushLayer(() => { page.classList.remove('in'); setTimeout(() => page.remove(), 260); });
  return main;
}

export function topBar({ title, back, actions, sub }) {
  return h('header', { class: 'topbar' },
    back ? iconBtn('arrow_back', back, 'Back') : null,
    h('div', { class: 'topbar-title' }, title, sub ? h('small', null, sub) : null),
    h('div', { class: 'topbar-actions' }, actions || []));
}
export function watchScroll(main, bar) {
  main.addEventListener('scroll', () => bar.classList.toggle('scrolled', main.scrollTop > 4), { passive: true });
}

/// Pull down at the top of a scroll area to refresh (Material swipe-refresh indicator).
export function pullToRefresh(scroller, onRefresh) {
  const ind = h('div', { class: 'ptr' }, h('div', { class: 'ptr-disc' }, icon('refresh')));
  scroller.parentElement.append(ind);
  let y0 = null, dy = 0, busy = false;
  const MAX = 130, TRIG = 80;
  scroller.addEventListener('touchstart', (e) => { if (scroller.scrollTop <= 0 && !busy) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
  scroller.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0 || scroller.scrollTop > 0) { ind.style.transform = ''; ind.classList.remove('pulling'); return; }
    const d = Math.min(MAX, dy * 0.55);
    ind.classList.add('pulling');
    ind.style.transform = `translateY(${d}px)`;
    ind.firstChild.style.transform = `rotate(${d * 3}deg)`;
    ind.firstChild.style.opacity = Math.min(1, d / TRIG);
  }, { passive: true });
  const end = async () => {
    if (y0 == null) return;
    y0 = null;
    const d = Math.min(MAX, dy * 0.55);
    ind.classList.remove('pulling');
    if (d < TRIG) { ind.style.transform = ''; return; }
    busy = true;
    ind.classList.add('spin');
    ind.style.transform = `translateY(${TRIG - 8}px)`;
    try { await onRefresh(); } finally {
      busy = false;
      ind.classList.remove('spin');
      ind.style.transform = '';
    }
  };
  scroller.addEventListener('touchend', end);
  scroller.addEventListener('touchcancel', end);
}

export function messageBox(ic, text, onRetry) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty-icon' }, icon(ic)), h('p', null, text),
    onRetry ? btn('tonal', 'Try again', onRetry, { icon: 'refresh' }) : null);
}

export function skeleton(n = 3) {
  return h('div', { class: 'skel-wrap' }, Array.from({ length: n }, (_, i) => h('div', { class: 'skel', style: { animationDelay: i * 120 + 'ms', height: (i === 0 ? 148 : 92) + 'px' } })));
}

export function avatarLetter(name, cls = '') {
  const parts = String(name || '?').trim().split(/\s+/);
  const t = (parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
  return h('div', { class: 'avatar ' + cls, 'aria-hidden': 'true' }, t.toUpperCase());
}

/// A stable soft colour per subject so the same subject always looks the same.
export function hueClass(key) {
  let x = 0;
  for (const c of String(key)) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return 'hue-' + (x % 6);
}

/// School logo (round) from config.js, or the fallback icon mark.
export function brandMark(fallbackIcon = 'school-fill', cls = 'login-mark') {
  if (CFG.logo) {
    const img = h('img', { class: 'brand-logo', src: siteUrl(CFG.logo), alt: CFG.schoolName || 'School logo', width: 112, height: 112, decoding: 'async' });
    img.addEventListener('error', () => img.replaceWith(h('div', { class: cls }, icon(fallbackIcon))));
    return img;
  }
  return h('div', { class: cls }, icon(fallbackIcon));
}
/// Small round logo for top bars (nothing when no logo is set).
export function brandDot() {
  return CFG.logo ? h('img', { class: 'brand-dot', src: siteUrl(CFG.logo), alt: '', width: 36, height: 36, decoding: 'async' }) : null;
}
/// Logo with the school name (light + dark versions), or null.
export function brandWordmark() {
  if (!CFG.logoName) return null;
  return h('picture', { class: 'brand-word' },
    CFG.logoNameDark ? h('source', { srcset: siteUrl(CFG.logoNameDark), media: '(prefers-color-scheme: dark)' }) : null,
    h('img', { src: siteUrl(CFG.logoName), alt: CFG.schoolName || 'School', decoding: 'async' }));
}

export function demoBanner() {
  if (!DEMO) return null;
  return h('div', { class: 'demo-banner' }, icon('info'), h('span', null, 'Demo mode: sample data. Add your Firebase settings in config.js to see real data.'));
}

// ------------------------------------------------------------------ install (PWA) + offline
let deferred = null;
const installListeners = new Set();
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; installListeners.forEach((f) => f()); });
addEventListener('appinstalled', () => { deferred = null; installListeners.forEach((f) => f()); });
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/// "Install app" card for the login screen; hides itself when already installed.
export function installCard(appName) {
  const box = h('div', { class: 'install-card', hidden: true });
  const render = () => {
    clear(box);
    if (isStandalone()) { box.hidden = true; return; }
    if (deferred) {
      box.hidden = false;
      box.append(h('div', { class: 'install-ic' }, icon('download')),
        h('div', { class: 'install-tx' }, h('b', null, 'Install the app'), h('span', null, 'Icon on your home screen, no Play Store needed')),
        btn('tonal', 'Install', async () => { deferred.prompt(); await deferred.userChoice; deferred = null; render(); }));
    } else if (isIOS()) {
      box.hidden = false;
      box.append(h('div', { class: 'install-ic' }, icon('ios_share')),
        h('div', { class: 'install-tx' }, h('b', null, 'Install on iPhone'), h('span', null, `In Safari tap Share, then "Add to Home Screen"`)));
    } else box.hidden = true;
  };
  installListeners.add(render);
  render();
  return box;
}

export function registerSW() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: new URL('../', import.meta.url).pathname }).catch(() => {});
  }
}

export function offlineChip() {
  const chip = h('div', { class: 'offline-chip', hidden: navigator.onLine }, icon('wifi_off'), 'Offline: showing saved data');
  addEventListener('online', () => { chip.hidden = true; });
  addEventListener('offline', () => { chip.hidden = false; });
  return chip;
}
