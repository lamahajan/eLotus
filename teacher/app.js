// EduNest Teacher App (web / PWA).
// Homework: one document per read; a save touches only this teacher's subject inside the section's day document (merge),
// so two teachers saving at the same time never overwrite each other.
// Marks (EduNest 1.0.52): mkcfg/{secId} (students, subjects, max marks: written by EduNest) + one sheet per section / term / assessment / subject
// (marks/{secId}~{session}~{term}~{code}~{subject}); a save writes only the changed cells; EduNest takes them into Mark Entry within a minute.
import {
  CFG, DOMAIN, sheetPath, h, icon, clear, applyTheme, registerSW, api, getFresh, claims, loginErrorText, errorText,
  Prefs, istDay, niceDate, shortDate, weekDay, dayMon, btn, iconBtn, setBusy, field, snackbar, dialog, sheet, pushPage, dropAllLayers, topBar,
  watchScroll, pullToRefresh, messageBox, skeleton, avatarLetter, hueClass, demoBanner, installCard, offlineChip, spinner, ripple, brandMark, brandDot, siteUrl, themeBtn, greeting, todayLong,
} from '../assets/core.js';

const HOUR = 3600e3, MIN = 60e3;
const EDIT_DAYS_BACK = 7, MAX_TEXT = 3000, MAX_LINKS = 5;
applyTheme(CFG.themeColor);
registerSW();
const root = document.getElementById('app');
document.body.append(offlineChip());
const a = await api();

// ------------------------------------------------------------------ data
const strMap = (m) => Object.fromEntries(Object.entries(m && typeof m === 'object' ? m : {}).map(([k, v]) => [k, String(v)]));
function toTeacher(uid, d) {
  const secs = {};
  for (const [k, v] of Object.entries(d.secs && typeof d.secs === 'object' ? d.secs : {})) secs[k] = Array.isArray(v) ? v.map(String) : [];
  const t = { uid, name: String(d.name ?? ''), ct: String(d.ct ?? ''), secs, subj: strMap(d.subj), ctSubj: strMap(d.ctSubj), sf: d.sf === true };
  t.nameOf = (k) => t.subj[k] ?? t.ctSubj[k] ?? k;
  /// own class first, then the rest in order
  t.sections = (() => {
    const all = [...new Set([...Object.keys(secs), ...(t.ct ? [t.ct] : [])])].sort();
    if (t.ct) { all.splice(all.indexOf(t.ct), 1); all.unshift(t.ct); }
    return all;
  })();
  /// subject keys this teacher may write in secId (same rule as firestore.rules)
  t.allowed = (secId) => {
    const own = [...(secs[secId] || [])];
    if (secId === t.ct) for (const k of Object.keys(t.ctSubj)) if (!own.includes(k)) own.push(k);
    return own.sort((x, y) => t.nameOf(x).toLowerCase().localeCompare(t.nameOf(y).toLowerCase()));
  };
  return t;
}
function toDay(date, d) {
  const items = [];
  for (const [k, v] of Object.entries(d && typeof d.subjects === 'object' ? d.subjects : {})) {
    if (!v || typeof v !== 'object') continue;
    const text = String(v.text ?? '').trim();
    const att = Array.isArray(v.attachments) ? v.attachments.map(String).filter((x) => x.startsWith('http')) : [];
    if (!text && !att.length) continue;
    items.push({ key: k, subject: String(v.name ?? k), text, teacher: String(v.teacher ?? ''), att });
  }
  items.sort((x, y) => x.subject.toLowerCase().localeCompare(y.subject.toLowerCase()));
  return { date, items };
}
const Repo = {
  async me(force) {
    const uid = a.user()?.uid;
    if (!uid) return null;
    const s = await getFresh('teachers/' + uid, 6 * HOUR, force);
    return s.data ? toTeacher(uid, s.data) : null;
  },
  async day(secId, date, force) {
    const s = await getFresh(`homework/${secId}_${date}`, 5 * MIN, force);
    return toDay(date, s.data);
  },
  save({ secId, date, key, subjectName, teacherName, text, links }) {
    const now = Date.now();
    return a.setMerge(`homework/${secId}_${date}`, {
      secId, date, upd: now,
      subjects: { [key]: { name: subjectName, text: text.trim(), teacher: teacherName, attachments: links, updatedAt: now } },
    });
  },
  remove({ secId, date, key }) {
    return a.removeField(`homework/${secId}_${date}`, `subjects.${key}`, { upd: Date.now() });
  },
  async mkcfg(secId, force) {
    const s = await getFresh('mkcfg/' + secId, 30 * MIN, force);
    return s.data || null;
  },
  async sheet(path, force) {
    const s = await getFresh(path, 2 * MIN, force);
    return s.data && s.data.m && typeof s.data.m === 'object' ? s.data : { m: {} };
  },
};

/// "5TH-A" -> "5TH - A"
const sectionText = (id) => { const i = id.lastIndexOf('-'); return i <= 0 ? id : `${id.slice(0, i)} - ${id.slice(i + 1)}`; };
const sectionShort = (id) => { const i = id.lastIndexOf('-'); const c = (i <= 0 ? id : id.slice(0, i)).replace(/(ST|ND|RD|TH)$/i, ''); return (c.length > 4 ? c.slice(0, 3) : c) + (i > 0 ? id.slice(i + 1) : ''); };

// ------------------------------------------------------------------ auth gate
let gate = 0, loginMsg = null;
a.onAuth(async (u) => {
  const v = ++gate;
  dropAllLayers();
  if (!u) return showLogin();
  mount(h('div', { class: 'page' }, h('div', { class: 'center-fill' }, spinner())));
  try {
    const c = await claims(false);
    if (v !== gate) return;
    if (c.role !== 't') { loginMsg = 'This is not a teacher login.'; await a.signOut(); return; }
    showHome();   // the password is always the mobile number (school rule): no new-password screen
  } catch { if (v === gate) showHome(); }
});
function mount(el) { clear(root).append(el); }
async function logout(silent) {
  if (!silent) {
    const ok = await dialog({ icon: 'logout', title: 'Log out?', text: 'You will need your username and password to log in again.',
      actions: [{ label: 'Cancel', value: false }, { label: 'Logout', value: true, kind: 'filled' }] });
    if (!ok) return;
  }
  await a.signOut();
}

// ------------------------------------------------------------------ login
function showLogin() {
  const err = h('div', { class: 'login-err', role: 'alert', hidden: true });
  const showErr = (m) => { err.hidden = !m; clear(err).append(icon('error'), h('span', null, m || '')); };
  const fU = field({ label: 'Username', lead: 'person', helper: 'e.g. ravi.kumar', autocomplete: 'username', name: 'username', onenter: () => fP.input.focus() });
  const fP = field({ label: 'Password', type: 'password', lead: 'lock', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'current-password', name: 'password', onenter: () => go() });
  fU.input.value = Prefs.get('lastUser') || '';
  const go = async () => {
    const user = fU.input.value.trim().toLowerCase(), pw = fP.input.value;
    showErr(null);
    if (!user || !pw) return showErr('Enter both username and password');
    if (user.includes('/')) return showErr('Username is not valid');
    setBusy(b, true);
    try {
      let idx;
      try { idx = await a.getServer('tLogin/' + user); } catch { throw new Error('No internet connection. Please try again.'); }
      const uid = idx.data?.t;
      if (!idx.exists || !uid) throw new Error('This username was not found. Please check it or contact the office.');
      Prefs.set('lastUser', user);
      try { await a.signIn(`${uid}@${DOMAIN}`, pw); } catch (e) { throw new Error(loginErrorText(e.code, 't')); }
    } catch (e) { showErr(e.message); setBusy(b, false); }
  };
  const b = btn('filled', 'Login', go, { class: 'btn-big btn-block' });
  if (loginMsg) { showErr(loginMsg); loginMsg = null; }
  mount(h('div', { class: 'page' }, h('div', { class: 'chooser-top' }, themeBtn()), h('div', { class: 'login' },
    h('div', { class: 'login-hero' }, brandMark('co_present'), h('h1', null, CFG.schoolName || 'Teacher Login'),
      h('div', { class: 'login-kicker' }, 'Teacher App'), h('p', null, 'Your EduNest username and password')),
    h('form', { class: 'login-form', onsubmit: (e) => { e.preventDefault(); go(); } }, err, fU, fP, b),
    h('div', { class: 'login-tip' }, 'Homework and notices you post here show up in the Parent App of your classes right away.'),
    demoBanner(), installCard())));
}

// ------------------------------------------------------------------ notices
const MAX_MY_NOTICES = 20;
const NRepo = {
  async board(force) {
    const out = [];
    try { const b = await getFresh('notices/board', 30 * MIN, force); out.push(...(Array.isArray(b.data?.list) ? b.data.list : [])); } catch { /* none yet */ }
    try { const p = await getFresh('notices/principal', 60 * MIN, force); out.push(...(Array.isArray(p.data?.list) ? p.data.list : []).map((n) => ({ ...n, prin: true }))); } catch { /* none */ }
    return out;
  },
  /// Principal: the school-wide list typed in the app (notices/principal)
  async savePrincipal(mutate) {
    const cur = await a.getServer('notices/principal').catch(() => ({ data: null }));
    const today = istDay(0);
    const list = mutate((Array.isArray(cur.data?.list) ? cur.data.list : []).filter((x) => !x.exp || x.exp >= today)).slice(0, 30);
    await a.setMerge('notices/principal', { list, upd: Date.now() });
  },
  async sec(secId, force) {
    try { const s = await getFresh('tnotice/' + secId, 30 * MIN, force); return s.data?.n && typeof s.data.n === 'object' ? s.data.n : {}; } catch { return {}; }
  },
  /// write this teacher's list of one section (rules: a teacher changes only n.<own uid>, only in own sections)
  async saveMine(t, secId, mutate) {
    const uid = a.user()?.uid;
    const cur = await a.getServer('tnotice/' + secId).catch(() => ({ data: null }));
    const mine = Array.isArray(cur.data?.n?.[uid]?.list) ? cur.data.n[uid].list : [];
    const today = istDay(0);
    const list = mutate(mine.filter((x) => !x.exp || x.exp >= today)).slice(0, MAX_MY_NOTICES);
    await a.setMerge('tnotice/' + secId, { secId, upd: Date.now(), n: { [uid]: { name: t.name, list } } });
  },
};
async function loadNotices(t, force) {
  const today = istDay(0), out = [];
  for (const n of await NRepo.board(force)) {
    if (!n || (n.aud && n.aud !== 'all' && n.aud !== 't')) continue;
    const secs = Array.isArray(n.secs) ? n.secs.map(String) : [];
    if (secs.length && !secs.some((x) => t.sections.includes(x))) continue;
    out.push({ ...n, secs, src: 'school', mine: !!(n.prin && n.uid === a.user()?.uid), prin: !!n.prin });
  }
  const uid = a.user()?.uid;
  await Promise.all(t.sections.map(async (sec) => {
    for (const [u, v] of Object.entries(await NRepo.sec(sec, force))) {
      for (const n of (Array.isArray(v?.list) ? v.list : [])) out.push({ ...n, secs: [sec], src: 'class', by: String(v.name || ''), mine: u === uid });
    }
  }));
  // one notice posted to several sections shows once
  const merged = new Map();
  for (const n of out.filter((x) => (x.t || x.b) && (!x.exp || x.exp >= today))) {
    const k = n.src + (n.src === 'class' ? n.id + (n.by || '') : n.id);
    if (merged.has(k)) merged.get(k).secs.push(...n.secs); else merged.set(k, { ...n, secs: [...n.secs] });
  }
  return [...merged.values()].sort((x, y) => (!!y.pin - !!x.pin) || String(y.date).localeCompare(String(x.date)) || ((y.ts || 0) - (x.ts || 0)));
}
function tNoticeWallet(n) {
  const kind = n.pin ? 'pin' : n.src === 'class' ? 'cls' : 'sch';
  return h('div', { class: 'ncard ' + kind },
    h('div', { class: 'holo' }),
    h('div', { class: 'top' }, n.src === 'class' ? 'Class ' + n.secs.map(sectionText).join(', ') : 'School announcement', h('span', null, n.pin ? 'Pinned' : niceDate(n.date))),
    h('div', { class: 'nt' }, n.t || 'Notice'), n.b ? h('div', { class: 'nb' }, n.b) : null,
    h('div', { class: 'bot' }, h('span', null, n.mine ? 'Posted by you' : n.by ? 'From ' + n.by : ''), n.exp ? h('span', null, 'Until ' + shortDate(n.exp)) : null));
}
function tNoticeCard(n, onDelete) {
  return h('div', { class: 'notice' + (n.pin ? ' pin' : '') },
    h('div', { class: 'nk' }, n.pin ? h('span', { class: 'src pinned' }, 'Pinned') : null,
      h('span', { class: 'src' + (n.src === 'class' ? ' cls' : '') }, n.src === 'class' ? 'Class ' + n.secs.map(sectionText).join(', ') : 'School'),
      n.date ? niceDate(n.date) : null),
    h('h3', null, n.t || 'Notice'), n.b ? h('p', null, n.b) : null,
    h('div', { class: 'nf' }, h('span', null, n.mine ? 'Posted by you' : n.by ? 'From ' + n.by : ''),
      h('span', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, n.exp ? 'Until ' + shortDate(n.exp) : null,
        n.mine && onDelete ? iconBtn('delete', () => onDelete(n), 'Delete notice') : null)));
}
/// New notice: goes ONLY to the sections ticked here (and only sections this teacher teaches; the Firestore rules check it too).
function postSheet(t, done) {
  const SCHOOL = '*school*';
  const picked = new Set(t.principal ? [SCHOOL] : t.ct ? [t.ct] : t.sections.slice(0, 1));
  const err = h('div', { class: 'login-err', role: 'alert', hidden: true });
  const showErr = (m) => { err.hidden = !m; clear(err).append(icon('error'), h('span', null, m || '')); };
  const fT = field({ label: 'Title', maxlength: 140, autocapitalize: 'sentences' });
  const fB = field({ label: 'Message', multiline: true, rows: 4, maxlength: 2000, helper: 'Only the parents of the classes you tick will see it' });
  const fE = field({ label: 'Show until (optional)', type: 'date' });
  fE.input.min = istDay(0);
  const secRow = h('div', { class: 'post-secs' });
  const drawSecs = () => {
    clear(secRow);
    if (t.principal) secRow.append(ripple(h('button', { class: 'chip', type: 'button', 'aria-pressed': String(picked.has(SCHOOL)),
      onclick: () => { if (picked.has(SCHOOL)) picked.delete(SCHOOL); else { picked.clear(); picked.add(SCHOOL); } drawSecs(); } },
    picked.has(SCHOOL) ? icon('check') : null, h('span', null, 'Whole school (all parents and teachers)'))));
    if (picked.has(SCHOOL)) return;
    t.sections.forEach((sec) => secRow.append(ripple(h('button', { class: 'chip', type: 'button', 'aria-pressed': String(picked.has(sec)),
      onclick: () => { if (picked.has(sec)) picked.delete(sec); else picked.add(sec); drawSecs(); } },
    picked.has(sec) ? icon('check') : null, h('span', null, sectionText(sec) + (sec === t.ct ? ' (my class)' : ''))))));
  };
  drawSecs();
  const bPost = btn('filled', 'Post notice', async () => {
    const title = fT.input.value.trim(), body = fB.input.value.trim(), exp = fE.input.value;
    if (!title) return showErr('Write a title');
    if (!picked.size) return showErr('Tick at least one class');
    showErr(null); setBusy(bPost, true);
    const n = { id: 'n' + Date.now().toString(36), t: title, b: body, date: istDay(0), exp: exp || '', ts: Date.now() };
    try {
      if (picked.has(SCHOOL)) await NRepo.savePrincipal((list) => [{ ...n, aud: 'all', by: t.name, uid: a.user()?.uid }, ...list]);
      else for (const sec of picked) await NRepo.saveMine(t, sec, (list) => [n, ...list]);
      done('posted');
    } catch (e) { showErr(errorText(e)); setBusy(bPost, false); }
  }, { icon: 'send', class: 'btn-big' });
  setTimeout(() => fT.input.focus(), 320);
  return h('div', null,
    h('h3', null, 'Post a notice'), h('div', { class: 'sub' }, t.principal ? 'Whole school, or only the classes you tick.' : 'Parents of the ticked classes see it on their app home screen.'),
    h('div', { class: 'section-label', style: { width: '100%', margin: '6px 0' } }, 'Send to'), secRow,
    fT, fB, fE, err, h('div', { class: 'sheet-actions' }, h('span', { class: 'grow' }), bPost));
}

// ------------------------------------------------------------------ home: Dashboard, Homework, Marks, Notices
const TTABS = [
  { id: 'home', label: 'Dashboard', icon: 'space_dashboard' },
  { id: 'hw', label: 'Homework', icon: 'menu_book' },
  { id: 'marks', label: 'Marks', icon: 'edit_note' },
];
function showHome() {
  Prefs.remove('ttab');
  const st = { t: null, err: null, loading: true, daysAgo: 0, tab: 'home', notices: null, today: null };
  const main = h('main', { class: 'content' });
  const refBtn = iconBtn('refresh', async () => {
    refBtn.classList.add('spinning');
    snackbar('Refreshing data...');
    try {
      await load(true);
      snackbar('App is up to date');
    } catch {
      snackbar('Could not update');
    } finally {
      refBtn.classList.remove('spinning');
    }
  }, 'Refresh', 'glassy');
  const bar = topBar({ title: '', actions: [refBtn, themeBtn(), iconBtn('logout', () => logout(), 'Logout', 'glassy')] });
  bar.querySelector('.topbar-actions').style.gap = '8px';
  const nav = h('nav', { class: 'navbar', role: 'tablist' });
  const page = h('div', { class: 'page has-nav' }, bar, main, nav);
  watchScroll(main, bar);
  pullToRefresh(main, () => load(true));
  mount(page);
  const go = (id) => { st.tab = id; render(true); };

  async function load(force) {
    st.err = null;
    try {
      if (force) await claims(true);   // new sections from the school come with a fresh login token
      st.t = await Repo.me(force);
      if (st.t) st.t.principal = (await claims(false)).principal;
    } catch (e) { st.err = e; }
    st.loading = false;
    render();
    if (st.t) {
      loadNotices(st.t, force).then((n) => { st.notices = n; if (st.tab !== 'hw' && st.tab !== 'marks') render(); });
      Promise.all(st.t.sections.map((sec) => Repo.day(sec, istDay(0), force).then((d) => [sec, d]).catch(() => [sec, null])))
        .then((r) => { st.today = new Map(r); if (st.tab === 'home') render(); });
    }
  }
  const dayLabel = (i) => i === 0 ? 'Today' : i === 1 ? 'Yesterday' : weekDay(istDay(i));

  function renderBar() {
    const title = bar.querySelector('.topbar-title');
    clear(title);
    const t = st.t;
    title.append(h('div', { class: 'app-head' },
      h('div', { class: 'school-id' }, schoolBadge(), h('div', { class: 'school-txt' }, h('b', null, CFG.schoolName || 'School'), h('span', null, 'Teacher Portal'))),
      t ? h('div', { class: 'kid-switch', style: { cursor: 'default' } }, avatarLetter(t.name, 'sm'),
        h('span', { class: 't' }, h('span', { class: 'n' }, t.name.split(/\s+/)[0]), h('span', { class: 'c' }, t.ct ? 'Class ' + t.ct : `${t.sections.length} classes`))) : null));
  }
  function renderNav() {
    clear(nav);
    nav.hidden = !st.t;
    for (const x of TTABS) {
      const on = x.id === st.tab;
      nav.append(h('button', { class: 'nav-item', role: 'tab', type: 'button', 'aria-selected': String(on), onclick: () => { if (!on) go(x.id); } },
        h('span', { class: 'nav-pill' }, icon(on ? x.icon + '-fill' : x.icon)), x.label));
    }
  }
  const secItem = (t, sec, onclick, extra) => {
    const ct = sec === t.ct, subs = t.allowed(sec).map(t.nameOf).join(', ');
    return ripple(h('button', { class: 'li tap', type: 'button', onclick },
      h('div', { class: 'sec-lead' + (ct ? ' ct' : '') }, sectionShort(sec), ct ? h('span', { class: 'star' }, icon('star-fill')) : null),
      h('div', { class: 'li-body' }, h('div', { class: 'li-title' }, sectionText(sec)),
        h('div', { class: 'li-sub' }, [ct ? 'Class teacher' : '', subs, extra].filter(Boolean).join('  ·  '))),
      h('div', { class: 'li-trail' }, icon('chevron_right'))));
  };

  function render(toTop) {
    renderBar(); renderNav();
    const t = st.t;
    clear(main);
    if (toTop) main.scrollTop = 0;
    let body;
    if (st.loading) body = skeleton(4);
    else if (!t) body = messageBox(st.err ? 'wifi_off' : 'person_off', st.err ? errorText(st.err) : 'Your record has not arrived from the school yet. Pull down to check again in a while.', () => { st.loading = true; render(); load(true); });
    else if (!t.sections.length && !t.principal) body = messageBox('groups', 'No section or subject is assigned to you. Ask the office to set your subjects or class in EduNest (Setup > Teachers).');
    else if (st.tab === 'hw') body = hwTab(t);
    else if (st.tab === 'marks') body = marksTab(t);
    else body = homeTab(t);
    main.append(h('div', { class: 'fade-in' }, demoBanner(), body));
  }

  function homeTab(t) {
    const posted = st.today ? t.sections.reduce((n, sec) => n + t.allowed(sec).filter((k) => st.today.get(sec)?.items.some((x) => x.key === k)).length, 0) : null;
    const total = t.sections.reduce((n, sec) => n + t.allowed(sec).length, 0);
    const ns = st.notices || [];
    const widget = (onclick, cic, ic, badge, badgeCls, lbl, val, sub, small) => ripple(h('button', { class: 'widget', type: 'button', onclick },
      h('div', { class: 'wtop' }, h('div', { class: 'wicon ' + cic }, icon(ic)), h('span', { class: 'wbadge ' + badgeCls }, badge)),
      h('div', null, h('div', { class: 'wlbl' }, lbl), h('div', { class: 'wval' + (small ? ' sm' : '') }, val), h('div', { class: 'wsub' }, sub))));
    return h('div', null,
      h('div', { class: 'greet2' }, h('div', null, h('small', null, todayLong()), h('h1', null, `${greeting()}, ${t.name.split(/\s+/)[0] || 'Teacher'}`))),
      (() => {
        const rank = (n) => (n.pin ? 0 : n.date === istDay(0) ? 1 : 2);
        const sort = (L) => [...L].sort((x, y) => rank(x) - rank(y) || String(y.date).localeCompare(String(x.date)));
        const row = (L) => {
          if (!L.length) return null;
          const dots = L.length > 1 ? h('div', { class: 'ndots' }, L.map((_, i) => h('i', { class: i ? '' : 'on', 'aria-label': `Go to notice ${i + 1}` }))) : null;
          const strip = h('div', { class: 'nrow' + (L.length > 1 ? '' : ' one') }, L.map(tNoticeWallet));
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
        return school || cls ? h('div', null, h('div', { class: 'section-label' }, 'Notices'), school, cls) : null; })(),
      h('div', { class: 'wgrid' },
        widget(() => go('hw'), 'c-blue', 'menu_book', posted === null ? '' : `${posted}/${total}`, posted !== null && posted >= total ? 't-green' : 't-blue', 'Homework today',
          posted === null ? '…' : posted >= total ? 'All posted' : `${total - posted} to post`, 'Tap to post homework', true),
        widget(() => go('marks'), 'c-indigo', 'edit_note', '', '', 'Exam marks', `${t.sections.filter((sec) => t.allowed(sec).length).length} classes`, 'Enter marks for EduNest', true),
        widget(() => noticesPage(t), 'c-purple', 'campaign', ns.length ? `${ns.length}` : '', 't-purple', 'Notices', ns.length ? ns[0].t || 'Notice' : 'No notices', 'Tap to see all', true),
        widget(() => sheet((done) => postSheet(t, done)).then((r) => { if (r) { snackbar('Notice posted'); load(true); } }),
          'c-green', 'send', 'New', 't-green', 'Post a notice', 'To my classes', 'Parents see it at once', true)),

      h('div', { class: 'section-label' }, 'My classes'),
      h('div', { class: 'list' }, t.sections.map((sec) => {
        const d = st.today?.get(sec), mine = t.allowed(sec), n = d ? mine.filter((k) => d.items.some((x) => x.key === k)).length : null;
        return secItem(t, sec, () => openSection(t, sec, istDay(0)), n === null ? '' : `homework ${n}/${mine.length}`);
      })));
  }
  function hwTab(t) {
    const date = istDay(st.daysAgo);
    return h('div', null,
      h('div', { class: 'greet2' }, h('div', null, h('small', null, 'Post for your classes'), h('h1', null, 'Homework'))),
      h('div', { class: 'section-label', style: { marginTop: '0' } }, 'Homework date'),
      h('div', { class: 'chips daychips', role: 'group', style: { width: 'calc(100% - 32px)', margin: '0 auto' } }, Array.from({ length: EDIT_DAYS_BACK + 1 }, (_, i) => ripple(h('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(st.daysAgo === i), onclick: () => { st.daysAgo = i; render(); },
      }, h('span', null, dayLabel(i)), h('small', null, dayMon(istDay(i))))))),
      h('div', { class: 'section-label' }, niceDate(date)),
      h('div', { class: 'list' }, t.sections.map((sec) => secItem(t, sec, () => openSection(t, sec, date)))));
  }
  function marksTab(t) {
    const secs = t.sections.filter((sec) => t.allowed(sec).length);
    return h('div', null,
      h('div', { class: 'greet2' }, h('div', null, h('small', null, 'Goes into EduNest Mark Entry'), h('h1', null, 'Exam marks'))),
      h('div', { class: 'section-label', style: { marginTop: '0' } }, 'Enter marks for'),
      secs.length ? h('div', { class: 'list' }, secs.map((sec) => secItem(t, sec, () => openMarks(t, sec)))) : messageBox('groups', 'No subject is assigned to you.'));
  }
  function noticesPage(t) {
    const box = h('div', { style: { paddingTop: '8px' } });
    pushPage('Notices', box);
    const draw = () => { clear(box).append(noticesTab(t)); };
    draw();
    const again = () => loadNotices(t, true).then((n) => { st.notices = n; draw(); render(); });
    box.addEventListener('notice-changed', again);
  }
  function noticesTab(t) {
    const del = async (n) => {
      const ok = await dialog({ icon: 'delete', title: 'Delete notice?', text: `"${n.t}" will be removed from the Parent App${n.prin ? ' of the whole school' : ' of ' + n.secs.map(sectionText).join(', ')}.`,
        actions: [{ label: 'Cancel', value: false }, { label: 'Delete', value: true, kind: 'filled' }] });
      if (!ok) return;
      try { if (n.prin) await NRepo.savePrincipal((list) => list.filter((x) => x.id !== n.id)); else for (const sec of n.secs) await NRepo.saveMine(t, sec, (list) => list.filter((x) => x.id !== n.id)); snackbar('Notice deleted'); document.querySelector('.page.pushed .content > div')?.dispatchEvent(new Event('notice-changed')); } catch (e) { snackbar(errorText(e)); }
    };
    const ns = st.notices;
    return h('div', null,
      h('div', { class: 'greet2' }, h('div', null, h('small', null, 'School and class notices')),
        btn('filled', 'Post', () => sheet((done) => postSheet(t, done)).then((r) => { if (r) { snackbar('Notice posted'); document.querySelector('.page.pushed .content > div')?.dispatchEvent(new Event('notice-changed')); } }), { icon: 'add' })),
      ns === null ? skeleton(3) : ns.length ? ns.map((n) => tNoticeCard(n, del))
        : messageBox('campaign', 'No notices yet. Tap Post to send a notice to the parents of your classes.'));
  }

  render();
  load(false);
}
function schoolBadge() {
  const box = h('div', { class: 'school-badge' });
  if (CFG.logo) {
    const img = h('img', { src: siteUrl(CFG.logo), alt: '' });
    img.addEventListener('error', () => img.replaceWith((CFG.schoolName || 'S').trim()[0]));
    box.append(img);
  } else box.append((CFG.schoolName || 'S').trim()[0]);
  return box;
}

// ------------------------------------------------------------------ one section, one day
function openSection(t, secId, date) {
  const wrap = h('div');
  const main = pushPage(sectionText(secId), wrap);
  main.previousSibling.querySelector('.topbar-title').append(h('small', null, niceDate(date)));
  let day = null, err = null;
  pullToRefresh(main, () => load(true));

  async function load(force) {
    try { day = await Repo.day(secId, date, force); err = null; } catch (e) { err = e; }
    render();
  }
  const item = (k) => day?.items.find((x) => x.key === k);

  function render() {
    clear(wrap);
    if (!day && !err) { wrap.append(skeleton(3)); return; }
    if (!day) { wrap.append(messageBox('wifi_off', errorText(err), () => { err = null; render(); load(true); })); return; }
    const mine = t.allowed(secId);
    const others = day.items.filter((x) => !mine.includes(x.key));
    const doneN = mine.filter((k) => item(k)).length;
    wrap.append(h('div', { class: 'fade-in' },
      demoBanner(),
      h('div', { class: 'section-label', style: { display: 'flex', alignItems: 'center', gap: '8px' } }, 'Your subjects',
        h('span', { class: 'pill' + (doneN === mine.length && mine.length ? ' ok' : '') }, `${doneN}/${mine.length} posted`)),
      mine.map((k) => {
        const it = item(k);
        return ripple(h('button', { class: 'subj' + (it ? '' : ' empty-s'), type: 'button', onclick: () => edit(k) },
          h('div', { class: 'hw-ic ' + hueClass(k) }, t.nameOf(k).slice(0, 2).toUpperCase()),
          h('div', { class: 'hw-body' },
            h('div', { class: 'hw-sub' }, t.nameOf(k)),
            it ? h('div', { class: 'li-sub clamp' }, it.text || '(attachment only)') : h('div', { class: 'li-sub' }, 'Nothing posted yet. Tap to write.'),
            it && it.att.length ? h('div', { style: { marginTop: '6px' } }, h('span', { class: 'pill' }, icon('attach_file'), `${it.att.length} ${it.att.length === 1 ? 'link' : 'links'}`)) : null),
          h('span', { class: 'act' }, icon(it ? 'edit' : 'add'))));
      }),
      others.length ? [h('div', { class: 'section-label' }, 'Other teachers\' homework'),
        others.map((x) => h('div', { class: 'hw' },
          h('div', { class: 'hw-ic ' + hueClass(x.key) }, x.subject.slice(0, 2).toUpperCase()),
          h('div', { class: 'hw-body' },
            h('div', { class: 'hw-top' }, h('span', { class: 'hw-sub' }, x.subject), x.teacher ? h('span', { class: 'hw-teacher' }, x.teacher) : null),
            x.text ? h('div', { class: 'hw-text' }, x.text) : null,
            x.att.length ? h('div', { style: { marginTop: '6px' } }, h('span', { class: 'pill' }, icon('attach_file'), `${x.att.length} ${x.att.length === 1 ? 'attachment' : 'attachments'}`)) : null)))] : null));
  }

  async function edit(k) {
    const saved = await sheet((done) => editSheet(t, secId, date, k, item(k), done));
    if (saved) { await load(true); snackbar(saved === 'removed' ? 'Homework removed' : 'Saved'); }
  }

  load(false);
}

/// Write / change / remove one subject's homework. Attachments are links (Google Drive, YouTube, website ...).
function editSheet(t, secId, date, key, current, done) {
  const links = [...(current?.att || [])];
  const err = h('div', { class: 'login-err', role: 'alert', hidden: true });
  const showErr = (m) => { err.hidden = !m; clear(err).append(icon('error'), h('span', null, m || '')); };
  const fText = field({ label: 'Homework', multiline: true, rows: 5, maxlength: MAX_TEXT, value: current?.text || '', helper: 'e.g. Page 45, do Q1 to Q5 in your notebook' });
  const fLink = field({ label: 'Add a link (optional)', type: 'url', inputmode: 'url', helper: 'Google Drive / YouTube link', onenter: () => addLink() });
  const linkList = h('div', { class: 'links-edit' });
  const drawLinks = () => {
    clear(linkList);
    links.forEach((u, i) => linkList.append(h('div', { class: 'li' }, icon('link'),
      h('a', { class: 'li-body', href: u, target: '_blank', rel: 'noopener noreferrer', style: { color: 'inherit', textDecoration: 'none' } }, h('div', { class: 'li-title' }, u)),
      iconBtn('close', () => { links.splice(i, 1); drawLinks(); }, 'Remove link'))));
  };
  function addLink() {
    let u = fLink.input.value.trim();
    if (!u) return true;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    let ok = false;
    try { ok = !!new URL(u).host && /\./.test(new URL(u).host); } catch { ok = false; }
    if (!ok) { showErr('This link is not valid'); return false; }
    if (links.length >= MAX_LINKS) { showErr(`At most ${MAX_LINKS} links`); return false; }
    links.push(u); fLink.input.value = ''; showErr(null); drawLinks();
    return true;
  }
  async function save() {
    if (!addLink()) return;
    const text = fText.input.value.trim();
    if (!text && !links.length) return showErr('Write the homework or add a link');
    if (text.length > MAX_TEXT) return showErr(`Too long (at most ${MAX_TEXT} characters)`);
    showErr(null); setBusy(bSave, true);
    try {
      await Repo.save({ secId, date, key, subjectName: t.nameOf(key), teacherName: t.name, text, links });
      done('saved');
    } catch (e) { showErr(errorText(e)); setBusy(bSave, false); }
  }
  async function remove() {
    const ok = await dialog({ icon: 'delete', title: 'Remove homework?', text: `${t.nameOf(key)} homework for this day will be removed from the Parent App.`,
      actions: [{ label: 'Cancel', value: false }, { label: 'Remove', value: true, kind: 'filled' }] });
    if (!ok) return;
    showErr(null); setBusy(bDel, true);
    try { await Repo.remove({ secId, date, key }); done('removed'); } catch (e) { showErr(errorText(e)); setBusy(bDel, false); }
  }
  const bSave = btn('filled', 'Save', save, { icon: 'check', class: 'btn-big' });
  const bDel = current ? btn('danger', 'Remove', remove, { icon: 'delete' }) : null;
  drawLinks();
  if (!current) setTimeout(() => fText.input.focus(), 320);
  return h('div', null,
    h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '20px' } },
      h('div', { class: 'hw-ic ' + hueClass(key), style: { width: '48px', height: '48px', borderRadius: '16px' } }, t.nameOf(key).slice(0, 2).toUpperCase()),
      h('div', null, h('h3', null, t.nameOf(key)), h('div', { class: 'sub', style: { margin: 0 } }, `${sectionText(secId)}  ·  ${niceDate(date)}`))),
    fText,
    h('div', { class: 'link-add' }, fLink, iconBtn('add_link', () => addLink(), 'Add link', 'tonal')),
    linkList, err,
    h('div', { class: 'sheet-actions' }, bDel, h('span', { class: 'grow' }), bSave));
}

// ------------------------------------------------------------------ exam marks: one section
const MK_RE = /^\d{1,3}(\.\d{1,2})?$/;
/// '' (no mark), 'AB', a number 0..max (2 decimals) or false (not valid)
function mkParse(text, max) {
  const v = String(text ?? '').trim().toUpperCase();
  if (v === '') return '';
  if (v === 'AB' || v === 'A') return 'AB';
  if (!MK_RE.test(v)) return false;
  const n = Number(v);
  return n >= 0 && n <= max ? n : false;
}
const mkShow = (v) => (v === undefined || v === null ? '' : String(v));

function openMarks(t, secId) {
  const wrap = h('div', { class: 'mk-page' });
  const main = pushPage('Marks · ' + sectionText(secId), wrap);
  const pref = (k) => Prefs.get(`mk:${secId}:${k}`), setPref = (k, v) => Prefs.set(`mk:${secId}:${k}`, v);
  const st = { cfg: null, err: null, term: pref('term'), code: pref('code'), subj: pref('subj'), sheet: null, sheetErr: null, rows: [], loadingSheet: false };
  pullToRefresh(main, () => load(true));

  const mine = t.allowed(secId);
  /// subjects of this section the teacher may write, with the max marks per assessment (a student's class / stream decides his subjects)
  const subjects = () => {
    const out = new Map();
    for (const subs of Object.values(st.cfg?.keys || {})) {
      for (const [k, x] of Object.entries(subs || {})) {
        if (!mine.includes(k)) continue;
        const o = out.get(k) || { key: k, name: x.n || t.nameOf(k), mx: {} };
        for (const [c, m] of Object.entries(x.mx || {})) o.mx[c] = Math.max(o.mx[c] || 0, Number(m) || 0);
        out.set(k, o);
      }
    }
    return [...out.values()].sort((p, q) => p.name.localeCompare(q.name));
  };
  const terms = () => (st.cfg?.terms || []).filter((x) => (x.c || []).some((c) => subjects().some((s) => s.mx[c])));
  const codes = () => ((st.cfg?.terms || []).find((x) => x.id === st.term)?.c || []).filter((c) => subjects().some((s) => s.mx[c]));
  const subsFor = () => subjects().filter((s) => s.mx[st.code]);
  const asName = (c) => st.cfg?.as?.[c] || c;
  /// A row's current value. A locked row (a mark already saved, not unlocked by the school) can't change: it always counts as its saved value.
  const val = (r) => (r.locked ? r.orig : mkParse(r.input.value, r.max));
  const dirty = () => st.rows.filter((r) => !r.locked && val(r) !== r.orig).length;

  function fix() {
    const T = terms();
    if (!T.some((x) => x.id === st.term)) st.term = T[0]?.id || '';
    const C = codes();
    if (!C.includes(st.code)) st.code = C[0] || '';
    const S = subsFor();
    if (!S.some((x) => x.key === st.subj)) st.subj = S[0]?.key || '';
    setPref('term', st.term); setPref('code', st.code); setPref('subj', st.subj);
  }
  /// permission-denied usually means the phone still has an OLD login token (the school added this class after the teacher logged in):
  /// fetch a fresh token (new class list) and try once more, so the teacher does not have to log out and in.
  const withFreshToken = async (fn) => {
    try { return await fn(); } catch (e) {
      if (!String((e && (e.code || e.message)) || e).includes('permission-denied')) throw e;
      try { await claims(true); } catch { throw e; }
      return fn();
    }
  };
  async function load(force) {
    try { st.cfg = await withFreshToken(() => Repo.mkcfg(secId, force)); st.err = null; } catch (e) { st.err = e; }
    if (st.cfg) fix();
    render();
    if (st.cfg && st.subj) await loadSheet(force);
  }
  const path = () => sheetPath(secId, st.cfg.session, st.term, st.code, st.subj);
  async function loadSheet(force) {
    st.loadingSheet = true; st.sheet = null; st.sheetErr = null; renderSheet();
    try { st.sheet = await withFreshToken(() => Repo.sheet(path(), force)); } catch (e) { st.sheetErr = e; }
    st.loadingSheet = false; renderSheet();
  }
  async function pick(kind, v) {
    if (st[kind] === v) return;
    if (dirty()) {
      const ok = await dialog({ icon: 'error', title: 'Marks not saved', text: 'The marks you typed on this sheet are not saved yet. Leave them?',
        actions: [{ label: 'Stay', value: false }, { label: 'Leave', value: true, kind: 'filled' }] });
      if (!ok) return;
    }
    st[kind] = v; fix(); render(); loadSheet(false);
  }

  const sheetBox = h('div');
  function render() {
    clear(wrap);
    if (!st.cfg && !st.err) { wrap.append(skeleton(4)); return; }
    if (!st.cfg) {
      wrap.append(st.err ? messageBox('wifi_off', errorText(st.err), () => { st.err = null; render(); load(true); })
        : messageBox('history', 'The marks list of this class has not come from EduNest yet. Ask the office to open EduNest once, then pull down to refresh.'));
      return;
    }
    if (!subjects().length) { wrap.append(messageBox('info', 'No exam marks are set for your subjects in this class (EduNest: Academics Setup).')); return; }
    const chipRow = (label, items, cur, kind) => [h('div', { class: 'section-label' }, label),
      h('div', { class: 'chips', role: 'group' }, items.map(([v, text]) => ripple(h('button', { class: 'chip', type: 'button', 'aria-pressed': String(v === cur), onclick: () => pick(kind, v) }, h('span', null, text)))))];
    wrap.append(h('div', { class: 'fade-in' }, demoBanner(),
      chipRow('Term', terms().map((x) => [x.id, x.n || x.id]), st.term, 'term'),
      chipRow('Assessment', codes().map((c) => [c, asName(c)]), st.code, 'code'),
      chipRow('Subject', subsFor().map((x) => [x.key, x.name]), st.subj, 'subj'),
      sheetBox));
    renderSheet();
  }

  function renderSheet() {
    clear(sheetBox);
    if (!st.cfg || !st.subj) return;
    if (st.loadingSheet) { sheetBox.append(skeleton(5)); return; }
    if (st.sheetErr) { sheetBox.append(messageBox('wifi_off', errorText(st.sheetErr), () => loadSheet(true))); return; }
    const keys = st.cfg.keys || {};
    const max = Number(keys && Object.values(keys).map((s) => s?.[st.subj]?.mx?.[st.code]).find((m) => m)) || 0;
    const studs = (st.cfg.st || []).filter((x) => Number(keys[x.k]?.[st.subj]?.mx?.[st.code]) > 0)
      .sort((p, q) => (Number(p.r) || 9999) - (Number(q.r) || 9999) || String(p.n).localeCompare(String(q.n)));
    const m = st.sheet?.m || {};
    const ul = st.sheet?.ul && typeof st.sheet.ul === 'object' ? st.sheet.ul : {};
    const seeAll = !!t.sf;
    const count = h('span', { class: 'pill' });
    const saveBar = h('div', { class: 'mk-save' });
    const upd = () => {
      const filled = st.rows.filter((r) => val(r) !== '').length, d = dirty();
      clear(count).append(`${filled}/${st.rows.length} entered`);
      count.className = 'pill' + (filled === st.rows.length && st.rows.length ? ' ok' : '');
      bSave.disabled = !d || st.rows.some((r) => val(r) === false);
      clear(bSaveLabel).append(d ? `Save ${d} ${d === 1 ? 'change' : 'changes'}` : 'Saved');
    };
    st.rows = studs.map((x) => {
      const mx = Number(keys[x.k][st.subj].mx[st.code]) || max;
      const orig = m[x.a] === undefined ? '' : (String(m[x.a]).toUpperCase() === 'AB' ? 'AB' : Number(m[x.a]));
      const locked = orig !== '' && ul[x.a] !== true;
      const input = h('input', { class: 'mk-in', type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'next', value: locked && !seeAll ? '' : mkShow(orig), placeholder: locked && !seeAll ? '🔒' : '', 'aria-label': `${x.n} marks out of ${mx}` });
      const ab = h('button', { class: 'mk-ab', type: 'button', 'aria-label': 'Absent', title: 'Absent' }, 'AB');
      const row = h('div', { class: 'mk-row' }, h('div', { class: 'mk-roll' }, x.r || ''), h('div', { class: 'mk-name' }, h('b', null, x.n), h('small', null, 'Adm ' + x.a)), input, ab);
      const r = { adm: x.a, max: mx, orig, input, row, locked };
      r.lock = (on) => {
        r.locked = on; input.disabled = on; ab.disabled = on;
        row.classList.toggle('lk', on); row.classList.toggle('ul', !on && r.orig !== '' && ul[x.a] === true);
        if (on) { input.value = seeAll ? mkShow(r.orig) : ''; input.placeholder = seeAll ? '' : '🔒'; row.classList.remove('chg', 'bad'); ab.classList.toggle('on', seeAll && r.orig === 'AB'); }
      };
      r.lock(locked);
      const check = () => {
        if (r.locked) { upd(); return; }
        const v = mkParse(input.value, mx);
        row.classList.toggle('bad', v === false); row.classList.toggle('chg', v !== false && v !== orig); ab.classList.toggle('on', v === 'AB'); upd();
      };
      input.addEventListener('input', check);
      input.addEventListener('focus', () => {
        setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const i = st.rows.indexOf(r);
          const next = st.rows.slice(i + 1).find((q) => !q.locked)?.input || input;
          next.focus();
          try { next.select(); } catch {}
          setTimeout(() => next.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
        }
      });
      ab.addEventListener('click', () => { input.value = mkParse(input.value, mx) === 'AB' ? '' : 'AB'; check(); });
      setTimeout(check, 0);
      return r;
    });
    const bSave = btn('filled', 'Saved', () => save(), { icon: 'check', class: 'btn-big mk-btn', disabled: true });
    const bSaveLabel = bSave.querySelector('.btn-label');
    async function save() {
      const cells = {}, relock = [];
      for (const r of st.rows) {
        if (r.locked) continue;
        const v = mkParse(r.input.value, r.max);
        if (v === false) { r.input.focus(); return snackbar(`Marks must be 0 to ${r.max} or AB`); }
        if (v !== r.orig) { cells[r.adm] = v === '' ? null : v; if (ul[r.adm] === true) relock.push(r.adm); }
      }
      if (!Object.keys(cells).length) return;
      setBusy(bSave, true);
      try {
        await a.saveCells(path(), { secId, session: st.cfg.session, term: st.term, code: st.code, subj: st.subj }, cells, t.name, relock);
        if (st.sheet) { st.sheet.m = { ...(st.sheet.m || {}) }; for (const k of Object.keys(cells)) { if (cells[k] === null) delete st.sheet.m[k]; else st.sheet.m[k] = cells[k]; } }
        for (const k of relock) delete ul[k];
        for (const r of st.rows) {
          if (r.adm in cells) r.orig = cells[r.adm] === null ? '' : cells[r.adm];
          r.input.dispatchEvent(new Event('input'));
          if (relock.includes(r.adm) && r.orig !== '') r.lock(true);   // saved after an unlock: locked again
        }
        snackbar('Marks saved. They reach EduNest within a minute.');
      } catch (e) { snackbar(errorText(e)); }
      setBusy(bSave, false); upd();
    }
    const subName = subsFor().find((x) => x.key === st.subj)?.name || st.subj;
    const by = st.sheet?.by ? `Last saved by ${st.sheet.by}` : 'Nothing saved yet';
    sheetBox.append(
      h('div', { class: 'section-label', style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
        `${subName} · ${asName(st.code)} · Max ${max}`, count),
      h('div', { class: 'mk-help' }, `Type marks, or tap AB for absent. ${by}.${st.rows.some((r) => r.locked) ? ' 🔒 Marks already saved are locked — ask the school office to unlock one for a correction.' : ''}`),
      studs.length ? h('div', { class: 'mk-list' }, st.rows.map((r) => r.row)) : messageBox('groups', 'No student of this section has this subject.'),
      saveBar);
    saveBar.append(bSave);
    upd();
  }

  render();
  load(false);
}
