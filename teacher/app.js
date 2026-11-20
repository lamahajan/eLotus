// EduNest Teacher App (web / PWA). Same data and rules as the old Flutter app:
// one document per read; a save touches only this teacher's subject inside the section's day document (merge),
// so two teachers saving at the same time never overwrite each other.
import {
  CFG, DOMAIN, h, icon, clear, applyTheme, registerSW, api, getFresh, claims, needsNewPassword, changePassword, loginErrorText, errorText,
  Prefs, istDay, niceDate, shortDate, weekDay, dayMon, btn, iconBtn, setBusy, field, snackbar, dialog, sheet, pushPage, dropAllLayers, topBar,
  watchScroll, pullToRefresh, messageBox, skeleton, avatarLetter, hueClass, demoBanner, installCard, offlineChip, spinner, ripple, brandMark, brandDot,
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
  const t = { uid, name: String(d.name ?? ''), ct: String(d.ct ?? ''), secs, subj: strMap(d.subj), ctSubj: strMap(d.ctSubj) };
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
    const np = await needsNewPassword().catch(() => false);
    if (v !== gate) return;
    np ? showNewPassword() : showHome();
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
  const fP = field({ label: 'Password', type: 'password', lead: 'lock', helper: 'First time: your mobile number (10 digits)', autocomplete: 'current-password', name: 'password', onenter: () => go() });
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
      if (!idx.exists || !uid) throw new Error('This username was not found. Your login and mobile number must be set in EduNest. Please contact the office.');
      Prefs.set('lastUser', user);
      try { await a.signIn(`${uid}@${DOMAIN}`, pw); } catch (e) { throw new Error(loginErrorText(e.code, 't')); }
    } catch (e) { showErr(e.message); setBusy(b, false); }
  };
  const b = btn('filled', 'Login', go, { class: 'btn-big btn-block' });
  if (loginMsg) { showErr(loginMsg); loginMsg = null; }
  mount(h('div', { class: 'page' }, h('div', { class: 'login' },
    h('div', { class: 'login-hero' }, brandMark('co_present'), h('h1', null, CFG.schoolName || 'Teacher Login'),
      h('div', { class: 'login-kicker' }, 'Teacher App'), h('p', null, 'Your EduNest username and password')),
    h('form', { class: 'login-form', onsubmit: (e) => { e.preventDefault(); go(); } }, err, fU, fP, b),
    h('div', { class: 'login-tip' }, 'Homework you post here shows up in the Parent App right away.'),
    demoBanner(), installCard())));
}

// ------------------------------------------------------------------ first login: choose a password
function showNewPassword() {
  let askCurrent = false;
  const err = h('div', { class: 'login-err', role: 'alert', hidden: true });
  const showErr = (m) => { err.hidden = !m; clear(err).append(icon('error'), h('span', null, m || '')); };
  const fCur = field({ label: 'Current password (mobile number)', type: 'password', autocomplete: 'current-password' });
  const fA = field({ label: 'New password', type: 'password', autocomplete: 'new-password' });
  const fB = field({ label: 'Confirm new password', type: 'password', autocomplete: 'new-password', onenter: () => save() });
  fCur.hidden = true;
  const save = async () => {
    const p1 = fA.input.value, p2 = fB.input.value;
    if (p1 !== p2) return showErr('The two passwords do not match');
    if (p1.length < 6) return showErr('Password must be at least 6 characters');
    if (/^\d{10}$/.test(p1)) return showErr('Do not use a mobile number as your password, choose something else');
    showErr(null);
    setBusy(b, true);
    try {
      await changePassword(p1, askCurrent ? fCur.input.value : null);
      snackbar('New password saved');
      showHome();
    } catch (e) {
      if (e.code === 'RECENT_LOGIN') { askCurrent = true; fCur.hidden = false; showErr('For security, also enter your current password (mobile number)'); }
      else showErr(e.message);
    } finally { setBusy(b, false); }
  };
  const b = btn('filled', 'Save', save, { class: 'btn-big btn-block', icon: 'check' });
  const main = h('main', { class: 'content' }, h('div', { class: 'wrap', style: { padding: '8px 20px' } },
    h('div', { class: 'empty-icon', style: { margin: '8px 0 20px', background: 'var(--primary-container)', color: 'var(--on-primary-container)' } }, icon('key')),
    h('p', { style: { color: 'var(--on-surface-variant)', margin: '0 0 24px' } }, 'Your password is currently your mobile number. Choose a new password; you will use it to log in from now on.'),
    err, fCur, fA, fB, b));
  const bar = topBar({ title: 'Create a new password', actions: [btn('text', 'Logout', () => logout(true))] });
  watchScroll(main, bar);
  mount(h('div', { class: 'page' }, bar, main));
}

// ------------------------------------------------------------------ home: pick a day and a section
function showHome() {
  const st = { t: null, err: null, loading: true, daysAgo: 0, counts: new Map() };
  const main = h('main', { class: 'content' });
  const bar = topBar({ title: h('span', { class: 'brand-title' }, brandDot(), h('span', null, 'Teacher App', CFG.schoolName ? h('small', null, CFG.schoolName) : null)), actions: [iconBtn('logout', () => logout(), 'Logout')] });
  const page = h('div', { class: 'page' }, bar, main);
  watchScroll(main, bar);
  pullToRefresh(main, () => load(true));
  mount(page);

  async function load(force) {
    st.err = null;
    try {
      if (force) await claims(true);   // new sections from the school come with a fresh login token
      st.t = await Repo.me(force);
    } catch (e) { st.err = e; }
    st.loading = false;
    render();
  }

  const dayLabel = (i) => i === 0 ? 'Today' : i === 1 ? 'Yesterday' : weekDay(istDay(i));

  function render() {
    const t = st.t;
    clear(main);
    let body;
    if (st.loading) body = skeleton(4);
    else if (!t) body = messageBox(st.err ? 'wifi_off' : 'person_off', st.err ? errorText(st.err) : 'Your record has not arrived from the school yet. Pull down to check again in a while.', () => { st.loading = true; render(); load(true); });
    else if (!t.sections.length) body = messageBox('groups', 'No section or subject is assigned to you. Ask the office to set your subjects or class in EduNest (Setup > Teachers).');
    else {
      const date = istDay(st.daysAgo);
      const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()));
      const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      body = h('div', null,
        h('div', { class: 'greet' }, h('p', null, hello + ','), h('h2', null, t.name || 'Teacher')),
        h('div', { class: 'section-label', style: { marginTop: '18px' } }, 'Homework date'),
        h('div', { class: 'chips daychips', role: 'group' }, Array.from({ length: EDIT_DAYS_BACK + 1 }, (_, i) => ripple(h('button', {
          class: 'chip', type: 'button', 'aria-pressed': String(st.daysAgo === i), onclick: () => { st.daysAgo = i; render(); },
        }, h('span', null, dayLabel(i)), h('small', null, dayMon(istDay(i))))))),
        h('div', { class: 'section-label' }, niceDate(date)),
        h('div', { class: 'list' }, t.sections.map((sec) => {
          const ct = sec === t.ct, subs = t.allowed(sec).map(t.nameOf).join(', ');
          return ripple(h('button', { class: 'li tap', type: 'button', onclick: () => openSection(t, sec, date, render) },
            h('div', { class: 'sec-lead' + (ct ? ' ct' : '') }, sectionShort(sec), ct ? h('span', { class: 'star' }, icon('star-fill')) : null),
            h('div', { class: 'li-body' }, h('div', { class: 'li-title' }, sectionText(sec)),
              h('div', { class: 'li-sub' }, [ct ? 'Class teacher' : '', subs].filter(Boolean).join('  ·  '))),
            h('div', { class: 'li-trail' }, icon('chevron_right'))));
        })));
    }
    main.append(h('div', { class: 'fade-in' }, demoBanner(), body));
  }

  render();
  load(false);
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
