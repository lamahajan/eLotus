// Demo backend: sample data, no Firebase. Used when config.js has no Firebase setting, or with ?demo in the address.
// Any password works. Parent: Admission No 1024 (two children). Teacher: login name ravi.kumar
import { istDay, AppError } from './core.js';

const K = 'edunest:demo:';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(K + k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(K + k, JSON.stringify(v)); } catch { /* ignore */ } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function seed() {
  const att = (pattern) => {
    const d = {};
    let P = 0, A = 0, L = 0;
    for (let i = 1; i <= 30; i++) {
      const day = istDay(i);
      if (new Date(day + 'T00:00:00Z').getUTCDay() === 0) continue; // Sunday
      const m = pattern[i % pattern.length];
      d[day] = m;
      if (m === 'P') P++; else if (m === 'A') A++; else L++;
    }
    return { d, P, A, L };
  };
  const a1 = att('PPPPPAPPPPPPLPPPPPPPP'), a2 = att('PPPPPPPPPPPPPPPAPPPP');
  const mon = istDay(0).slice(0, 7);
  const docs = {
    'meta/app': { appName: 'Lotus International School', school: 'Lotus International School' },
    'loginIndex/1024': { f: 'fdemo' }, 'loginIndex/1025': { f: 'fdemo' },
    'tLogin/ravi.kumar': { t: 'tdemo' },
    'students/1024': {
      name: 'Aarav Sharma', cls: '5TH', sec: 'A', secId: '5TH-A', roll: '12', dob: '2015-08-14', father: 'Rakesh Sharma', mother: 'Neha Sharma',
      gender: 'M', addr: 'H.No. 221, Model Town, Ludhiana', session: '2026-27',
      fee: { due: 8400, months: 2, period: 'Oct - Nov 2026', paid: 33600, asOn: istDay(0), rc: [
        { no: '2026/0918', date: istDay(52), amt: 8400, mode: 'UPI' }, { no: '2026/0611', date: istDay(110), amt: 12600, mode: 'Cash' },
        { no: '2026/0204', date: istDay(170), amt: 12600, mode: 'Cheque' }] },
      att: { s: { P: 118, A: 6, L: 3 }, m: { P: a1.P > 15 ? 15 : a1.P, A: 1, L: 1 }, mon, d: { ...a1.d, [istDay(0)]: 'P' } }, upd: Date.now() - 3 * 3600e3,
      gp: [{ id: 'GP-0412', date: istDay(0), time: '13:23', by: 'Rakesh Sharma', rel: 'Father', reason: 'Doctor\'s appointment', out: '13:45', outBy: 'eGateSys', st: 'out' },
        { id: 'GP-0377', date: istDay(9), time: '11:10', by: 'Neha Sharma', rel: 'Mother', reason: 'Family function', out: '11:22', outBy: 'Reception', st: 'out' }],
      pay: { upi: 'upi://pay?ver=01&mode=19&pa=lotusinternationalsc.70509801@hdfcbank&pn=LOTUSINTERNATIONALSCHOOL&tr=STQTzwwA1Gsrx9lHM&am=0&cu=INR&mc=8220', qr: '' },
    },
    'students/1025': {
      name: 'Diya Sharma', cls: '2ND', sec: 'B', secId: '2ND-B', roll: '7', dob: '2019-02-03', father: 'Rakesh Sharma', mother: 'Neha Sharma',
      gender: 'F', addr: 'H.No. 221, Model Town, Ludhiana', session: '2026-27',
      fee: { due: 0, months: 0, period: '', paid: 29400, asOn: istDay(0), rc: [{ no: '2026/0919', date: istDay(52), amt: 9800, mode: 'UPI' }] },
      pay: { upi: 'upi://pay?pa=lotus.international@icici&pn=Lotus+International+School&am=0' },
      att: { s: { P: 124, A: 3, L: 0 }, m: { P: 14, A: 1, L: 0 }, mon, d: a2.d }, upd: Date.now() - 3 * 3600e3,
    },
    'notices/board': { list: [
      { id: 'N1', t: 'Annual Sports Day & Winter Carnival', b: 'Track and field events on Saturday from 9 am. Parent entry passes are available at the security desk.', aud: 'all', secs: [], date: istDay(1), exp: '', pin: true, by: 'Principal' },
      { id: 'N2', t: 'Parent-Teacher Meeting', b: 'PTM for classes 1st to 5th on Saturday, 10 am to 1 pm.', aud: 'p', secs: ['5TH-A', '2ND-B'], date: istDay(3), exp: '', pin: false, by: 'Office' },
      { id: 'N3', t: 'Staff meeting', b: 'All teachers: staff room at 2:45 pm today.', aud: 't', secs: [], date: istDay(0), exp: '', pin: false, by: 'Principal' }] },
    'tnotice/5TH-A': { secId: '5TH-A', upd: Date.now(), n: { tdemo: { name: 'Ravi Kumar', list: [{ id: 'nd1', t: 'Maths test on Friday', b: 'Chapter 4 and 5. Bring a geometry box.', date: istDay(0), exp: '', ts: Date.now() }] } } },
    'teachers/tdemo': {
      name: 'Ravi Kumar', ct: '5TH-A', secs: { '5TH-A': ['maths'], '5TH-B': ['maths'], '6TH-A': ['maths', 'science'] },
      subj: { maths: 'Mathematics', science: 'Science' }, ctSubj: { english: 'English', hindi: 'Hindi', evs: 'EVS', maths: 'Mathematics' },
    },
  };
  const hw = (sec, i, subjects) => { docs[`homework/${sec}_${istDay(i)}`] = { secId: sec, date: istDay(i), upd: Date.now(), subjects }; };
  const it = (name, text, teacher, attachments = []) => ({ name, text, teacher, attachments, updatedAt: Date.now() });
  hw('5TH-A', 0, {
    maths: it('Mathematics', 'Page 45, do Q1 to Q5 in your notebook. Take care with the fraction sums.', 'Ravi Kumar'),
    english: it('English', 'Write 10 lines on "My Favourite Festival". Learn spellings of lesson 6.', 'Ravi Kumar', ['https://drive.google.com/file/d/demo']),
    hindi: it('Hindi', 'Learn the question-answers of lesson 7.', 'Sunita Verma'),
  });
  hw('5TH-A', 1, { science: it('Science', 'Draw and label the parts of a plant.', 'Meena Gill'), maths: it('Mathematics', 'Learn tables 12 to 15.', 'Ravi Kumar') });
  hw('5TH-A', 3, { evs: it('EVS', 'Collect 5 different leaves and paste them in the scrapbook.', 'Meena Gill') });
  hw('5TH-A', 9, { english: it('English', 'Read chapter 5 aloud at home.', 'Ravi Kumar') });
  hw('5TH-A', 12, { maths: it('Mathematics', 'Complete worksheet 4.', 'Ravi Kumar', ['https://youtube.com/watch?v=demo']) });
  hw('2ND-B', 0, { english: it('English', 'Write A to Z in cursive, two times.', 'Pooja Arora'), maths: it('Mathematics', 'Count and write 51 to 100.', 'Pooja Arora') });
  hw('2ND-B', 2, { evs: it('EVS', 'Draw your family tree.', 'Pooja Arora') });
  hw('6TH-A', 0, { science: it('Science', 'Read chapter 4: Separation of substances.', 'Ravi Kumar') });
  // exam marks: setup of 5TH-A (EduNest writes it) and one sheet already filled in
  const st5 = [['1024', 'Aarav Sharma', '12'], ['1031', 'Ishita Verma', '3'], ['1036', 'Kabir Singh', '7'], ['1040', 'Meher Kaur', '9'], ['1047', 'Rohan Mehta', '15'], ['1052', 'Sara Khan', '18']];
  const sub5 = { english: { n: 'English', mx: { PT: 20, HY: 80 } }, maths: { n: 'Mathematics', mx: { PT: 20, HY: 80 } }, science: { n: 'Science', mx: { PT: 20, HY: 80 } },
    evs: { n: 'EVS', mx: { PT: 20, HY: 80 } }, hindi: { n: 'Hindi', mx: { PT: 20, HY: 80 } } };
  const mkcfg = (sec, list) => ({ secId: sec, session: '2026-2027', terms: [{ id: 'T1', n: 'Term 1', c: ['PT', 'HY'] }, { id: 'T2', n: 'Term 2', c: ['PT', 'AN'] }],
    as: { PT: 'Periodic Test', HY: 'Half Yearly Exam', AN: 'Annual Exam' }, keys: { '5TH': { ...sub5, maths: { n: 'Mathematics', mx: { PT: 20, HY: 80, AN: 80 } } } },
    st: list.map(([a, n, r]) => ({ a, n, r, k: '5TH' })) });
  docs['mkcfg/5TH-A'] = mkcfg('5TH-A', st5);
  docs['mkcfg/5TH-B'] = mkcfg('5TH-B', [['1060', 'Anaya Gupta', '1'], ['1061', 'Dev Malhotra', '2'], ['1063', 'Nikhil Rana', '4']]);
  docs['mkcfg/6TH-A'] = { ...mkcfg('6TH-A', [['1070', 'Tanvi Bedi', '1'], ['1072', 'Yash Arora', '3']]), keys: { '6TH': sub5 } };
  docs['mkcfg/6TH-A'].st.forEach((x) => { x.k = '6TH'; });
  docs['marks/5TH-A~2026-2027~T1~PT~maths'] = { secId: '5TH-A', session: '2026-2027', term: 'T1', code: 'PT', subj: 'maths', by: 'Ravi Kumar', src: 't', upd: Date.now() - 86400e3,
    m: { 1024: 18, 1031: 17.5, 1036: 'AB', 1040: 20, 1047: 14 }, ul: { 1040: true } };
  return docs;
}

export function demoApi() {
  let docs = load('docs', null);
  if (!docs || docs['meta/app']?.v !== istDay(0) || !docs['mkcfg/5TH-A'] || !docs['notices/board']) { docs = seed(); docs['meta/app'].v = istDay(0); save('docs', docs); }
  const cache = new Set(load('cache', []));
  let user = load('user', null);
  const subs = new Set();
  const emit = () => subs.forEach((f) => f(user));
  const persist = () => { save('docs', docs); save('cache', [...cache]); };
  const out = (path) => ({ exists: !!docs[path], data: docs[path] ? structuredClone(docs[path]) : null });
  const claimsOf = (u) => u?.uid === 'fdemo' ? { r: 'p', a: ['1024', '1025'], s: ['5TH-A', '2ND-B'] }
    : u?.uid === 'tdemo' ? { r: 't', s: ['5TH-A', '5TH-B', '6TH-A'], pr: '1' } : {};
  return {
    onAuth: (cb) => { subs.add(cb); setTimeout(() => cb(user), 0); return () => subs.delete(cb); },
    user: () => user,
    signIn: async (email, pw) => {
      await wait(500);
      const uid = email.split('@')[0];
      if (!pw) throw new AppError('invalid-credential');
      if (uid !== 'fdemo' && uid !== 'tdemo') throw new AppError('invalid-credential');
      user = { uid, email }; save('user', user); emit();
    },
    signOut: async () => { user = null; save('user', null); emit(); },
    claims: async () => claimsOf(user),
    changePassword: async () => { await wait(400); },
    getCache: async (path) => { if (!cache.has(path)) throw new AppError('unavailable'); return { ...out(path), fromCache: true }; },
    getServer: async (path) => {
      await wait(180);
      if (!navigator.onLine) throw new AppError('unavailable');
      cache.add(path); persist();
      return { ...out(path), fromCache: false };
    },
    setMerge: async (path, data) => {
      await wait(350);
      const cur = docs[path] || {};
      docs[path] = { ...cur, ...data, subjects: { ...(cur.subjects || {}), ...(data.subjects || {}) }, ...(data.n || cur.n ? { n: { ...(cur.n || {}), ...(data.n || {}) } } : {}), ...(data.list ? { list: data.list } : {}) };
      cache.add(path); persist();
    },
    saveCells: async (path, head, cells, by, ulClear) => {
      await wait(350);
      const cur = docs[path] || { m: {} };
      const m = { ...(cur.m || {}) };
      for (const [k, v] of Object.entries(cells)) { if (v === null) delete m[k]; else m[k] = v; }
      const ul = { ...(cur.ul || {}) }; for (const k of ulClear || []) delete ul[k];
      docs[path] = { ...cur, ...head, by, src: 't', upd: Date.now(), m, ul };
      cache.add(path); persist();
    },
    removeField: async (path, field, extra) => {
      await wait(300);
      const cur = docs[path];
      if (!cur) throw new AppError('not-found');
      const key = field.split('.')[1];
      delete cur.subjects[key];
      Object.assign(cur, extra);
      persist();
    },
  };
}
