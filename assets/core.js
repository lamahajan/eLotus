// EduNest web apps: shared core (theme, data access, small UI kit). No build step: plain ES modules.
import * as F from './lib.js';  // firebase (+ colour utilities, no longer used for the theme)
import { ICONS } from './icons.js';

export const CFG = window.EDUNEST || {};
const qs = new URLSearchParams(location.search);
export const DEMO = qs.has('demo') || !(CFG.firebase && CFG.firebase.apiKey);
export const DOMAIN = 'p.edunest.app'; // must match cloud_parent.py DOMAIN
export const KEEP_DAYS = 60;            // must match cloud_parent.py KEEP_DAYS
/// part of a marks sheet id (must match cloud_marks.part and erp-parent-app.js): <secId>~<session>~<term>~<code>~<subjectKey>
export const idPart = (x) => String(x ?? '').replace(/[^A-Za-z0-9_-]/g, '-') || '-';
export const sheetPath = (sec, session, term, code, subj) => `marks/${sec}~${idPart(session)}~${idPart(term)}~${idPart(code)}~${subj}`;
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

// ------------------------------------------------------------------ theme (Cupertino glass, dark by default, light on request)
// The colour roles keep their Material names (--surface, --primary ...) so every screen follows the same palette.
const PAL = {
  dark: {
    surface: '#000000', onSurface: '#ffffff', onSurfaceVariant: 'rgba(235,235,245,0.66)', surfaceContainerLowest: '#0b0c10',
    surfaceContainerLow: 'rgba(28,30,40,0.72)', surfaceContainer: 'rgba(34,36,48,0.78)', surfaceContainerHigh: '#22242f', surfaceContainerHighest: '#2c2e3a',
    primary: '#0A84FF', onPrimary: '#ffffff', primaryContainer: 'rgba(10,132,255,0.18)', onPrimaryContainer: '#64D2FF',
    secondary: '#5E5CE6', onSecondary: '#ffffff', secondaryContainer: 'rgba(94,92,230,0.2)', onSecondaryContainer: '#c9c8ff',
    tertiary: '#BF5AF2', onTertiary: '#ffffff', tertiaryContainer: 'rgba(191,90,242,0.18)', onTertiaryContainer: '#e3b5fb',
    error: '#FF453A', onError: '#ffffff', errorContainer: 'rgba(255,69,58,0.16)', onErrorContainer: '#ff8a82',
    outline: 'rgba(255,255,255,0.18)', outlineVariant: 'rgba(255,255,255,0.08)', inverseSurface: '#f2f2f7', inverseOnSurface: '#1c1c1e', inversePrimary: '#0040dd',
    ok: '#30D158', okContainer: 'rgba(48,209,88,0.16)', onOkContainer: '#5ee27f', warn: '#FF9F0A', warnContainer: 'rgba(255,159,10,0.16)', onWarnContainer: '#ffb946',
    glass: 'rgba(22,24,34,0.78)', card: 'rgba(26,28,38,0.72)', cardSolid: '#161822', cardSubtle: 'rgba(255,255,255,0.05)', spec: 'rgba(255,255,255,0.16)',
    shadow: '0 8px 24px -4px rgba(0,0,0,0.45)', orb: '0.35', bar: '#000000',
  },
  light: {
    surface: '#F2F2F7', onSurface: '#1C1C1E', onSurfaceVariant: 'rgba(60,60,67,0.72)', surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: 'rgba(255,255,255,0.86)', surfaceContainer: 'rgba(255,255,255,0.9)', surfaceContainerHigh: '#ffffff', surfaceContainerHighest: '#e9e9ef',
    primary: '#007AFF', onPrimary: '#ffffff', primaryContainer: 'rgba(0,122,255,0.12)', onPrimaryContainer: '#0058c4',
    secondary: '#5856D6', onSecondary: '#ffffff', secondaryContainer: 'rgba(88,86,214,0.13)', onSecondaryContainer: '#3d3bb0',
    tertiary: '#AF52DE', onTertiary: '#ffffff', tertiaryContainer: 'rgba(175,82,222,0.13)', onTertiaryContainer: '#8a2fba',
    error: '#FF3B30', onError: '#ffffff', errorContainer: 'rgba(255,59,48,0.12)', onErrorContainer: '#c4251c',
    outline: 'rgba(0,0,0,0.14)', outlineVariant: 'rgba(0,0,0,0.07)', inverseSurface: '#1c1c1e', inverseOnSurface: '#f2f2f7', inversePrimary: '#64D2FF',
    ok: '#1f9e45', okContainer: 'rgba(52,199,89,0.14)', onOkContainer: '#1a7f37', warn: '#c76e00', warnContainer: 'rgba(255,149,0,0.14)', onWarnContainer: '#a35a00',
    glass: 'rgba(255,255,255,0.84)', card: 'rgba(255,255,255,0.86)', cardSolid: '#ffffff', cardSubtle: 'rgba(0,0,0,0.035)', spec: 'rgba(0,0,0,0.1)',
    shadow: '0 10px 30px -6px rgba(0,0,0,0.1)', orb: '0.16', bar: '#F2F2F7',
  },
};
const kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
export const theme = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

/// Premium colour scheme made from ONE brand colour (config.js: themeColor = Teacher plum, parentThemeColor = Parent blue).
/// Every role stays in the brand's own hue family (tinted surfaces, matching secondary, a close-neighbour accent), so a blue app is
/// really blue everywhere and a plum app is really plum everywhere. Status colours (green / amber / red) stay fixed.
export function scheme(hex) {
  const brand = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#59164C';
  let v = { ...PAL.light };
  try {
    const seed = F.argbFromHex(brand), hct = F.Hct.fromInt(seed), hue = hct.hue;
    const tp = (h2, c) => F.TonalPalette.fromHueAndChroma(((h2 % 360) + 360) % 360, c);
    const t = (p, n) => F.hexFromArgb(p.tone(n));
    const P = tp(hue, Math.max(hct.chroma, 48));                              // brand
    const S = tp(hue, 20);                                                      // quiet partner of the same hue
    const T = tp(hue + (hue > 200 && hue < 300 ? -32 : 30), 38);                // close-neighbour accent (cyan next to blue, rose next to plum)
    const N = tp(hue, 4), NV = tp(hue, 9), E = tp(25, 84);
    const G = tp(145, 46), W = tp(62, 56);
    const bt = Math.round(hct.tone);                                            // tone of the brand colour itself
    v = { ...PAL.light,
      primary: brand, onPrimary: '#ffffff', primaryContainer: t(P, 92), onPrimaryContainer: t(P, bt < 30 ? 20 : 15),
      secondary: t(S, 38), onSecondary: '#ffffff', secondaryContainer: t(S, 92), onSecondaryContainer: t(S, 18),
      tertiary: t(T, 38), onTertiary: '#ffffff', tertiaryContainer: t(T, 92), onTertiaryContainer: t(T, 18),
      error: t(E, 42), onError: '#ffffff', errorContainer: t(E, 93), onErrorContainer: t(E, 22),
      surface: t(N, 98), onSurface: t(N, 10), onSurfaceVariant: t(NV, 36),
      surfaceContainerLowest: '#ffffff', surfaceContainerLow: t(N, 96), surfaceContainer: t(N, 95), surfaceContainerHigh: t(N, 93), surfaceContainerHighest: t(N, 91),
      outline: t(NV, 60), outlineVariant: t(NV, 86), inverseSurface: t(N, 20), inverseOnSurface: t(N, 95), inversePrimary: t(P, 80),
      ok: t(G, 38), okContainer: t(G, 92), onOkContainer: t(G, 18), warn: t(W, 42), warnContainer: t(W, 93), onWarnContainer: t(W, 22),
      glass: t(N, 98), card: '#ffffff', cardSolid: '#ffffff', cardSubtle: t(N, 93), spec: t(NV, 86), bar: t(N, 98),
      primaryDeep: t(P, Math.max(10, bt - 9)), primaryBright: t(P, Math.min(58, bt + 14)),
      primary30: t(P, Math.max(10, bt - 9)), primary50: t(P, Math.min(58, bt + 14)),
      secondary30: t(S, 30), tertiary30: t(T, 28), tertiaryBright: t(T, 46), tertiaryDeep: t(T, 28), warnDeep: t(W, 34), warnBright: t(W, 52),
      okDeep: t(G, 30), okBright: t(G, 44) };
  } catch (e) { /* colour library missing: the fixed light palette is used */ }
  v.brand = brand;
  return v;
}
export function applyTheme(hex) {
  const v = scheme(hex);
  PAL.m3 = v;
  const css = `:root{${Object.entries(v).map(([r, x]) => `--${kebab(r)}:${x}`).join(';')};color-scheme:light}`;
  let st = document.getElementById('m3-theme');
  if (!st) { st = document.createElement('style'); st.id = 'm3-theme'; document.head.append(st); }
  st.textContent = css;
  setTheme('light', false);                      // light only (school's choice)
}
export function setTheme(t, save = true) {
  document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark';
  if (save) Prefs.set('theme', t);
  let m = document.querySelector('meta[name=theme-color]');
  if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.append(m); }
  m.content = (PAL.m3 || PAL.light).bar;
  document.querySelectorAll('.theme-btn').forEach((b) => b.replaceChildren(icon(theme() === 'dark' ? 'light_mode' : 'dark_mode')));
}
/// Sun / moon button for the top bar.
export function themeBtn() { return null; }     // no dark mode any more: nothing to switch

/// The school's UPI link (part_qr short_url) with the amount the app shows put into am= (added when the link has none).
export function upiLink(base, amount) {
  let u = String(base || '').trim();
  if (!/^upi:\/\/pay\?/i.test(u)) return '';
  const amt = (Math.round((Number(amount) || 0) * 100) / 100).toFixed(2);
  if (/([?&])am=[^&]*/i.test(u)) u = u.replace(/([?&])am=[^&]*/i, `$1am=${amt}`);
  else u += `&am=${amt}`;
  if (!/[?&]cu=/i.test(u)) u += '&cu=INR';
  return u;
}
export const upiParam = (u, k) => { try { return new URLSearchParams(String(u).split('?')[1] || '').get(k) || ''; } catch { return ''; } };
export const isPhone = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export function greeting() {
  const hr = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()));
  return hr < 12 ? 'Good Morning' : hr < 17 ? 'Good Afternoon' : 'Good Evening';
}
export const todayLong = () => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }).format(new Date());
/// 13:45 -> 01:45 PM
export function time12(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m) return String(t || '');
  const hh = +m[1];
  return `${String(hh % 12 || 12).padStart(2, '0')}:${m[2]} ${hh < 12 ? 'AM' : 'PM'}`;
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
    /// exam marks: only the changed cells of one sheet (null = clear that mark); upd is the server's clock (EduNest picks changes up by it)
    /// ulClear: students whose school unlock was used by this save: their `ul` flag is removed, which locks the cell again
    saveCells: (path, head, cells, by, ulClear) => wrap(F.setDoc(F.doc(db, path), {
      ...head, by: String(by || ''), src: 't', upd: F.serverTimestamp(),
      m: Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, v === null ? F.deleteField() : v])),
      ...(ulClear && ulClear.length ? { ul: Object.fromEntries(ulClear.map((k) => [k, F.deleteField()])) } : {}),
    }, { merge: true })),
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
    Prefs.set(key, now);   // also for a document that does not exist (yet): re-asking for it would cost a read every time. Pull to refresh asks again.
    return s;
  } catch (e) {
    try { return await a.getCache(path); } catch { throw e; }
  }
}

export function loginErrorText(code, who) {
  const office = who === 'p' ? 'school office' : 'office';
  switch (code) {
    case 'wrong-password': case 'invalid-credential': case 'invalid-login-credentials': case 'user-not-found':
      return who === 'p' ? 'That password isn’t correct. Your password is the mobile number registered with the school. If it still doesn’t work, please contact the school office.' : 'That password isn’t correct. Please try again, or contact the office.';
    case 'user-disabled': return `This account has been blocked. Please contact the ${office}.`;
    case 'too-many-requests': return 'Too many attempts. Please wait a few minutes and try again.';
    case 'network-request-failed': case 'unavailable': return 'No internet connection. Please check your network and try again.';
    case 'invalid-api-key': case 'api-key-not-valid.-please-pass-a-valid-api-key.': return 'The app isn’t set up correctly (config.js). Please contact the school.';
    default: return `We couldn’t sign you in (${code}). Please try again.`;
  }
}

export function errorText(e) {
  const s = String((e && (e.code || e.message)) || e);
  if (s.includes('permission-denied')) return 'You don’t have access to this. Please sign out and sign in again.';
  if (s.includes('unavailable') || s.includes('network') || s.includes('offline')) return 'No internet connection. Pull down to refresh once you’re back online.';
  return 'Something went wrong (' + s + '). Please try again.';
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
  return { role: String(c.r || ''), children: list('a'), sections: list('s'), principal: String(c.pr || '') === '1', mustChange: String(c.np || '') === '1' };
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
export function field({ label, type = 'text', value = '', helper, lead, inputmode, autocomplete, multiline, rows = 4, maxlength, onenter, name, autocapitalize, pattern }) {
  const input = multiline
    ? h('textarea', { rows, placeholder: ' ', maxlength, autocapitalize: autocapitalize || 'sentences' })
    : h('input', { type, placeholder: ' ', inputmode, autocomplete, name, spellcheck: 'false', autocapitalize: autocapitalize || 'off', maxlength, pattern });
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
    handle.addEventListener('pointercancel', () => { panel.style.transition = ''; panel.style.transform = ''; y0 = null; });
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
  let x0 = null, y0 = null, dy = 0, busy = false, isHorizontal = false;
  const MAX = 130, TRIG = 80;
  scroller.addEventListener('touchstart', (e) => {
    if (scroller.scrollTop <= 0 && !busy && e.touches.length === 1) {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      dy = 0;
      isHorizontal = false;
    }
  }, { passive: true });
  scroller.addEventListener('touchmove', (e) => {
    if (y0 == null || busy || isHorizontal) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - x0);
    dy = touch.clientY - y0;
    if (dx > Math.abs(dy) && dx > 8) {
      isHorizontal = true;
      ind.style.transform = '';
      ind.classList.remove('pulling');
      return;
    }
    if (dy <= 0 || scroller.scrollTop > 0) { ind.style.transform = ''; ind.classList.remove('pulling'); return; }
    const d = Math.min(MAX, dy * 0.55);
    ind.classList.add('pulling');
    ind.style.transform = `translateY(${d}px)`;
    ind.firstChild.style.transform = `rotate(${d * 3}deg)`;
    ind.firstChild.style.opacity = Math.min(1, d / TRIG);
  }, { passive: true });
  const end = async () => {
    if (y0 == null) return;
    const wasHorizontal = isHorizontal;
    x0 = null; y0 = null; isHorizontal = false;
    if (wasHorizontal) return;
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
  const cancel = () => {
    if (busy) return;
    x0 = null; y0 = null; isHorizontal = false;
    ind.classList.remove('pulling');
    ind.style.transform = '';
  };
  scroller.addEventListener('touchend', end);
  scroller.addEventListener('touchcancel', cancel);
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
        h('div', { class: 'install-tx' }, h('b', null, 'Install Lotus EduNest'), h('span', null, 'Add it to your home screen. Opens instantly, no Play Store needed')),
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
  const chip = h('div', { class: 'offline-chip', hidden: navigator.onLine }, icon('wifi_off'), 'You’re offline. Showing saved data');
  addEventListener('online', () => { chip.hidden = true; });
  addEventListener('offline', () => { chip.hidden = false; });
  return chip;
}
