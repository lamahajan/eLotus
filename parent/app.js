// EduNest Parent App (web / PWA). Same data and the same read-saving rules as the old Flutter app:
//   student          server at most every 15 min (attendance / fees change during the day; pull to refresh: now)
//   today            server at most every 30 min
//   yesterday        server at most every 6 h
//   2..7 days ago    phone first, server only if the phone never saw that day
//   older (to 60)    only when "Older homework" is opened, 7 days at a time, phone first
import {
  CFG, DOMAIN, KEEP_DAYS, h, icon, clear, applyTheme, registerSW, api, getCacheFirst, getFresh, claims,
  loginErrorText, errorText, Prefs, istDay, parseYmd, niceDate, shortDate, dayMon, weekDay, rupees, dateTimeText, btn, iconBtn, setBusy, field,
  snackbar, dialog, sheet, pushPage, popLayer, dropAllLayers, topBar, watchScroll, pullToRefresh, messageBox, skeleton, avatarLetter, hueClass,
  demoBanner, installCard, offlineChip, spinner, ripple, brandMark, brandDot,
} from '../assets/core.js';

const HOUR = 3600e3, MIN = 60e3;
applyTheme(CFG.themeColor);
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
    const s = await getFresh('students/' + adm, 15 * MIN, force);
    return s.data ? toStudent(adm, s.data) : null;
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
function toStudent(adm, d) {
  const fee = d.fee || {}, att = d.att || {};
  return {
    adm, name: S(d, 'name'), cls: S(d, 'cls'), sec: S(d, 'sec'), secId: S(d, 'secId'), roll: S(d, 'roll'), dob: S(d, 'dob'),
    father: S(d, 'father'), mother: S(d, 'mother'), gender: S(d, 'gender'), addr: S(d, 'addr'), session: S(d, 'session'),
    feeDue: I(fee, 'due'), feeMonths: I(fee, 'months'), feePaid: I(fee, 'paid'), feePeriod: S(fee, 'period'), feeAsOn: S(fee, 'asOn'),
    receipts: (Array.isArray(fee.rc) ? fee.rc : []).filter((r) => r && typeof r === 'object').map((r) => ({ no: S(r, 'no'), date: S(r, 'date'), amt: I(r, 'amt'), mode: S(r, 'mode') })),
    attS: counts(att.s), attM: counts(att.m), attMon: S(att, 'mon'),
    attDays: Object.fromEntries(Object.entries(att.d && typeof att.d === 'object' ? att.d : {}).map(([k, v]) => [k, String(v)])),
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
    if (c.role !== 'p') { loginMsg = 'This is not a parent login.'; await logout(true); return; }
    showHome();   // the password is always the mobile number (school rule): no new-password screen
  } catch (e) {
    if (v === gate) showHome();
  }
});

async function logout(silent) {
  if (!silent) {
    const ok = await dialog({ icon: 'logout', title: 'Log out?', text: 'You will need the Admission No and password to log in again.',
      actions: [{ label: 'Cancel', value: false }, { label: 'Logout', value: true, kind: 'filled' }] });
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
  const fAdm = field({ label: 'Admission No', lead: 'badge', inputmode: 'numeric', autocomplete: 'username', name: 'username', onenter: () => fPw.input.focus() });
  const fPw = field({ label: 'Password', type: 'password', lead: 'lock', helper: 'Password: Mobile No 1 (10 digits)', autocomplete: 'current-password', name: 'password', onenter: () => go() });
  fAdm.input.value = Prefs.get('lastAdm') || '';
  const go = async () => {
    const adm = fAdm.input.value.trim(), pw = fPw.input.value;
    showErr(null);
    if (!adm || !pw) return showErr('Enter both the Admission No and password');
    if (adm.includes('/')) return showErr('Admission No is not valid');
    setBusy(b, true);
    try {
      let idx;
      try { idx = await a.getServer('loginIndex/' + adm); } catch { throw new Error('No internet connection. Please try again.'); }
      const fam = idx.data?.f;
      if (!idx.exists || !fam) throw new Error('This Admission No was not found (or Mobile No 1 is missing at school). Please contact the school office.');
      Prefs.set('lastAdm', adm);
      try { await a.signIn(`${fam}@${DOMAIN}`, pw); } catch (e) { throw new Error(loginErrorText(e.code, 'p')); }
    } catch (e) {
      showErr(e.message);
      setBusy(b, false);
    }
  };
  const b = btn('filled', 'Login', go, { class: 'btn-big btn-block' });
  if (loginMsg) { showErr(loginMsg); loginMsg = null; }
  const page = h('div', { class: 'page' }, h('div', { class: 'login' },
    h('div', { class: 'login-hero' }, brandMark('school-fill'), title, h('div', { class: 'login-kicker' }, 'Parent App'),
      h('p', null, 'Enter your child\'s Admission No and password')),
    h('form', { class: 'login-form', onsubmit: (e) => { e.preventDefault(); go(); } }, err, fAdm, fPw, b),
    h('div', { class: 'login-tip' }, 'More than one child at school? Use any one child\'s Admission No and all of them will show in the app.'),
    demoBanner(), installCard()));
  mount(page);
  Repo.appName().then((n) => { if (n) { title.textContent = n; document.title = n; } });
}

// ------------------------------------------------------------------ home: children + 4 tabs
const TABS = [
  { id: 'profile', label: 'Profile', icon: 'person' },
  { id: 'fees', label: 'Fees', icon: 'currency_rupee' },
  { id: 'att', label: 'Attendance', icon: 'event_available' },
  { id: 'hw', label: 'Homework', icon: 'menu_book' },
];

function showHome() {
  const st = { kids: new Map(), order: [], sel: null, tab: Prefs.get('tab') || 'profile', hw: new Map(), err: null, loading: true, attView: 'session' };
  const main = h('main', { class: 'content' });
  const bar = topBar({ title: '', actions: [iconBtn('logout', () => logout(), 'Logout')] });
  const nav = h('nav', { class: 'navbar', role: 'tablist' });
  const page = h('div', { class: 'page has-nav' }, bar, main, nav);
  watchScroll(main, bar);
  pullToRefresh(main, () => refresh());
  mount(page);

  const kid = () => (st.sel ? st.kids.get(st.sel) : null);

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
  }
  async function refresh() {
    await load(true);
    const s = kid();
    if (s && st.tab === 'hw') await loadHw(s.secId, true);
    render(false);
  }
  async function loadHw(secId, force) {
    try { st.hw.set(secId, { days: await Repo.recent(secId, force) }); } catch (e) { st.hw.set(secId, { err: e }); }
  }

  function renderBar() {
    const s = kid();
    const title = bar.querySelector('.topbar-title');
    clear(title);
    if (!s) { title.append(CFG.schoolName || 'Parent App'); return; }
    const many = st.order.length > 1;
    const sw = h('button', { class: 'kid-switch', type: 'button', disabled: !many, 'aria-label': many ? 'Switch child' : s.name, onclick: many ? pickKid : null },
      avatarLetter(s.name, 'sm'), h('span', { class: 't' }, h('span', { class: 'n' }, s.name), h('span', { class: 'c' }, 'Class ' + s.classText)),
      many ? icon('arrow_drop_down') : null);
    title.append(many ? ripple(sw) : sw);
  }
  async function pickKid() {
    const adm = await sheet((done) => h('div', { class: 'menu-sheet' },
      h('h3', { style: { margin: '0 4px 12px' } }, 'Choose child'),
      st.order.map((x) => {
        const k = st.kids.get(x);
        return ripple(h('button', { class: 'li tap', type: 'button', 'aria-current': String(x === st.sel), onclick: () => done(x) },
          avatarLetter(k.name), h('div', { class: 'li-body' }, h('div', { class: 'li-title' }, k.name), h('div', { class: 'li-sub' }, `Class ${k.classText} · Adm ${k.adm}`)),
          x === st.sel ? icon('check_circle') : null));
      })));
    if (adm && adm !== st.sel) { st.sel = adm; Prefs.set('child', adm); render(true); }
  }

  function renderNav() {
    clear(nav);
    if (!kid()) { nav.hidden = true; return; }
    nav.hidden = false;
    for (const t of TABS) {
      const on = t.id === st.tab;
      nav.append(h('button', { class: 'nav-item', role: 'tab', type: 'button', 'aria-selected': String(on), onclick: () => { if (st.tab !== t.id) { st.tab = t.id; Prefs.set('tab', t.id); render(true); } } },
        ripple(h('span', { class: 'nav-pill' }, icon(on ? t.icon + '-fill' : t.icon))), t.label));
    }
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
        st.err ? errorText(st.err) : 'No child is linked to this login yet. Please contact the school office.', () => { st.loading = true; render(); refresh(); });
    } else if (st.tab === 'profile') body = profileTab(s);
    else if (st.tab === 'fees') body = feesTab(s);
    else if (st.tab === 'att') body = attTab(s);
    else body = hwTab(s);
    main.append(h('div', { class: 'fade-in' }, demoBanner(), body));
  }

  // ---------- profile
  function profileTab(s) {
    const kv = (ic, k, v) => v && String(v).trim() ? h('div', { class: 'kv' }, icon(ic), h('div', null, h('div', { class: 'kv-k' }, k), h('div', { class: 'kv-v' }, v))) : null;
    const due = s.feeDue > 0, pct = s.attS.total ? s.attS.pct.toFixed(1) + '%' : '—';
    const go = (t) => () => { st.tab = t; Prefs.set('tab', t); render(true); };
    return h('div', null,
      h('div', { class: 'hero' }, h('div', { style: { display: 'flex', justifyContent: 'center' } }, avatarLetter(s.name, 'xl')),
        h('h2', null, s.name), h('div', { class: 'meta' }, h('span', null, 'Class ' + s.classText), s.roll ? h('span', null, 'Roll No ' + s.roll) : null)),
      h('div', { class: 'tiles' },
        ripple(h('button', { class: 'tile ' + (due ? 'bad' : 'good'), type: 'button', onclick: go('fees') }, icon(due ? 'account_balance_wallet' : 'task_alt'), h('b', null, rupees(s.feeDue)), h('small', null, 'Fee due'))),
        ripple(h('button', { class: 'tile t1', type: 'button', onclick: go('att') }, icon('event_available'), h('b', null, pct), h('small', null, 'Attendance')))),
      h('div', { class: 'card' }, h('div', { class: 'card-title' }, 'Details'),
        kv('badge', 'Admission No', s.adm), kv('cake', 'Date of birth', s.dob ? shortDate(s.dob) : ''), kv('person', "Father's name", s.father),
        kv('person', "Mother's name", s.mother), kv('location_on', 'Address', s.addr), kv('calendar_month', 'Session', s.session)),
      s.upd > 0 ? h('div', { class: 'foot-note' }, 'Last updated by school: ' + dateTimeText(s.upd)) : null,
      CFG.logo ? h('div', { class: 'brand-foot' }, brandDot(), CFG.schoolName || '') : null);
  }

  // ---------- fees
  function feesTab(s) {
    const due = s.feeDue > 0;
    return h('div', null,
      h('div', { class: 'due-card ' + (due ? 'bad' : 'good') },
        h('div', { class: 'lbl' }, icon(due ? 'error' : 'check_circle'), due ? 'Fee due' : 'No fee due'),
        h('div', { class: 'amt' }, rupees(s.feeDue)),
        due && s.feePeriod ? h('div', { class: 'per' }, s.feePeriod + (s.feeMonths > 0 ? `  (${s.feeMonths} ${s.feeMonths === 1 ? 'month' : 'months'})` : '')) : null,
        s.feeAsOn ? h('div', { class: 'ason' }, 'As on ' + shortDate(s.feeAsOn)) : null,
        icon('currency_rupee', 'deco')),
      h('div', { class: 'card' }, h('div', { class: 'paid-row' },
        h('div', null, h('div', { class: 'card-title', style: { margin: 0 } }, icon('savings'), 'Paid this session')), h('b', null, rupees(s.feePaid)))),
      h('div', { class: 'section-label' }, 'Past receipts'),
      s.receipts.length
        ? h('div', { class: 'list' }, s.receipts.map((r) => h('div', { class: 'li' }, h('div', { class: 'li-lead' }, icon('receipt_long')),
          h('div', { class: 'li-body' }, h('div', { class: 'li-title' }, 'Receipt ' + r.no), h('div', { class: 'li-sub' }, [shortDate(r.date), r.mode].filter(Boolean).join('  ·  '))),
          h('div', { class: 'amount' }, rupees(r.amt)))))
        : h('div', { class: 'hw-none' }, icon('receipt_long'), 'No receipts yet'),
      h('div', { class: 'foot-note' }, 'Fee details come from the school\'s EduNest. If something looks wrong, please contact the school office.'));
  }

  // ---------- attendance
  function attTab(s) {
    const c = st.attView === 'month' ? s.attM : s.attS;
    const R = 46, C = 2 * Math.PI * R;
    const fg = h('circle', { class: 'fg', cx: 56, cy: 56, r: R, 'stroke-dasharray': C, 'stroke-dashoffset': C });
    requestAnimationFrame(() => requestAnimationFrame(() => fg.setAttribute('stroke-dashoffset', C * (1 - c.pct / 100))));
    const segBtn = (id, label) => h('button', { type: 'button', 'aria-pressed': String(st.attView === id), onclick: () => { st.attView = id; render(); } }, label);
    const stat = (k, label, n) => h('div', { class: 'stat' }, h('span', { class: 'dot ' + k }), label, h('b', null, n));
    const barPart = (k, n) => n > 0 ? h('i', { class: k, style: { flex: n } }) : null;
    return h('div', null,
      h('div', { class: 'seg', role: 'group' }, segBtn('session', 'Whole session'), segBtn('month', 'This month')),
      h('div', { class: 'card' },
        c.total > 0
          ? h('div', null,
            h('div', { class: 'ring-card' },
              h('div', { class: 'ring' }, h('svg', { viewBox: '0 0 112 112' }, h('circle', { class: 'bg', cx: 56, cy: 56, r: R }), fg),
                h('div', { class: 'pct' }, h('span', null, c.pct.toFixed(1), h('small', null, '%')))),
              h('div', { class: 'ring-side' }, stat('P', 'Present', c.p), stat('A', 'Absent', c.a), stat('L', 'Leave', c.l))),
            h('div', { class: 'bar', style: { marginTop: '18px' } }, barPart('P', c.p), barPart('A', c.a), barPart('L', c.l)))
          : h('div', { class: 'hw-none', style: { margin: 0 } }, icon('event_busy'), 'No attendance marked yet')),
      calendar(s),
      h('div', { class: 'foot-note' }, 'Attendance is updated every evening.'));
  }
  function calendar(s) {
    const first = istDay(29), today = istDay(0);
    const lead = (parseYmd(first).getUTCDay() + 6) % 7; // Monday first
    const cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('div', { class: 'wd' }, d));
    for (let i = 0; i < lead; i++) cells.push(h('div'));
    for (let i = 29; i >= 0; i--) {
      const d = istDay(i), m = s.attDays[d];
      const k = m === 'P' || m === 'A' || m === 'L' ? m : null;
      cells.push(h('div', { class: `d ${k || 'none'}${d === today ? ' today' : ''}`, title: `${niceDate(d)}${k ? ': ' + { P: 'Present', A: 'Absent', L: 'Leave' }[k] : ''}` },
        String(parseYmd(d).getUTCDate()), k ? h('span', { class: 'm' }, k) : null));
    }
    return h('div', { class: 'card' },
      h('div', { class: 'card-title' }, icon('calendar_month'), `Last 30 days  ·  ${dayMon(first)} – ${dayMon(today)}`),
      Object.keys(s.attDays).length ? h('div', { class: 'cal' }, cells) : h('div', { class: 'hw-none', style: { margin: 0 } }, icon('event_busy'), 'No attendance marked yet'),
      h('div', { class: 'legend' }, h('span', null, h('i', { class: 'dot P' }), 'Present'), h('span', null, h('i', { class: 'dot A' }), 'Absent'), h('span', null, h('i', { class: 'dot L' }), 'Leave')));
  }

  // ---------- homework
  function hwTab(s) {
    const got = st.hw.get(s.secId);
    if (!got) {
      loadHw(s.secId, false).then(() => { if (kid() === s && st.tab === 'hw') render(); });
      return skeleton(3);
    }
    if (got.err) return messageBox('wifi_off', errorText(got.err), async () => { st.hw.delete(s.secId); render(); });
    const out = h('div');
    got.days.forEach((d, i) => { if (i <= 1 || !d.empty) out.append(dayBlock(d, i === 0 ? 'Today' : i === 1 ? 'Yesterday' : null)); });
    out.append(h('div', { class: 'more-btn' }, btn('outlined', 'Older homework', () => oldHomework(s), { icon: 'history' })));
    return out;
  }

  render();
  load(false).then(() => render());
}

function dayBlock(d, badge) {
  return h('div', null,
    h('div', { class: 'day-head' }, badge ? h('span', { class: 'badge' }, badge.toUpperCase()) : null, h('b', null, badge ? weekDay(d.date) : niceDate(d.date)),
      badge ? h('span', null, shortDate(d.date)) : null),
    d.empty ? h('div', { class: 'hw-none' }, icon('auto_stories'), 'No homework') : d.items.map(hwCard));
}
function hwCard(it) {
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'Link'; } };
  return h('div', { class: 'hw' },
    h('div', { class: 'hw-ic ' + hueClass(it.key) }, it.subject.slice(0, 2).toUpperCase()),
    h('div', { class: 'hw-body' },
      h('div', { class: 'hw-top' }, h('span', { class: 'hw-sub' }, it.subject), it.teacher ? h('span', { class: 'hw-teacher' }, it.teacher) : null),
      it.text ? h('div', { class: 'hw-text' }, it.text) : null,
      it.att.length ? h('div', { class: 'hw-links' }, it.att.map((u, j) => ripple(h('a', { class: 'chip link', href: u, target: '_blank', rel: 'noopener noreferrer' },
        icon('attach_file'), h('span', null, it.att.length === 1 ? 'Open attachment' : `Attachment ${j + 1}`), h('small', { style: { opacity: 0.7, fontWeight: 400 } }, host(u)))))) : null));
}

/// "Older homework": 8 to 60 days ago, 7 days at a time while the parent scrolls, phone copy first.
function oldHomework(s) {
  let next = 8, busy = false, shown = 0;
  const list = h('div');
  const foot = h('div', { class: 'more-btn' });
  const sentinel = h('div', { style: { height: '1px' } });
  const main = pushPage('Older homework', h('div', null, list, foot, sentinel));
  const bar = main.previousSibling;
  const sub = h('small', null, `${s.name} · Class ${s.classText}`);
  bar.querySelector('.topbar-title').append(sub);
  const done = () => next > KEEP_DAYS;
  const footer = (err) => {
    clear(foot);
    if (busy) foot.append(spinner(40));
    else if (err) foot.append(h('div', { style: { textAlign: 'center' } }, h('p', null, 'Could not load. Check your internet and try again.'), btn('tonal', 'Retry', more, { icon: 'refresh' })));
    else if (!done()) foot.append(btn('outlined', `Load older (${next}-${Math.min(next + 6, KEEP_DAYS)} days ago)`, more));
    else foot.append(h('div', { class: 'foot-note' }, shown ? `That's all (homework is kept for ${KEEP_DAYS} days)` : `No other homework in the last ${KEEP_DAYS} days`));
  };
  async function more() {
    if (busy || done()) return;
    busy = true; footer();
    let err = null;
    try {
      const page = await Repo.older(s.secId, next);
      next += 7;
      for (const d of page) if (!d.empty) { list.append(h('div', { class: 'fade-in' }, dayBlock(d, null))); shown++; }
    } catch (e) { err = e; }
    busy = false; footer(err);
    if (!err && !done() && sentinel.getBoundingClientRect().top < main.clientHeight + 400) more();
  }
  new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) more(); }, { root: main, rootMargin: '400px' }).observe(sentinel);
  more();
}
