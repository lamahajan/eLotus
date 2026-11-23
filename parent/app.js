// EduNest Parent App (web / PWA), 1.6: dashboard home, Pay Now (UPI), gate pass, notices. Read-saving rules:
//   student          server at most every 30 min (attendance / fees / gate pass change during the day; pull to refresh: now)
//   notices          server at most every 30 min (notices/board), 60 min (class notices tnotice/{secId}), 2 h (notices/principal); pull to refresh: now
//   today            server at most every 30 min
//   yesterday        server at most every 6 h
//   2..7 days ago    phone first, server only if the phone never saw that day
//   older (to 60)    only when "Older homework" is opened, 7 days at a time, phone first
import {
  CFG, DOMAIN, KEEP_DAYS, h, icon, clear, applyTheme, registerSW, api, getCacheFirst, getFresh, claims,
  loginErrorText, errorText, Prefs, istDay, parseYmd, niceDate, shortDate, dayMon, weekDay, rupees, dateTimeText, btn, iconBtn, setBusy, field,
  snackbar, dialog, sheet, pushPage, dropAllLayers, topBar, watchScroll, pullToRefresh, messageBox, skeleton, avatarLetter, hueClass,
  demoBanner, installCard, offlineChip, spinner, ripple, brandMark, siteUrl, themeBtn, upiLink, upiParam, isPhone, greeting, todayLong, time12,
} from '../assets/core.js';

const HOUR = 3600e3, MIN = 60e3;
applyTheme(CFG.parentThemeColor || '#0B57D0');   // Parent App = blue (the Teacher App uses the school colour, plum)
registerSW();
const root = document.getElementById('app');
document.body.append(offlineChip());

// ------------------------------------------------------------------ data
const Repo = {
  async appName() {
    try {
      const s = await getCacheFirst('meta/app');
      const d = s.data || {};
      return String(d.appName || d.school || '').trim() || CFG.schoolName || '';
    } catch { return CFG.schoolName || ''; }
  },
  async student(adm, force) {
    const s = await getFresh('students/' + adm, 30 * MIN, force);
    return s.data ? toStudent(adm, s.data) : null;
  },
  /// school notices (EduNest) + class notices (teachers) for these sections
  async notices(secIds, force) {
    const out = [];
    const withFreshToken = async (fn) => {
      try { return await fn(); } catch (e) {
        if (!String((e && (e.code || e.message)) || e).includes('permission-denied')) throw e;
        try { await claims(true); } catch { throw e; }
        return fn();
      }
    };
    try {
      const b = await withFreshToken(() => getFresh('notices/board', 5 * MIN, force));
      for (const n of (Array.isArray(b.data?.list) ? b.data.list : [])) {
        if (!n || (n.aud !== 'all' && n.aud !== 'p' && n.aud)) continue;
        const secs = Array.isArray(n.secs) ? n.secs.map(String) : [];
        out.push({ ...normNotice(n), secs, src: 'school' });
      }
    } catch { /* no board yet */ }
    try {
      const p = await withFreshToken(() => getFresh('notices/principal', 2 * HOUR, force));
      for (const n of (Array.isArray(p.data?.list) ? p.data.list : [])) if (n && (n.aud || 'all') !== 't') out.push({ ...normNotice(n), secs: [], src: 'school' });
    } catch { /* the principal has not posted from the app */ }
    await Promise.all([...new Set(secIds)].filter(Boolean).map(async (sec) => {
      try {
        const s = await withFreshToken(() => getFresh('tnotice/' + sec, 60 * MIN, force));
        for (const [uid, t] of Object.entries(s.data?.n && typeof s.data.n === 'object' ? s.data.n : {})) {
          for (const n of (Array.isArray(t?.list) ? t.list : [])) out.push({ ...normNotice(n), by: String(t.name || ''), uid, secs: [sec], src: 'class' });
        }
      } catch { /* nothing posted for this class */ }
    }));
    const today = istDay(0);
    const seen = new Set();
    return out.filter((n) => (n.t || n.b) && (!n.exp || n.exp >= today) && !seen.has(n.src + n.id + n.secs.join()) && seen.add(n.src + n.id + n.secs.join()))
      .sort((x, y) => (y.pin - x.pin) || String(y.date).localeCompare(String(x.date)) || (y.ts - x.ts));
  },
  async day(secId, daysAgo, force) {
    const date = istDay(daysAgo), path = `homework/${secId}_${date}`;
    try {
      const s = daysAgo === 0 ? await getFresh(path, 30 * MIN, force)
        : daysAgo === 1 ? await getFresh(path, 6 * HOUR, force)
          : await getCacheFirst(path);
      return toDay(date, s.data);
    } catch (e) {
      if (daysAgo <= 1) throw e;
      return toDay(date, null);
    }
  },
  async recent(secId, force) {
    return Promise.all(Array.from({ length: 8 }, (_, i) =>
      Repo.day(secId, i, force && i <= 1).catch((e) => { if (i === 0) throw e; return toDay(istDay(i), null); })));
  },
  async older(secId, from) {
    const ids = [];
    for (let i = from; i < from + 7 && i <= KEEP_DAYS; i++) ids.push(i);
    return Promise.all(ids.map((i) => Repo.day(secId, i)));
  },
};

const S = (d, k) => String(d?.[k] ?? '');
const I = (d, k) => { const v = Number(d?.[k]); return Number.isFinite(v) ? Math.trunc(v) : 0; };
const counts = (m) => { const p = I(m, 'P'), a = I(m, 'A'), l = I(m, 'L'), t = p + a + l; return { p, a, l, total: t, pct: t ? (p * 100) / t : 0 }; };
const normNotice = (n) => {
  const t = S(n, 't') || S(n, 'title') || (n?.secs && typeof n.secs === 'object' && !Array.isArray(n.secs) ? S(n.secs, 't') : '');
  const b = S(n, 'b') || S(n, 'body') || S(n, 'desc') || S(n, 'msg');
  return { id: S(n, 'id'), t, b, date: S(n, 'date'), exp: S(n, 'exp'), pin: n?.pin ? 1 : 0, by: S(n, 'by'), ts: I(n, 'ts') };
};
function toStudent(adm, d) {
  const fee = d.fee || {}, att = d.att || {}, pay = d.pay && typeof d.pay === 'object' ? d.pay : {};
  return {
    adm, name: S(d, 'name'), cls: S(d, 'cls'), sec: S(d, 'sec'), secId: S(d, 'secId'), roll: S(d, 'roll'), dob: S(d, 'dob'),
    father: S(d, 'father'), mother: S(d, 'mother'), gender: S(d, 'gender'), addr: S(d, 'addr'), session: S(d, 'session'),
    feeDue: I(fee, 'due'), feeMonths: I(fee, 'months'), feePaid: I(fee, 'paid'), feePeriod: S(fee, 'period'), feeAsOn: S(fee, 'asOn'),
    receipts: (Array.isArray(fee.rc) ? fee.rc : []).filter((r) => r && typeof r === 'object').map((r) => ({ no: S(r, 'no'), date: S(r, 'date'), amt: I(r, 'amt'), mode: S(r, 'mode') })),
    attS: counts(att.s), attM: counts(att.m), attMon: S(att, 'mon'),
    attDays: Object.fromEntries(Object.entries(att.d && typeof att.d === 'object' ? att.d : {}).map(([k, v]) => [k, String(v)])),
    gp: (Array.isArray(d.gp) ? d.gp : []).filter((g) => g && typeof g === 'object').map((g) => ({
      id: S(g, 'id'), date: S(g, 'date'), time: S(g, 'time'), by: S(g, 'by'), rel: S(g, 'rel'), reason: S(g, 'reason'), out: S(g, 'out'), outBy: S(g, 'outBy'), st: S(g, 'st') })),
    upi: /^upi:\/\//i.test(S(pay, 'upi')) ? S(pay, 'upi') : '', qr: /^https:\/\//.test(S(pay, 'qr')) ? S(pay, 'qr') : '',
    upd: I(d, 'upd'),
    get classText() { return this.sec ? `${this.cls} - ${this.sec}` : this.cls; },
  };
}
function toDay(date, d) {
  const items = [];
  const subs = d && typeof d.subjects === 'object' ? d.subjects : {};
  for (const [k, v] of Object.entries(subs || {})) {
    if (!v || typeof v !== 'object') continue;
    const text = String(v.text ?? '').trim();
    const att = Array.isArray(v.attachments) ? v.attachments.map(String).filter((x) => x.startsWith('http')) : [];
    if (!text && !att.length) continue;
    items.push({ key: k, subject: String(v.name ?? k), text, teacher: String(v.teacher ?? ''), att });
  }
  items.sort((a, b) => a.subject.toLowerCase().localeCompare(b.subject.toLowerCase()));
  return { date, items, empty: !items.length };
}
const todayPass = (s) => s.gp.find((g) => g.date === istDay(0)) || null;
const firstName = (n) => String(n || '').replace(/^(mr|mrs|ms|dr|shri|smt)\.?\s+/i, '').trim().split(/\s+/)[0] || '';
/// days in a row the child was present, counted back from the latest marked day
function streakOf(s) {
  let n = 0;
  for (const d of Object.keys(s.attDays).sort().reverse()) { if (s.attDays[d] === 'P') n++; else if (s.attDays[d] === 'A') break; }
  return n;
}

// ------------------------------------------------------------------ auth gate
let gate = 0, loginMsg = null;
const a = await api();
a.onAuth(async (u) => {
  const v = ++gate;
  dropAllLayers();
  if (!u) return showLogin();
  showLoading();
  try {
    const c = await claims(false);
    if (v !== gate) return;
    if (c.role !== 'p') { loginMsg = 'This account isn’t a parent account. Teachers, please use the Teacher Portal.'; await logout(true); return; }
    showHome();   // the password is always the mobile number (school rule): no new-password screen
  } catch (e) {
    if (v === gate) showHome();
  }
});

async function logout(silent) {
  if (!silent) {
    const ok = await dialog({ icon: 'logout', title: 'Sign out?', text: 'You’ll need your Admission number and password to sign in again.',
      actions: [{ label: 'Cancel', value: false }, { label: 'Sign out', value: true, kind: 'filled' }] });
    if (!ok) return;
  }
  Prefs.remove('child');
  await a.signOut();
}

function mount(el) { clear(root).append(el); }
function showLoading() { mount(h('div', { class: 'page' }, h('div', { class: 'center-fill' }, spinner()))); }

// ------------------------------------------------------------------ login
async function showLogin() {
  const title = h('h1', null, CFG.schoolName || 'Parent Login');
  const err = h('div', { class: 'login-err', role: 'alert', hidden: true });
  const showErr = (m) => { err.hidden = !m; clear(err).append(icon('error'), h('span', null, m || '')); };
  const fAdm = field({ label: 'Admission number', lead: 'badge', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'username', name: 'username', onenter: () => fPw.input.focus() });
  const fPw = field({ label: 'Password', helper: 'Your registered mobile number', type: 'password', lead: 'lock', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'current-password', name: 'password', onenter: () => go() });
  fAdm.input.value = Prefs.get('lastAdm') || '';
  const go = async () => {
    const adm = fAdm.input.value.trim(), pw = fPw.input.value;
    showErr(null);
    if (!adm || !pw) return showErr('Please enter your Admission number and password.');
    if (adm.includes('/')) return showErr('Please check the Admission number and try again.');
    setBusy(b, true);
    try {
      let idx;
      try { idx = await a.getServer('loginIndex/' + adm); } catch { throw new Error('No internet connection. Please check your network and try again.'); }
      const fam = idx.data?.f;
      if (!idx.exists || !fam) throw new Error('We couldn’t find this Admission number. Please check it, or contact the school office.');
      Prefs.set('lastAdm', adm);
      try { await a.signIn(`${fam}@${DOMAIN}`, pw); } catch (e) { throw new Error(loginErrorText(e.code, 'p')); }
    } catch (e) {
      showErr(e.message);
      setBusy(b, false);
    }
  };
  const b = btn('filled', 'Sign in', go, { class: 'btn-big btn-block' });
  if (loginMsg) { showErr(loginMsg); loginMsg = null; }
  const page = h('div', { class: 'page' }, h('div', { class: 'chooser-top' }, themeBtn()), h('div', { class: 'login' },
    h('div', { class: 'login-hero' }, brandMark('school-fill'), title, h('div', { class: 'login-kicker' }, 'Lotus EduNest · Parent Portal'),
      h('p', null, 'Welcome! Sign in to follow your child’s day at school.')),
    h('form', { class: 'login-form', onsubmit: (e) => { e.preventDefault(); go(); } }, err, fAdm, fPw, b),
    h('div', { class: 'login-tip' }, 'More than one child at school? Sign in with any one child’s Admission number and all your children will appear.'),
    demoBanner(), installCard('Lotus Parent')));
  mount(page);
  document.title = 'Lotus EduNest · Parent Portal';
  Repo.appName().then((n) => { if (n) { title.textContent = n; } });
}

// ------------------------------------------------------------------ header pieces
function schoolBadge() {
  const box = h('div', { class: 'school-badge' });
  if (CFG.logo) {
    const img = h('img', { src: siteUrl(CFG.logo), alt: '' });
    img.addEventListener('error', () => img.replaceWith((CFG.schoolName || 'S').trim()[0]));
    box.append(img);
  } else box.append((CFG.schoolName || 'S').trim()[0]);
  return box;
}
function schoolId(sub) {
  return h('div', { class: 'school-id' }, schoolBadge(), h('div', { class: 'school-txt' }, h('b', null, CFG.appName || 'Lotus EduNest'), h('span', null, sub || CFG.schoolName || 'Parent Portal')));
}

// ------------------------------------------------------------------ home: children + 5 tabs
const TABS = [
  { id: 'home', label: 'Home', icon: 'space_dashboard' },
  { id: 'fees', label: 'Fees', icon: 'credit_card' },
  { id: 'att', label: 'Attendance', icon: 'event_available' },
  { id: 'hw', label: 'Homework', icon: 'menu_book' },
];

function showHome() {
  Prefs.remove('tab');
  const st = { kids: new Map(), order: [], sel: null, tab: 'home', hw: new Map(), notices: null, err: null, loading: true, attView: 'session' };
  const main = h('main', { class: 'content' });
  const refBtn = iconBtn('refresh', async () => {
    refBtn.classList.add('spinning');
    snackbar('Refreshing…');
    try {
      await refresh();
      snackbar('Everything is up to date');
    } catch {
      snackbar('Couldn’t refresh. Please check your internet.');
    } finally {
      refBtn.classList.remove('spinning');
    }
  }, 'Refresh', 'glassy');
  const bar = topBar({ title: '', actions: [refBtn, themeBtn(), iconBtn('logout', () => logout(), 'Sign out', 'glassy')] });
  bar.querySelector('.topbar-actions').style.gap = '8px';
  const nav = h('nav', { class: 'navbar', role: 'tablist' });
  const page = h('div', { class: 'page has-nav' }, bar, main, nav);
  watchScroll(main, bar);
  pullToRefresh(main, () => refresh());
  mount(page);

  const kid = () => (st.sel ? st.kids.get(st.sel) : null);
  const go = (t) => { st.tab = t; render(true); };
  const kidIndex = (adm) => Math.max(0, st.order.indexOf(adm));

  async function load(force) {
    st.err = null;
    try {
      const c = await claims(force);
      const order = [];
      for (const adm of c.children) {
        const s = await Repo.student(adm, force);
        if (s) { st.kids.set(adm, s); order.push(adm); }
      }
      for (const k of [...st.kids.keys()]) if (!order.includes(k)) st.kids.delete(k);
      const saved = Prefs.get('child');
      st.order = order;
      st.sel = order.includes(st.sel) ? st.sel : order.includes(saved) ? saved : order[0] || null;
    } catch (e) { st.err = e; }
    st.loading = false;
    loadNotices(force);
  }
  async function loadNotices(force) {
    try {
      st.notices = await Repo.notices([...st.kids.values()].map((k) => k.secId), force);
      if ((!st.notices || !st.notices.length) && !force) {
        Repo.notices([...st.kids.values()].map((k) => k.secId), true).then((fresh) => {
          if (fresh && fresh.length) { st.notices = fresh; if (st.tab === 'home') render(false); }
        }).catch(() => {});
      }
    } catch { st.notices = st.notices || []; }
    if (st.tab === 'home') render(false);
  }
  async function refresh() {
    await load(true);
    const s = kid();
    if (s && (st.tab === 'hw' || st.tab === 'home')) await loadHw(s.secId, true);
    render(false);
  }
  async function loadHw(secId, force) {
    try { st.hw.set(secId, { days: await Repo.recent(secId, force) }); } catch (e) { st.hw.set(secId, { err: e }); }
  }
  const noticesFor = (s) => (st.notices || []).filter((n) => !n.secs.length || n.secs.includes(s.secId));

  function renderBar() {
    const s = kid();
    const title = bar.querySelector('.topbar-title');
    clear(title);
    const tabName = (TABS.find((t) => t.id === st.tab) || TABS[0]).label;
    const crumb = h('div', { class: 'crumb' }, h('span', null, CFG.schoolName || 'School'), icon('chevron_right'), h('b', null, tabName));
    if (!s) { title.append(h('div', { class: 'app-head' }, schoolId('Parent Portal'), crumb)); return; }
    const sw = h('button', { class: 'kid-switch', type: 'button', 'aria-label': 'Student profile and switch child', onclick: pickKid },
      avatarLetter(s.name, 'sm' + (kidIndex(s.adm) % 2 ? ' g2' : '')), h('span', { class: 't' }, h('span', { class: 'n' }, firstName(s.name) || s.name),
        h('span', { class: 'c' }, `Class ${s.cls}${s.sec ? '-' + s.sec : ''}`)), icon('keyboard_arrow_down'));
    title.append(h('div', { class: 'app-head' }, schoolId('Parent Portal'), crumb, ripple(sw)));
  }
  async function pickKid() {
    const cur = kid();
    const adm = await sheet((done) => h('div', { class: 'menu-sheet' },
      cur ? idCard(cur) : null,
      cur ? profileCard(cur) : null,
      st.order.length > 1 ? [
        h('h3', { style: { margin: '6px 4px 12px' } }, 'Switch child'),
        st.order.map((x, i) => {
          const k = st.kids.get(x);
          return ripple(h('button', { class: 'li tap', type: 'button', 'aria-current': String(x === st.sel), onclick: () => done(x) },
            avatarLetter(k.name, i % 2 ? 'g2' : ''),
            h('div', { class: 'li-body' }, h('div', { class: 'li-title' }, k.name), h('div', { class: 'li-sub' }, `Class ${k.classText} · Adm ${k.adm}${k.roll ? ' · Roll ' + k.roll : ''}`)),
            x === st.sel ? icon('check_circle') : icon('chevron_right')));
        })] : null));
    if (adm && adm !== st.sel) { st.sel = adm; Prefs.set('child', adm); render(true); }
  }
  /// Student details (father, mother, date of birth ...): in the profile sheet, and on the PC dashboard beside the home screen
  function profileCard(cur) {
    return h('div', { class: 'card profile-card', style: { width: '100%' } }, h('div', { class: 'card-title', style: { color: 'var(--primary)', marginBottom: '6px' } }, 'Student profile'),
      h('div', { class: 'kvs' }, [
        ['Father’s name', cur.father], ['Mother’s name', cur.mother], ['Date of birth', cur.dob ? shortDate(cur.dob) : ''], ['Admission number', cur.adm],
        ['Roll number', cur.roll], ['Home address', cur.addr], ['Academic session', cur.session],
      ].filter(([, v]) => v).map(([k, v]) => h('div', null, h('span', null, k), h('b', null, v)))));
  }

  function renderNav() {
    clear(nav);
    if (!kid()) { nav.hidden = true; return; }
    nav.hidden = false;
    nav.append(h('div', { class: 'nav-brand' }, schoolId('Parent Portal')));
    for (const t of TABS) {
      const on = t.id === st.tab;
      nav.append(h('button', { class: 'nav-item', role: 'tab', type: 'button', 'aria-selected': String(on), onclick: () => { if (document.querySelector('.page.pushed')) dropAllLayers(); if (st.tab !== t.id) go(t.id); } },
        h('span', { class: 'nav-pill' }, icon(on ? t.icon + '-fill' : t.icon)), h('span', { class: 'nav-label' }, t.label)));
    }
    nav.append(h('div', { class: 'nav-foot' },
      h('div', { class: 'nav-help' }, h('b', null, 'Need help?'), h('span', null, 'For any question about fees or attendance, please contact the school office.')),
      btn('text', 'Sign out', () => logout(), { icon: 'logout', class: 'nav-signout' })));
  }

  function render(toTop) {
    renderBar();
    renderNav();
    clear(main);
    if (toTop) main.scrollTop = 0;
    const s = kid();
    let body;
    if (st.loading) body = skeleton(4);
    else if (!s) {
      body = messageBox(st.err ? 'wifi_off' : 'person_search',
        st.err ? errorText(st.err) : 'No student is linked to this account yet. Please contact the school office.', () => { st.loading = true; render(); refresh(); });
    } else if (st.tab === 'home') body = homeTab(s);
    else if (st.tab === 'fees') body = feesTab(s);
    else if (st.tab === 'att') body = attTab(s);
    else body = hwTab(s);
    main.append(h('div', { class: 'fade-in' }, demoBanner(), body));
  }

  // ---------- home (dashboard)
  function homeTab(s) {
    const due = s.feeDue > 0, today = istDay(0), mark = s.attDays[today];
    const hw = st.hw.get(s.secId);
    if (!hw) loadHw(s.secId, false).then(() => { if (kid() === s && st.tab === 'home') render(); });
    const hwToday = hw?.days?.[0];
    const ns = noticesFor(s);
    const widget = (onclick, cic, ic, badge, badgeCls, lbl, val, sub, small) => ripple(h('button', { class: 'widget' + (/wide/.test(cic) ? ' wide' : ''), type: 'button', onclick },
      h('div', { class: 'wtop' }, h('div', { class: 'wicon ' + cic.replace('wide', '') }, icon(ic)), h('span', { class: 'wbadge ' + badgeCls }, badge)),
      h('div', null, h('div', { class: 'wlbl' }, lbl), h('div', { class: 'wval' + (small ? ' sm' : '') }, val), h('div', { class: 'wsub' }, sub))));
    const markText = { P: 'Present today', A: 'Absent today', L: 'On leave today' }[mark] || 'Not marked yet';
    const markCls = { P: 't-green', A: 't-red', L: 't-orange' }[mark] || '';
    const hwN = hwToday ? hwToday.items.length : 0;
    return h('div', { class: 'v-home' },
      h('div', { class: 'greet2' }, h('div', null, h('small', null, todayLong()), h('h1', null, `${greeting()}${firstName(s.father) ? ', ' + firstName(s.father) : ''}`))),
      h('div', { class: 'home-main' },
        gatePassCard(s),
        dayNotices(ns),
        h('div', { class: 'section-label wlabel' }, `${firstName(s.name) || 'Your child'} at a glance`),
        h('div', { class: 'wgrid' },
          widget(() => go('att'), 'c-green', 'task_alt', markText, markCls, 'Attendance', s.attS.total ? s.attS.pct.toFixed(1) + '%' : '—',
            s.attS.total ? `${s.attS.p} of ${s.attS.total} days present` : 'Not marked yet'),
          widget(() => go('fees'), 'c-orange', 'currency_rupee', due ? 'Payment due' : 'All clear', due ? 't-orange' : 't-green', 'Fee balance', rupees(s.feeDue),
            due ? (s.feePeriod || 'Tap to pay now') : 'No pending dues'),
          widget(() => go('hw'), 'c-blue wide', 'menu_book', hwN ? `${hwN} today` : '', 't-blue', 'Homework',
            hwToday ? (hwN ? hwToday.items.slice(0, 2).map((x) => x.subject).join(' & ') : 'None today') : 'Checking…', 'View all homework', true)),
        s.upd > 0 ? h('div', { class: 'foot-note' }, 'Last synced with the school: ' + dateTimeText(s.upd)) : null),
      h('aside', { class: 'home-aside' }, idCard(s), profileCard(s)));
  }

  function gatePassCard(s) {
    const gp = todayPass(s);
    if (!gp) return null;                                    // nothing to show on a normal day
    const out = gp.st === 'out' || !!gp.out, wait = gp.st === 'pending';
    const who = `${gp.by}${gp.rel ? ' (' + gp.rel + ')' : ''}`;
    return h('div', { class: 'gp-slim' + (out ? '' : ' wait') },
      h('div', { class: 'gp-ic' }, icon(out ? 'directions_walk' : 'hourglass_top')),
      h('div', { class: 'gp-tx' },
        h('div', { class: 'gp-k' }, out ? 'Left school' : wait ? 'Gate pass · Awaiting approval' : 'Gate pass approved', h('span', null, gp.id)),
        h('div', { class: 'gp-t' }, out ? `Picked up by ${who}` : `${who} is at the school to pick up ${firstName(s.name) || s.name}`),
        h('div', { class: 'gp-s' }, [`Pass issued at ${time12(gp.time)}`, gp.reason].filter(Boolean).join('  ·  '))),
      out ? h('div', { class: 'gp-time' }, time12(gp.out)) : null);
  }

  function idCard(s) {
    const bars = Array.from({ length: 14 }, (_, i) => h('i', { class: (s.adm.charCodeAt(i % s.adm.length) + i) % 3 === 0 ? 'w' : '' }));
    return ripple(h('div', { class: 'idcard' + (kidIndex(s.adm) % 2 ? ' g2' : ''), style: { width: '100%' } },
      h('div', { class: 'holo' }),
      h('div', { class: 'top' }, CFG.schoolName || 'School', s.session ? h('span', null, s.session) : null),
      h('div', { class: 'mid' }, h('div', { class: 'ph' }, avatarLetter(s.name).textContent),
        h('div', { style: { minWidth: 0 } }, h('div', { class: 'nm' }, s.name), h('div', { class: 'mt' }, `Class ${s.classText}${s.roll ? ' · Roll No ' + s.roll : ''}`),
          h('div', { class: 'mt' }, 'Admission no. ' + s.adm))),
      h('div', { class: 'bot' }, h('div', null, h('small', null, 'Date of birth'), h('b', null, s.dob ? shortDate(s.dob) : '—')), h('div', { class: 'barcode' }, bars))));
  }

  // ---------- fees
  function feesTab(s) {
    const due = s.feeDue > 0, link = due ? upiLink(s.upi, s.feeDue) : '';
    const total = s.feePaid + s.feeDue, pct = total ? Math.round((s.feePaid * 100) / total) : 100;
    const pay = due
      ? (link ? h('a', { class: 'pay-btn', href: link }, icon('wallet'), `Pay ${rupees(s.feeDue)} now`)
        : h('div', { class: 'pay-note', style: { marginTop: '14px', fontSize: '12px' } }, 'Online payment isn’t available for this student yet. Please pay at the school office.'))
      : h('div', { class: 'pay-btn', 'aria-disabled': 'true' }, icon('check_circle'), 'No dues. Your account is up to date');
    return h('div', { class: 'v-fees' },
      h('div', { class: 'greet2' }, h('div', null, h('small', null, s.name), h('h1', null, 'Fees & Payments'))),
      h('div', { class: 'fees-main' },
        h('div', { class: 'paycard' + (due ? '' : ' clear') },
          h('div', { class: 'chipx' }),
          h('div', { class: 'lbl' }, due ? 'Amount due' : 'Total balance'),
          h('div', { class: 'amt' }, rupees(s.feeDue)),
          h('div', { class: 'meta' }, due ? (s.feePeriod ? s.feePeriod + (s.feeMonths > 0 ? `  (${s.feeMonths} ${s.feeMonths === 1 ? 'month' : 'months'})` : '') : 'Payment pending') : 'You’re all paid up'),
          s.feeAsOn ? h('div', { class: 'per' }, 'As of ' + shortDate(s.feeAsOn)) : null,
          pay,
        ),
        h('div', { class: 'card' },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700 } },
            h('span', { style: { color: 'var(--on-surface-variant)' } }, s.session ? `Session ${s.session}` : 'This session'), h('span', { class: 't-green' }, `${pct}% paid`)),
          h('div', { class: 'prog' }, h('i', { style: { width: pct + '%' } })),
          h('div', { class: 'trio' },
            h('div', null, h('small', null, 'Paid so far'), h('b', { class: 't-green' }, rupees(s.feePaid))),
            h('div', { style: { textAlign: 'right' } }, h('small', null, 'Balance'), h('b', { class: 't-orange' }, rupees(s.feeDue)))))),
      h('div', { class: 'fees-side' },
        h('div', { class: 'section-label' }, 'Payment receipts'),
        s.receipts.length
          ? h('div', { class: 'list' }, s.receipts.map((r) => h('div', { class: 'li' }, h('div', { class: 'li-lead' }, icon('receipt_long')),
            h('div', { class: 'li-body' }, h('div', { class: 'li-title' }, 'Receipt ' + r.no), h('div', { class: 'li-sub' }, [shortDate(r.date), r.mode].filter(Boolean).join('  ·  '))),
            h('div', { class: 'amount' }, rupees(r.amt)))))
          : h('div', { class: 'hw-none' }, icon('receipt_long'), 'No payments recorded yet'),
        h('div', { class: 'foot-note' }, 'Fee details are synced from the school office. If anything looks incorrect, please contact the school office.')));
  }

  // ---------- attendance
  function attTab(s) {
    const c = st.attView === 'month' ? s.attM : s.attS;
    const R = 46, C = 2 * Math.PI * R;
    const fg = h('circle', { class: 'fg', cx: 56, cy: 56, r: R, 'stroke-dasharray': C, 'stroke-dashoffset': C });
    requestAnimationFrame(() => requestAnimationFrame(() => fg.setAttribute('stroke-dashoffset', C * (1 - c.pct / 100))));
    const segBtn = (id, label) => h('button', { type: 'button', 'aria-pressed': String(st.attView === id), onclick: () => { st.attView = id; render(); } }, label);
    const stat = (k, label, n) => h('div', { class: 'stat' }, h('span', { class: 'dot ' + k }), label, h('b', null, `${n} ${n === 1 ? 'day' : 'days'}`));
    const streak = streakOf(s);
    return h('div', { class: 'v-att' },
      h('div', { class: 'greet2' }, h('div', null, h('small', null, s.name), h('h1', null, 'Attendance'))),
      h('div', { class: 'seg', role: 'group' }, segBtn('session', 'This session'), segBtn('month', 'This month')),
      h('div', { class: 'att-cols' },
        h('div', { class: 'card' },
          h('div', { class: 'card-title' }, icon('task_alt'), st.attView === 'month' ? 'This month' : `This session${s.session ? ' · ' + s.session : ''}`),
          c.total > 0
            ? h('div', null,
              h('div', { class: 'ring-card' },
                h('div', { class: 'ring' }, h('svg', { viewBox: '0 0 112 112' }, h('circle', { class: 'bg', cx: 56, cy: 56, r: R }), fg),
                  h('div', { class: 'pct' }, h('span', null, c.pct.toFixed(1), h('small', null, '%')))),
                h('div', { class: 'ring-side' }, stat('P', 'Present', c.p), stat('A', 'Absent', c.a), stat('L', 'On leave', c.l))),
              streak >= 3 ? h('div', { class: 'streak' }, icon('local_fire_department'), h('div', null, h('b', null, `${streak}-day streak`), h('span', null, 'Present on every school day in a row. Keep it up!'))) : null)
            : h('div', { class: 'hw-none', style: { margin: 0 } }, icon('event_busy'), 'Attendance hasn’t been marked yet')),
        calendar(s)),
      h('div', { class: 'foot-note' }, 'Attendance appears here within a few minutes of the school marking it.'));
  }
  function calendar(s) {
    const first = istDay(29), today = istDay(0);
    const lead = (parseYmd(first).getUTCDay() + 6) % 7; // Monday first
    const word = { P: 'Present', A: 'Absent', L: 'On leave' };
    const cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('div', { class: 'wd' }, d));
    for (let i = 0; i < lead; i++) cells.push(h('div'));
    for (let i = 29; i >= 0; i--) {
      const d = istDay(i), m = s.attDays[d];
      const k = m === 'P' || m === 'A' || m === 'L' ? m : null;
      cells.push(h('div', { class: `d ${k || 'none'}${d === today ? ' today' : ''}`, title: `${niceDate(d)}${k ? ': ' + word[k] : ''}`,
        onclick: () => snackbar(`${niceDate(d)}: ${k ? word[k] : 'No attendance (holiday or not marked)'}`) },
      String(parseYmd(d).getUTCDate()), k ? h('span', { class: 'm' }, k) : null));
    }
    return h('div', { class: 'card' },
      h('div', { class: 'card-title' }, icon('calendar_month'), `Last 30 days  ·  ${dayMon(first)} – ${dayMon(today)}`),
      Object.keys(s.attDays).length ? h('div', { class: 'cal' }, cells) : h('div', { class: 'hw-none', style: { margin: 0 } }, icon('event_busy'), 'Attendance hasn’t been marked yet'),
      h('div', { class: 'legend' }, h('span', null, h('i', { class: 'dot P' }), 'Present'), h('span', null, h('i', { class: 'dot A' }), 'Absent'), h('span', null, h('i', { class: 'dot L' }), 'On leave')));
  }

  // ---------- homework
  function hwTab(s) {
    const got = st.hw.get(s.secId);
    const head = h('div', { class: 'greet2' }, h('div', null, h('small', null, `${s.name} · Class ${s.classText}`), h('h1', null, 'Homework')));
    if (!got) {
      loadHw(s.secId, false).then(() => { if (kid() === s && st.tab === 'hw') render(); });
      return h('div', { class: 'v-hw' }, head, skeleton(3));
    }
    if (got.err) return h('div', { class: 'v-hw' }, head, messageBox('wifi_off', errorText(got.err), async () => { st.hw.delete(s.secId); render(); }));
    const out = h('div', { class: 'v-hw' }, head);
    got.days.forEach((d, i) => { if (i <= 1 || !d.empty) out.append(dayBlock(d, i === 0 ? 'Today' : i === 1 ? 'Yesterday' : null, s.secId)); });
    out.append(h('div', { class: 'more-btn' }, btn('outlined', 'Earlier homework', () => oldHomework(s), { icon: 'history' })));
    return out;
  }

  render();
  load(false).then(() => render());
}

function noticeCard(n) {
  return h('div', { class: 'notice' + (n.pin ? ' pin' : '') },
    h('div', { class: 'nk' }, n.pin ? h('span', { class: 'src pinned' }, 'Pinned') : null,
      h('span', { class: 'src' + (n.src === 'class' ? ' cls' : '') }, n.src === 'class' ? 'Class notice · ' + n.secs.join(', ') : 'School notice'), n.date ? niceDate(n.date) : null),
    h('h3', null, n.t || 'Notice'), n.b ? h('p', null, n.b) : null,
    h('div', { class: 'nf' }, h('span', null, n.by ? 'From ' + n.by : ''), n.exp ? h('span', null, 'Until ' + shortDate(n.exp)) : null));
}
/// Dashboard notices: two swipeable cards, one for the school, one for the class (today's / pinned first).
function dayNotices(ns) {
  const today = istDay(0), rank = (n) => (n.pin ? 0 : n.date === today ? 1 : 2);
  const sort = (L) => [...L].sort((x, y) => rank(x) - rank(y) || String(y.date).localeCompare(String(x.date)));
  const row = (L) => {
    if (!L.length) return null;
    const dots = L.length > 1 ? h('div', { class: 'ndots' }, L.map((_, i) => h('i', { class: i ? '' : 'on', 'aria-label': `Go to notice ${i + 1}` }))) : null;
    const strip = h('div', { class: 'nrow' + (L.length > 1 ? '' : ' one') }, L.map(noticeWallet));
    if (dots) {
      strip.addEventListener('scroll', () => {
        const cardW = strip.firstChild ? strip.firstChild.offsetWidth : 0;
        if (!cardW) return;
        const i = Math.round(strip.scrollLeft / (cardW + 12));
        [...dots.children].forEach((d, j) => d.classList.toggle('on', j === i));
      }, { passive: true });
      [...dots.children].forEach((d, idx) => {
        d.addEventListener('click', () => {
          const cardW = strip.firstChild ? strip.firstChild.offsetWidth : 0;
          if (cardW) strip.scrollTo({ left: idx * (cardW + 12), behavior: 'smooth' });
        });
      });
    }
    return h('div', null, strip, dots);
  };
  const school = row(sort(ns.filter((n) => n.src !== 'class'))), cls = row(sort(ns.filter((n) => n.src === 'class')));
  return school || cls ? h('div', null, h('div', { class: 'section-label' }, 'Notices & announcements'), school, cls) : null;
}
function noticeWallet(n) {
  const kind = n.pin ? 'pin' : n.src === 'class' ? 'cls' : 'sch';
  return h('div', { class: 'ncard ' + kind },
    h('div', { class: 'holo' }),
    h('div', { class: 'top' }, n.src === 'class' ? 'Class notice · ' + n.secs.join(', ') : 'School notice', h('span', null, n.pin ? 'Pinned' : niceDate(n.date))),
    h('div', { class: 'nt' }, n.t || 'Notice'), n.b ? h('div', { class: 'nb' }, n.b) : null,
    h('div', { class: 'bot' }, h('span', null, n.by ? 'From ' + n.by : CFG.schoolName || ''), n.exp ? h('span', null, 'Until ' + shortDate(n.exp)) : null));
}
function allNotices(ns) {
  pushPage('Notices', ns.length ? h('div', { style: { paddingTop: '8px' } }, ns.map(noticeCard))
    : messageBox('campaign', 'You’re all caught up. School notices and messages from the class teacher will appear here.'));
}

function dayBlock(d, badge, secId) {
  return h('div', null,
    h('div', { class: 'day-head' }, badge ? h('span', { class: 'badge' }, badge.toUpperCase()) : null, h('b', null, badge ? weekDay(d.date) : niceDate(d.date)),
      badge ? h('span', null, shortDate(d.date)) : null),
    d.empty ? h('div', { class: 'hw-none' }, icon('auto_stories'), 'No homework for this day') : h('div', { class: 'hw-grid' }, d.items.map((it) => hwCard(it, `${secId}_${d.date}_${it.key}`))));
}
function hwCard(it, doneKey) {
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'Link'; } };
  const done = !!(doneKey && Prefs.get('hwdone:' + doneKey));
  const box = h('div', { class: 'hw' + (done ? ' done' : '') });
  const tick = doneKey ? h('button', { class: 'hw-done' + (done ? ' on' : ''), type: 'button', 'aria-label': 'Mark as done', title: 'Mark as done (saved on this device only)',
    onclick: () => { const on = !Prefs.get('hwdone:' + doneKey); if (on) Prefs.set('hwdone:' + doneKey, 1); else Prefs.remove('hwdone:' + doneKey); tick.classList.toggle('on', on); box.classList.toggle('done', on); clear(tick); if (on) tick.append(icon('check')); } },
  done ? icon('check') : null) : null;
  box.append(tick || h('span'),
    h('div', { class: 'hw-body' },
      h('div', { class: 'hw-top' }, h('span', { class: 'hw-sub ' + hueClass(it.key), style: { padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 750, textTransform: 'uppercase' } }, it.subject),
        it.teacher ? h('span', { class: 'hw-teacher' }, it.teacher) : null),
      it.text ? h('div', { class: 'hw-text' }, it.text) : null,
      it.att.length ? h('div', { class: 'hw-links' }, it.att.map((u, j) => ripple(h('a', { class: 'chip link', href: u, target: '_blank', rel: 'noopener noreferrer' },
        icon('attach_file'), h('span', null, it.att.length === 1 ? 'Open attachment' : `Attachment ${j + 1}`), h('small', { style: { opacity: 0.7, fontWeight: 400 } }, host(u)))))) : null));
  return box;
}

/// "Older homework": 8 to 60 days ago, 7 days at a time while the parent scrolls, phone copy first.
function oldHomework(s) {
  let next = 8, busy = false, shown = 0;
  const list = h('div');
  const foot = h('div', { class: 'more-btn' });
  const sentinel = h('div', { style: { height: '1px' } });
  const main = pushPage('Earlier homework', h('div', null, list, foot, sentinel));
  const bar = main.previousSibling;
  const sub = h('small', null, `${s.name} · Class ${s.classText}`);
  bar.querySelector('.topbar-title').append(sub);
  const done = () => next > KEEP_DAYS;
  const footer = (err) => {
    clear(foot);
    if (busy) foot.append(spinner(40));
    else if (err) foot.append(h('div', { style: { textAlign: 'center' } }, h('p', null, 'Couldn’t load. Please check your internet and try again.'), btn('tonal', 'Retry', more, { icon: 'refresh' })));
    else if (!done()) foot.append(btn('outlined', `Show earlier homework (${next}–${Math.min(next + 6, KEEP_DAYS)} days ago)`, more));
    else foot.append(h('div', { class: 'foot-note' }, shown ? `You’re all caught up. Homework is kept for ${KEEP_DAYS} days.` : `No homework in the last ${KEEP_DAYS} days.`));
  };
  async function more() {
    if (busy || done()) return;
    busy = true; footer();
    let err = null;
    try {
      const page = await Repo.older(s.secId, next);
      next += 7;
      for (const d of page) if (!d.empty) { list.append(h('div', { class: 'fade-in' }, dayBlock(d, null, s.secId))); shown++; }
    } catch (e) { err = e; }
    busy = false; footer(err);
    if (!err && !done() && sentinel.getBoundingClientRect().top < main.clientHeight + 400) more();
  }
  new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) more(); }, { root: main, rootMargin: '400px' }).observe(sentinel);
  more();
}
