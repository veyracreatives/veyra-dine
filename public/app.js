/* Veyra Academy — academy apps (admin, manager, coach, parent). Built from src/p*.js */
(function(){
'use strict';
const { ic, logo } = IC, C = VFC, T = C.T;
const CFG = Object.assign({ mode: 'demo', plans: { monthly: 999, yearly: 7999, trial: 10 }, googleClientId: '', razorpayKeyId: '', mail: false, demoBase: '' }, window.VF_CFG || {});
const LIVE = CFG.mode === 'live';
if (!LIVE) { try { const d = JSON.parse(localStorage.getItem('vf-demo-v3')); if (d && d.hq && d.hq.plans) CFG.plans = d.hq.plans; } catch (_) {} }
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const initials = n => String(n || '?').replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
const TINT = { blue: 'var(--blue)', green: 'var(--green)', red: 'var(--red)', lime: 'var(--brand)', slate: 'var(--slate)' };
const tintBg = t => ({ blue: '#3B57A8', green: '#1F7A55', red: '#A8493A', lime: '#B07A16', slate: '#5A6070' }[t] || '#5A6070');
const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
const chk = id => { const el = document.getElementById(id); return !!(el && el.checked); };

let B = null;           // what the server (or demo) says this person can see
const U = {             // screen state only
  menu: false, modal: null, draft: {}, attBatch: '', attDay: 'today', attMode: 'players', feeFilter: 'all', feeMonth: '', pq: '', pb: 'all', aq: '',
  child: '', progP: '', prog: {}, planB: '', planEdit: null, tourn: '', ground: '', planSel: 'yearly', calM: '', busy: false, stale: false, sq: null, outbox: 0
};

/* ---------- lookups ---------- */
const batch = id => (B && B.batches.find(b => b.id === id)) || { id, name: 'No batch', days: [], time: '', fee: 0, tint: 'slate', coach: '' };
const staff = id => (B && B.staff.find(s => s.id === id)) || { id, name: 'No coach yet', role: 'coach', title: '' };
const player = id => (B && B.players.find(p => p.id === id)) || null;
const ground = id => (B && B.grounds.find(g => g.id === id)) || { name: '' };
const coachName = b => b.coach ? staff(b.coach).name : 'No coach yet';
const jersey = (p, cls) => `<span class="jersey ${cls || ''}" style="background:${tintBg(batch(p.batch).tint)}">${p.no || initials(p.name)}</span>`;
const av = (name, cls) => { let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 360; return `<span class="av ${cls || ''}" style="background:hsl(${h} 30% 30%)">${initials(name)}</span>`; };
const feePill = s => ({ paid: '<span class="pill p-ok">Paid</span>', verify: '<span class="pill p-info">Check UPI</span>', due: '<span class="pill p-warn">Due</span>', overdue: '<span class="pill p-bad">Overdue</span>', waived: '<span class="pill p-mute">Waived</span>', break: '<span class="pill p-info plain">On break</span>', none: '<span class="pill p-mute plain">No bill</span>' }[s] || '');
const attPill = v => v == null ? '<span class="pill p-mute plain">New</span>' : v >= 85 ? `<span class="pill p-ok plain tnum">${v}%</span>` : v >= 70 ? `<span class="pill p-warn plain tnum">${v}%</span>` : `<span class="pill p-bad plain tnum">${v}%</span>`;
const chev = (n, of = 4) => `<span class="chev" aria-hidden="true">${Array.from({ length: of }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const empty = (icon, text, btn) => `<div class="empty-cta">${ic(icon)}<p>${text}</p>${btn || ''}</div>`;
const when = t => T.ago(t, Date.now());
const myStaff = () => B.staff.find(s => s.id === B.me.sid);
const hello = () => { const h = new Date(Date.now() + 19800000).getUTCHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
const ord = n => n + ((n % 100 > 10 && n % 100 < 14) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
const first = n => String(n || '').split(' ')[0];
const tStatus = t => t.end < B.today ? 'done' : t.start <= B.today ? 'ongoing' : 'upcoming';

function toast(msg, link) {
  if (typeof i18nOn === 'function' && i18nOn()) msg = trS(String(msg));
  const t = document.createElement('div'); t.className = 'toast';
  t.innerHTML = ic('ok') + '<span>' + esc(msg) + '</span>' + (link ? ` <a href="${link.href}" style="color:inherit;font-weight:700;margin-left:6px">${esc(link.label)}</a>` : '');
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), link ? 5200 : 3000);
}
function fail(e) { toast(e && e.message ? e.message : String(e)); }
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
const csv = rows => rows.map(r => r.map(c => { const s = String(c == null ? '' : c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');

/* ---------- data: in-browser demo, or the live server ---------- */
const DemoAPI = (() => {
  const KEY = 'vf-demo-v3'; let db = null; let mem = null;
  const store = { get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (_) { return null; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) {} } };
  const env = () => ({
    url: location.href.split('#')[0],
    ensureUser({ email, name, pw }) { const ex = Object.values(db.users).find(u => u.email === email); if (ex) return { uid: ex.id }; const temp = pw || ('vf' + Math.random().toString(36).slice(2, 8)); const id = C.id('u'); db.users[id] = { id, email, name, pw: temp }; return { uid: id, temp: pw ? undefined : temp }; },
    link(uid, aid, role, sid) { if (!db.mem.some(m => m.uid === uid && m.aid === aid && m.role === role)) db.mem.push({ uid, aid, role, sid: sid || '' }); },
    unlink(uid, aid, role) { db.mem = db.mem.filter(m => !(m.uid === uid && m.aid === aid && m.role === role)); },
    resetPw(uid) { const t = 'vf' + Math.random().toString(36).slice(2, 8); db.users[uid].pw = t; return t; },
    mail() { return false; }
  });
  function reset() {
    db = { users: {}, mem: [], ac: {}, ses: null, hq: { plans: { monthly: 999, yearly: 7999, trial: 10 }, sales: [], keys: [], activity: [], seq: 41 } };
    const ac = C.demo(env(), Date.now()); db.ac[ac.id] = ac; db.demoAid = ac.id;
    const now = Date.now(), D = 864e5;
    db.hq.sales = [['Thane Tigers Football School', 'yearly', 7999, 'Razorpay', 2], ['Vashi United Juniors', 'monthly', 999, 'Razorpay', 6], ['Belapur Ballers', 'yearly', 7999, 'Licence key', 12], ['Panvel Footie Kids', 'monthly', 999, 'Razorpay', 27]].map(([academy, plan, amt, via, d], i) => ({ id: 'VFR-' + new Date().getFullYear() + '-00' + (38 + i), at: now - d * D, academy, plan, amt, via }));
    db.hq.others = [['Thane Tigers Football School', 'Ghodbunder Rd, Thane', 'yearly', 142, 300], ['Vashi United Juniors', 'Vashi, Navi Mumbai', 'monthly', 68, 24], ['Belapur Ballers', 'CBD Belapur', 'yearly', 91, 200], ['Panvel Footie Kids', 'New Panvel', 'monthly', 37, 3], ['Airoli Strikers Academy', 'Airoli', 'monthly', 44, -9]].map(([name, place, type, players, days]) => ({ name, place, type, players, until: now + days * D }));
    db.hq.activity = [['Thane Tigers Football School paid ₹7,999 for yearly (Razorpay)', 2], ['Vashi United Juniors paid ₹999 for monthly (Razorpay)', 6], ['Licence key made for Belapur Ballers (yearly)', 12], ['Airoli Strikers Academy plan ended', 16], ['Kickstart FC Academy started a trial', 1]].map(([text, d]) => ({ at: now - d * D, text })).sort((a, b) => b.at - a.at);
    save();
  }
  function save() { store.set(db); }
  function load() { db = store.get(); if (!db || !db.ac || !db.ac[db.demoAid]) reset(); }
  const ac = () => db.ac[db.ses.aid];
  function meOf(ses) { const u = db.users[ses.uid]; return { uid: u.id, role: ses.role, sid: ses.sid, name: u.name, email: u.email }; }
  function boot() {
    load(); if (!db.ses || !db.ac[db.ses.aid] || !db.mem.some(m => m.uid === db.ses.uid && m.aid === db.ses.aid && m.role === db.ses.role)) { db.ses = null; save(); return Promise.resolve(null); }
    const a = ac(); const m = db.mem.filter(x => x.uid === db.ses.uid).map(x => ({ aid: x.aid, role: x.role, name: (db.ac[x.aid] || {}).name }));
    return Promise.resolve(C.boot(a, meOf(db.ses), Date.now(), { memberships: m, demo: a.id === db.demoAid }));
  }
  const ok = v => Promise.resolve(v);
  const no = m => Promise.reject(new Error(m));
  return {
    boot,
    act(type, p) { load(); if (!db.ses) return no('Please log in again'); try { const me = meOf(db.ses); const r = C.act(ac(), { ...me, now: Date.now() }, type, p, env()); save(); return ok(r); } catch (e) { return Promise.reject(e); } },
    login(email, pw) { load(); const u = Object.values(db.users).find(x => x.email === String(email).toLowerCase().trim()); if (!u || u.pw !== pw) return no('That email and password do not match'); const m = db.mem.find(x => x.uid === u.id); if (!m) return no('Your academy has not added you yet'); db.ses = { uid: u.id, aid: m.aid, role: m.role, sid: m.sid }; save(); return ok(); },
    loginAs(role) { load(); const want = { admin: 'owner@kickstart.demo', manager: 'priya@kickstart.demo', coach: 'arjun@kickstart.demo', parent: 'sneha.patil@parent.demo' }[role]; const u = Object.values(db.users).find(x => x.email === want); const m = u && db.mem.find(x => x.uid === u.id && x.aid === db.demoAid); if (!m) { reset(); return this.loginAs(role); } db.ses = { uid: u.id, aid: m.aid, role: m.role, sid: m.sid }; save(); return ok(); },
    switchTo(aid, role) { load(); const m = db.mem.find(x => x.uid === db.ses.uid && x.aid === aid && x.role === role); if (!m) return no('Not allowed'); db.ses = { uid: m.uid, aid, role, sid: m.sid }; save(); return ok(); },
    signup(f) { load(); if (Object.values(db.users).some(u => u.email === f.email)) return no('This email already has an account. Log in instead.'); const e = env(); const u = e.ensureUser({ email: f.email, name: f.name, pw: f.pw }); const a = C.newAcademy({ name: f.academy, place: f.city, sport: f.sport, now: Date.now(), trialDays: db.hq.plans.trial }); a.payee = f.academy; a.admins.push(u.uid); db.ac[a.id] = a; e.link(u.uid, a.id, 'admin'); db.ses = { uid: u.uid, aid: a.id, role: 'admin', sid: '' }; db.hq.activity.unshift({ at: Date.now(), text: `${f.academy} started a trial` }); save(); return ok(); },
    logout() { load(); db.ses = null; save(); return ok(); },
    google() { return no('Google sign-in works on the live site. In this preview, use the demo logins below.'); },
    forgot() { return ok({ msg: 'On the live site we email a reset link. In this preview, use the demo logins.' }); },
    resetPw() { return no('Reset links work on the live site'); },
    changePw(oldPw, newPw) { load(); const u = db.users[db.ses.uid]; if (u.pw !== oldPw) return no('Your current password is wrong'); if (String(newPw).length < 8) return no('Use at least 8 characters'); u.pw = newPw; save(); return ok({ msg: 'Password changed' }); },
    activateKey(code) { load(); code = String(code).toUpperCase().trim(); const k = db.hq.keys.find(x => x.code === code); if (!k) return no('This key is not valid. Keys look like VFB-XXXX-XXXX-XXXX'); if (k.used) return no('This key was already used'); if (k.stopped) return no('This key was stopped by Veyra'); const a = ac(); C.applyPlan(a, k.plan, Date.now()); k.used = { aid: a.id, name: a.name, at: Date.now() }; db.hq.activity.unshift({ at: Date.now(), text: `${a.name} activated key ${code}` }); save(); return ok({ msg: 'Key activated. Your plan is on.' }); },
    buyPlan(type) { load(); const a = ac(); const amt = db.hq.plans[type]; C.applyPlan(a, type, Date.now()); db.hq.seq++; db.hq.sales.unshift({ id: `VFR-${new Date().getFullYear()}-${String(db.hq.seq).padStart(4, '0')}`, at: Date.now(), academy: a.name, aid: a.id, plan: type, amt, via: 'Razorpay (test)' }); db.hq.activity.unshift({ at: Date.now(), text: `${a.name} paid ${inr(amt)} for ${type}` }); save(); return ok({ msg: `Payment received. ${type === 'yearly' ? 'Yearly' : 'Monthly'} plan is on.` }); },
    upload() { return ok({ id: '' }); },
    reset() { reset(); return ok(); },
    subscribe(cb) { window.addEventListener('storage', e => { if (e.key === KEY) cb(); }); }
  };
})();

const LiveAPI = (() => {
  async function req(path, body, method) {
    const r = await fetch(path, { method: method || (body ? 'POST' : 'GET'), headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
    let j = {}; try { j = await r.json(); } catch (_) {}
    if (!r.ok) { const e = new Error(j.error || 'Something went wrong. Try again.'); e.code = r.status; throw e; }
    return j;
  }
  return {
    req,
    boot: () => req('/api/boot').then(j => j.boot).catch(e => { if (e.code === 401) return null; throw e; }),
    act: (type, p) => req('/api/act', { type, p }),
    login: (email, pw) => req('/api/login', { email, pw, vid: (window.VA && VA.vid ? VA.vid() : '') }),
    switchTo: (aid, role) => req('/api/switch', { aid, role }),
    signup: f => req('/api/signup', Object.assign({ vid: (window.VA && VA.vid ? VA.vid() : '') }, f)),
    logout: () => req('/api/logout', {}),
    google: credential => req('/api/google', { credential, vid: (window.VA && VA.vid ? VA.vid() : ''), intent: location.hash.includes('signup') ? 'signup' : 'login' }),
    forgot: email => req('/api/forgot', { email }),
    resetPw: (token, pw) => req('/api/reset', { token, pw }),
    changePw: (oldPw, newPw) => req('/api/password', { oldPw, newPw }),
    activateKey: code => req('/api/plan/key', { code }),
    buyPlan: type => buyWithRazorpay(type),
    upload: (file, pid, key) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => req('/api/upload', { pid, key, name: file.name, type: file.type, data: String(fr.result).split(',')[1] }).then(res, rej); fr.onerror = () => rej(new Error('Could not read the file')); fr.readAsDataURL(file); }),
    subscribe(cb) {
      let es, wait = 1000;
      const open = () => { try { es = new EventSource('/api/events'); es.onmessage = () => { wait = 1000; cb(); }; es.onerror = () => { es.close(); setTimeout(open, wait = Math.min(wait * 2, 30000)); }; } catch (_) {} };
      open();
      document.addEventListener('visibilitychange', () => { if (!document.hidden) cb(); });
    }
  };
  function loadScript(src) { return new Promise((res, rej) => { if ([...document.scripts].some(s => s.src === src)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load Razorpay. Check your internet.')); document.head.appendChild(s); }); }
  async function buyWithRazorpay(type) {
    const o = await req('/api/plan/order', { plan: type });
    await loadScript('https://checkout.razorpay.com/v1/checkout.js');
    return new Promise((res, rej) => {
      const rz = new window.Razorpay({ key: o.keyId, order_id: o.orderId, amount: o.amount, currency: 'INR', name: 'Veyra Academy', description: o.description, prefill: { name: o.name, email: o.email }, theme: { color: '#0B6B45' },
        handler: r => req('/api/plan/verify', r).then(res, rej), modal: { ondismiss: () => rej(new Error('Payment cancelled')) } });
      rz.on('payment.failed', r => rej(new Error((r.error && r.error.description) || 'Payment failed')));
      rz.open();
    });
  }
})();
const API = LIVE ? LiveAPI : DemoAPI;

/* weak signal: attendance waits on the phone and goes when the network is back */
const OUTBOX = 'vf-outbox';
const outbox = { get() { try { return JSON.parse(localStorage.getItem(OUTBOX)) || []; } catch (_) { return []; } }, set(v) { try { localStorage.setItem(OUTBOX, JSON.stringify(v)); } catch (_) {} U.outbox = v.length; } };
async function flush() {
  if (!LIVE) return; const q = outbox.get(); if (!q.length || !navigator.onLine) return;
  const left = [];
  for (const x of q) { try { await API.act(x.type, x.p); } catch (e) { if (!e.code) left.push(x); } }
  outbox.set(left); if (left.length < q.length) { toast(`${q.length - left.length} saved mark${q.length - left.length === 1 ? '' : 's'} sent`); refresh(); }
}
window.addEventListener('online', flush); setInterval(flush, 30000);

async function act(type, p, opts) {
  opts = opts || {};
  try {
    const r = await API.act(type, p);
    if (r && r.boot) B = r.boot; else await refresh(true);
    if (opts.close !== false && U.modal && !opts.keep) U.modal = null;
    rerender();
    if (r && r.msg && !opts.quiet) toast(r.msg, opts.link);
    return r || {};
  } catch (e) {
    if (LIVE && !e.code && opts.offline) { const q = outbox.get(); q.push({ type, p, at: Date.now() }); outbox.set(q); if (U.modal) U.modal = null; rerender(); toast('No signal. Saved on this phone, it sends when you are back online.'); return { offline: true }; }
    fail(e); return null;
  }
}
async function refresh(silent) {
  try { const nb = await API.boot(); B = nb; } catch (e) { if (!silent) fail(e); }
}
async function liveUpdate() {
  const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (U.modal || typing || drag) { U.stale = true; return; }
  const v = B && B.v; await refresh(true);
  if (!B || B.v !== v) rerender();
}

/* ---------- routes ---------- */
const ROLES = {
  admin: { label: 'Admin', tabs: [
    ['home', 'Dashboard', 'home', 'Academy'], ['admissions', 'Admissions', 'board', 'Academy'], ['players', 'Players', 'players', 'Academy'], ['batches', 'Batches', 'batch', 'Academy'],
    ['attendance', 'Attendance', 'check', 'Daily'], ['fees', 'Fees & billing', 'rupee', 'Daily'], ['reminders', 'Fee reminders', 'bell', 'Daily'],
    ['tournaments', 'Tournaments', 'trophy', 'Coaching'], ['training', 'Training plan', 'whistle', 'Coaching'], ['health', 'Health & documents', 'shield', 'Coaching'], ['kit', 'Kit & equipment', 'gift', 'Coaching'],
    ['staff', 'Coaches & staff', 'players', 'People'], ['parents', 'Parents', 'parent', 'People'], ['notices', 'Notices', 'megaphone', 'People'],
    ['money', 'Expenses & salaries', 'receipt', 'Money & setup'], ['grounds', 'Grounds', 'pin', 'Money & setup'], ['reports', 'Reports', 'chart', 'Money & setup'], ['setup', 'Settings & plan', 'gear', 'Money & setup']],
    bar: ['home', 'attendance', 'fees', 'players'] },
  manager: { label: 'Manager', tabs: [
    ['home', 'Today', 'home', 'Manage'], ['staffatt', 'Coach attendance', 'whistle', 'Manage'], ['attendance', 'Player attendance', 'check', 'Manage'], ['admissions', 'Admissions', 'board', 'Manage'], ['players', 'Players', 'players', 'Manage'], ['batches', 'Batches', 'batch', 'Manage'], ['notices', 'Notices', 'megaphone', 'Manage'],
    ['tournaments', 'Tournaments', 'trophy', 'Coaching'], ['training', 'Training plan', 'whistle', 'Coaching'], ['health', 'Health & documents', 'shield', 'Coaching'], ['grounds', 'Grounds', 'pin', 'Coaching'], ['kit', 'Kit & equipment', 'gift', 'Coaching']],
    bar: ['home', 'staffatt', 'attendance', 'admissions'] },
  coach: { label: 'Coach', tabs: [['home', 'Today', 'home', 'Coach'], ['mark', 'Take attendance', 'check', 'Coach'], ['training', 'Training plan', 'whistle', 'Coach'], ['matches', 'Matches', 'trophy', 'Coach'], ['progress', 'Player progress', 'star', 'Coach'], ['myatt', 'My attendance', 'clock', 'Coach'], ['notices', 'Notices', 'megaphone', 'Coach']],
    bar: ['home', 'mark', 'training', 'matches'] },
  parent: { label: 'Parent', tabs: [['home', 'Home', 'home', 'Parent'], ['attendance', 'Attendance', 'check', 'Parent'], ['fees', 'Fees', 'rupee', 'Parent'], ['matches', 'Matches', 'trophy', 'Parent'], ['progress', 'Progress & health', 'star', 'Parent'], ['notices', 'Notices', 'megaphone', 'Parent']],
    bar: ['home', 'attendance', 'fees', 'matches'] }
};
const SHORT = { mark: 'Mark', myatt: 'My days', progress: 'Progress', staffatt: 'Coaches', training: 'Training', admissions: 'Admissions', home: 'Home' };
function route() {
  const h = decodeURIComponent((location.hash || '').replace('#', ''));
  if (h.startsWith('reset-')) return { view: 'reset', token: h.slice(6) };
  const [r, t] = h.split('-');
  if (ROLES[r]) return { view: 'app', role: r, tab: ROLES[r].tabs.some(x => x[0] === t) ? t : 'home' };
  if (r === 'app') return { view: 'home' };
  if (['login', 'signup', 'forgot'].includes(r)) return { view: r };
  return { view: 'landing' };
}
const go = h => { if (location.hash === '#' + h) render(); else location.hash = h; };

/* ---------- auth ---------- */
function pitchSVG() { return `<svg class="pitch-lines" viewBox="0 0 600 400" fill="none" style="stroke:var(--brand)" stroke-opacity=".3" stroke-width="2" aria-hidden="true"><rect x="20" y="20" width="560" height="360" rx="6"/><path d="M300 20v360"/><circle cx="300" cy="200" r="60"/><rect x="20" y="110" width="80" height="180"/><rect x="500" y="110" width="80" height="180"/><rect x="20" y="160" width="30" height="80"/><rect x="550" y="160" width="30" height="80"/></svg>`; }
function auth(kind, token) {
  const up = kind === 'signup', fg = kind === 'forgot', rs = kind === 'reset';
  const head = up ? ['Start your academy', `Free for ${CFG.plans.trial} days. Then ${inr(CFG.plans.monthly)} a month or ${inr(CFG.plans.yearly)} a year.`] : fg ? ['Forgot password', 'We email you a link to make a new one.'] : rs ? ['Make a new password', 'Use at least 8 characters.'] : ['Log in', 'Use the email your academy added, or Google.'];
  const google = !fg && !rs && (LIVE ? CFG.googleClientId : true);
  return `<div class="auth">
  <aside class="auth-art"><a class="brand" href="#">${logo()}<div><b>VEYRA ACADEMY</b><small>Academy app</small></div></a>
    <div style="display:grid;gap:18px;position:relative"><h2 class="disp">${up ? `${['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen'][CFG.plans.trial] || CFG.plans.trial} days free.<br><em>No card.</em>` : 'Back on<br><em>the pitch</em>'}</h2><p class="muted" style="max-width:420px">${up ? 'Set up your batches, invite coaches and send parents the app link today.' : 'Admins, managers, coaches and parents all log in here. You land in your own app.'}</p></div>
    ${pitchSVG()}<a class="faint" href="mailto:marketing@veyracreatives.com" style="position:relative;font-size:13px">marketing@veyracreatives.com</a></aside>
  <main class="auth-form"><form class="auth-box" id="authForm" data-track-form="${kind}" data-kind="${kind}" data-token="${esc(token || '')}" novalidate>
    <a href="#" class="faint" style="font-size:14px;font-weight:600;text-decoration:none">← Back to home</a>
    <a class="brand auth-brand" href="#" style="padding:0">${logo()}<div><b>VEYRA ACADEMY</b><small>Academy app</small></div></a>
    <div><h1>${head[0]}</h1><p class="muted" style="margin-top:6px">${head[1]}</p></div>
    ${B && !up && !rs ? `<div class="banner">${ic('ok')}<span class="grow">You are logged in as <b>${esc(B.me.name)}</b>.</span><a class="btn btn-primary btn-sm" href="#${B.me.role}">Open my app</a></div>` : ''}
    ${google ? `<div id="gbtn" class="gwrap"><button class="btn btn-google btn-lg btn-block" type="button" data-act="google">${ic('google')}Continue with Google</button>${LIVE ? '<div class="glayer" aria-hidden="false"></div>' : ''}</div><div class="or">or with email</div>` : ''}
    ${up ? `<label class="field" for="f-ac"><span>Academy name</span><input class="input" id="f-ac" placeholder="e.g. Kickstart Sports Academy" autocomplete="organization" required></label>
    <label class="field" for="f-sport"><span>Sport</span><select class="select" id="f-sport">${[['football', 'Football'], ['cricket', 'Cricket'], ['badminton', 'Badminton'], ['tennis', 'Tennis'], ['basketball', 'Basketball'], ['swimming', 'Swimming'], ['skating', 'Skating'], ['athletics', 'Athletics'], ['martial', 'Martial arts'], ['other', 'Other sport']].map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
    <div class="grid g2"><label class="field" for="f-nm"><span>Your name</span><input class="input" id="f-nm" autocomplete="name" required></label><label class="field" for="f-city"><span>Area or city</span><input class="input" id="f-city" placeholder="Kharghar, Navi Mumbai"></label></div>
    <label class="field" for="f-ph"><span>Phone or WhatsApp <span class="faint" style="font-weight:500">(optional)</span></span><input class="input" id="f-ph" type="tel" inputmode="tel" autocomplete="tel" placeholder="So we can help you set up"></label>` : ''}
    ${rs ? '' : `<label class="field" for="f-em"><span>Email</span><input class="input" id="f-em" type="email" autocomplete="email" placeholder="you@academy.in" required></label>`}
    ${fg ? '' : `<label class="field" for="f-pw"><span class="between" style="width:100%"><span>${rs ? 'New password' : 'Password'}</span>${up || rs ? '' : '<a href="#forgot" class="faint" style="font-weight:500">Forgot password?</a>'}</span><input class="input" id="f-pw" type="password" autocomplete="${up || rs ? 'new-password' : 'current-password'}" placeholder="${up || rs ? 'At least 8 characters' : ''}" required></label>`}
    <p class="faint" id="authErr" role="alert" style="font-size:13.5px;color:var(--bad);min-height:0"></p>
    <button class="btn btn-primary btn-lg btn-block" type="submit">${up ? 'Create academy' : fg ? 'Email me a link' : rs ? 'Save password' : 'Log in'}</button>
    <p class="muted" style="text-align:center;font-size:14px">${up ? 'Already have an account? <a href="#login" style="color:var(--brand);font-weight:600">Log in</a>' : 'New academy? <a href="#signup" style="color:var(--brand);font-weight:600">Start free trial</a>'}</p>
    ${!up && !LIVE ? `<div class="divider"></div><span class="label">Try the apps (demo logins)</span><div class="demo-roles">${[['admin', 'Admin', 'shield'], ['manager', 'Manager', 'whistle'], ['coach', 'Coach', 'check'], ['parent', 'Parent', 'parent']].map(([h, n, i]) => `<a href="#${h}">${ic(i)}${n}</a>`).join('')}</div><span class="faint" style="font-size:12.5px">Or log in with owner@kickstart.demo and demo1234.</span>` : ''}
    ${!up && LIVE && CFG.demoBase ? `<div class="divider"></div><a class="btn btn-ghost btn-lg btn-block" href="${CFG.demoBase}#admin">See the demo academy</a>` : ''}
  </form></main></div>`;
}
function mountGoogle() {
  if (!LIVE || !CFG.googleClientId || !$('#gbtn')) return;
  const draw = () => { if (!window.google || !google.accounts) return; google.accounts.id.initialize({ client_id: CFG.googleClientId, callback: r => API.google(r.credential).then(afterLogin).catch(e => showAuthErr(e.message)) }); const L = $('#gbtn .glayer'); if (!L) return; L.innerHTML = ''; google.accounts.id.renderButton(L, { theme: 'outline', size: 'large', text: 'continue_with', width: 400 }); fitG(); setTimeout(fitG, 600); };
  if (!mountGoogle.rs) { mountGoogle.rs = 1; addEventListener('resize', fitG); }
  if (window.google && google.accounts) draw(); else { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = draw; document.head.appendChild(s); }
}
/* Google's own button can't be wider than 400px, so our full-width button shows and Google's sits on top, invisible, stretched to the same size */
function fitG() { const w = $('#gbtn'), L = w && w.querySelector('.glayer'); if (!L || !L.firstElementChild) return; L.style.transform = ''; const r = L.firstElementChild.getBoundingClientRect(); if (!r.width || !r.height) return; L.style.transform = `scale(${w.clientWidth / r.width},${w.clientHeight / r.height})`; w.classList.add('g-ready'); }
const showAuthErr = m => { const e = $('#authErr'); if (e) e.textContent = m; else toast(m); };
async function afterLogin(r) { await refresh(); if (!B) return showAuthErr('Could not open your academy. Try again.'); toast(r && r.msg ? r.msg : `Welcome, ${first(B.me.name)}`); go(B.me.role + (r && r.created ? '-setup' : '')); }

/* ---------- app frame ---------- */
function shell(role, tab, body) {
  const R = ROLES[role], cur = R.tabs.find(t => t[0] === tab);
  const groups = [...new Set(R.tabs.map(t => t[3]))];
  const count = id => role === 'admin' && id === 'fees' && B.queue && B.queue.length ? `<span class="count">${B.queue.length}</span>` : role === 'admin' && id === 'admissions' && B.adm.filter(a => a.s === 'enquiry').length ? `<span class="count">${B.adm.filter(a => a.s === 'enquiry').length}</span>` : '';
  const navHTML = groups.map(g => `${groups.length > 1 ? `<div class="nav-g">${g}</div>` : ''}${R.tabs.filter(t => t[3] === g).map(([id, l, i]) => `<a href="#${role}-${id}" ${id === tab ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span>${count(id)}</a>`).join('')}`).join('');
  const bar = R.bar.map(id => R.tabs.find(t => t[0] === id));
  const P = B.plan;
  const planBox = role === 'admin' ? `<div class="plan-box"><div class="between"><b>${P.type === 'trial' ? 'Free trial' : P.type === 'yearly' ? 'Yearly plan' : 'Monthly plan'}</b><span class="mono faint" style="font-size:11px">${P.active ? P.daysLeft + ' DAYS LEFT' : 'ENDED'}</span></div><div class="meter"><i style="width:${Math.max(4, Math.min(100, P.daysLeft / (P.type === 'yearly' ? 365 : P.type === 'monthly' ? 30 : CFG.plans.trial) * 100))}%"></i></div><small>${P.type === 'trial' ? `Then ${inr(CFG.plans.monthly)}/month or ${inr(CFG.plans.yearly)}/year.` : 'Paid until ' + T.full(T.date(P.until))}</small>${P.type === 'trial' || P.daysLeft < 8 ? `<a class="btn btn-primary btn-sm" href="#admin-setup">${P.type === 'trial' ? 'Choose a plan' : 'Renew'}</a>` : ''}</div>` : '';
  const ms = (B.memberships || []);
  const menuItems = !LIVE ? `${Object.entries(ROLES).map(([k, v]) => `<a href="#${k}" role="menuitem" ${k === role ? 'aria-current="true"' : ''}>${v.label} app<small>${{ admin: 'Nikhil (owner)', manager: 'Priya', coach: 'Arjun', parent: 'Sneha (parent)' }[k]}</small></a>`).join('')}${CFG.hosted ? '' : '<a href="hq.html" role="menuitem">Veyra HQ<small>Veyra only</small></a>'}<a href="#" role="menuitem">Website</a><a role="menuitem" data-act="account">${ic('key')}My account</a><a role="menuitem" data-act="resetDemo">${ic('swap')}Reset demo data</a><a role="menuitem" data-act="logout">${ic('logout')}Log out</a>`
    : `${ms.length > 1 ? ms.map(m => `<a role="menuitem" data-act="switchTo" data-aid="${m.aid}" data-role="${m.role}" ${m.aid === B.academy.id && m.role === role ? 'aria-current="true"' : ''}>${esc(m.name)}<small>${ROLES[m.role].label} app</small></a>`).join('') : ''}<a role="menuitem" data-act="account">${ic('key')}My account</a><a role="menuitem" data-act="install">${ic('phone')}Install the app</a><a href="#" role="menuitem">Website</a><a role="menuitem" data-act="logout">${ic('logout')}Log out</a>`;
  return `<div class="shell">
  <aside class="side"><a class="brand" href="#${role}">${logo()}<div><b>VEYRA ACADEMY</b><small>${R.label} app</small></div></a>
    ${role === 'parent' ? '' : `<div class="academy">${av(B.academy.name, 'sm')}<div><b>${esc(B.academy.name)}</b><small>${esc(B.academy.place)}</small></div></div>`}
    <nav class="nav" aria-label="${R.label}">${navHTML}</nav>
    <div class="side-foot">${planBox}<button class="who" type="button" data-act="account" style="padding:8px;border:0;background:none;text-align:left;width:100%;cursor:pointer;color:inherit">${av(B.me.name)}<div><b>${esc(B.me.name)}</b><small>${role === 'parent' ? 'Parent' : role === 'admin' ? 'Academy owner' : esc((myStaff() || {}).title || R.label)}</small></div></button></div>
  </aside>
  <div class="main">
    <header class="top">${logo('m-brand')}<h1>${cur[1]}</h1>
      <div class="top-actions">
        <div class="role-switch"><button class="btn btn-ghost btn-sm" type="button" data-act="menu" aria-expanded="${U.menu}">${ic(LIVE ? 'players' : 'swap')}<span class="hide-sm">${LIVE ? esc(first(B.me.name)) : 'Preview as ' + R.label}</span><span class="sr">Menu</span></button>
        ${U.menu ? `<div class="menu" role="menu">${menuItems}</div>` : ''}</div>
        ${langPicker()}<button class="icon-btn" type="button" data-act="bell" aria-label="Notifications${B.unread ? ', ' + B.unread + ' new' : ''}">${ic('bell')}${B.unread ? `<span class="dot-n">${B.unread > 9 ? '9+' : B.unread}</span>` : ''}</button>
      </div>
    </header>
    <main class="content ${role === 'parent' || role === 'coach' ? 'narrow' : ''}">${banners(role)}${body}</main>
  </div>
  <nav class="tabbar" aria-label="${R.label} tabs">${bar.map(([id, l, i]) => `<a href="#${role}-${id}" ${id === tab ? 'aria-current="page"' : ''}>${ic(i)}<span>${SHORT[id] || (role === 'manager' && id === 'attendance' ? 'Players' : l.split(' ')[0])}</span></a>`).join('')}<a data-act="more" href="javascript:void 0" ${R.bar.includes(tab) ? '' : 'aria-current="page"'}>${ic('menu')}<span>More</span></a></nav>
  ${U.outbox ? `<div class="offline-pill">${U.outbox} waiting to send</div>` : ''}
  </div>`;
}
function banners(role) {
  const P = B.plan; let h = '';
  if (P.suspended) h += `<div class="banner bad">${ic('shield')}<span class="grow">This academy is paused by Veyra. Email marketing@veyracreatives.com.</span></div>`;
  else if (!P.active) h += role === 'admin' ? `<div class="banner bad">${ic('rupee')}<span class="grow"><b>Your ${P.type === 'trial' ? 'free trial' : 'plan'} has ended.</b> Everything is saved. Pick a plan to keep using the apps.</span><a class="btn btn-primary btn-sm" href="#admin-setup">Choose a plan</a></div>` : `<div class="banner bad">${ic('rupee')}<span class="grow">The academy's plan has ended, so changes are paused. Ask the academy to renew.</span></div>`;
  else if (role === 'admin' && P.type === 'trial' && P.daysLeft <= 3) h += `<div class="banner warn">${ic('clock')}<span class="grow">Your free trial ends in ${P.daysLeft} day${P.daysLeft === 1 ? '' : 's'}.</span><a class="btn btn-primary btn-sm" href="#admin-setup">Choose a plan</a></div>`;
  return h;
}

/* ---------- shared cards ---------- */
const todayMarks = bid => (B.att[B.today] || {})[bid];
function tally(bid, marks) {
  const list = B.players.filter(p => p.batch === bid && !p.brk); const m = marks || {};
  const v = list.map(p => m[p.id]); return { P: v.filter(x => x === 'P').length, L: v.filter(x => x === 'L').length, A: v.filter(x => x === 'A').length, n: list.length };
}
function sessionsCard(role) {
  const ids = role === 'coach' ? B.sessionsToday.filter(id => B.myBatches.includes(id)) : B.sessionsToday;
  return `<div class="card glow"><div class="card-h"><div><h3>${role === 'coach' ? 'My sessions today' : "Today's sessions"}</h3><div class="sub">${T.long(B.today)}</div></div><span class="pill p-mute plain mono">${ids.length} SESSION${ids.length === 1 ? '' : 'S'}</span></div>
  <div class="list">${ids.length ? ids.map(bid => { const b = batch(bid), r = todayMarks(bid), t = tally(bid, r && r.marks); const n = B.players.filter(p => p.batch === bid).length;
    return `<div class="session"><time>${T.t12(b.time)}</time><div style="min-width:0"><b>${esc(b.name)}</b><small>${esc(ground(b.ground).name)} · ${role === 'coach' ? n + ' players' : esc(coachName(b))}</small></div>${r ? `<span class="pill p-ok">${t.P + t.L}/${t.n} present</span>` : n ? `<button class="btn ${role === 'coach' ? 'btn-primary' : 'btn-ghost'} btn-sm" type="button" data-act="openMark" data-b="${bid}">${role === 'coach' ? 'Take attendance' : 'Mark now'}</button>` : '<span class="pill p-mute plain">No players</span>'}</div>`; }).join('') : `<div class="empty">No sessions today${(B.batches.length ? '' : '. Add a batch to get started')}.</div>`}</div></div>`;
}
function queueCard(compact) {
  const q = B.queue || [];
  return `<div class="card ${compact ? '' : 'glow'}"><div class="card-h"><div><h3>UPI payments to check</h3><div class="sub">Match each ID in your bank app, then approve</div></div><span class="pill ${q.length ? 'p-info' : 'p-ok'}">${q.length ? q.length + ' waiting' : 'All clear'}</span></div>
  <div class="list">${q.length ? q.map(x => { const p = player(x.pid) || { name: 'Past player', batch: '', no: '' }; return `<div class="row qrow"><div class="who grow" style="min-width:180px">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(p.parentName || x.by)} · ${T.monthOnly(x.m)} · ${when(x.at)}</small></div></div><div class="end"><span class="hstack" style="flex-wrap:nowrap">${x.utr ? `<span class="utr">${esc(x.utr)}</span>` : x.shot && x.shot !== 'demo' ? `<a class="btn btn-ghost btn-sm" href="/api/file/${x.shot}" target="_blank" rel="noopener">${ic('eye')}Screenshot</a>` : '<span class="pill plain">Screenshot</span>'}<b class="tnum" style="min-width:60px;text-align:right">${inr(x.amt)}</b></span><span class="hstack" style="flex-wrap:nowrap"><button class="btn btn-quiet btn-sm" type="button" data-act="reject" data-id="${x.id}">Reject</button><button class="btn btn-primary btn-sm" type="button" data-act="approve" data-id="${x.id}">${ic('ok')}Approve</button></span></div></div>`; }).join('') : `<div class="empty">No payments waiting. New ones show here the moment a parent sends one.</div>`}</div></div>`;
}
function staffTodayCard(link) {
  const list = B.staff;
  return `<div class="card"><div class="card-h"><div><h3>Coaches today</h3><div class="sub">Check-in times</div></div>${link ? `<a class="btn btn-quiet btn-sm" href="${link}">Open</a>` : ''}</div>
  <div class="list">${list.length ? list.map(s => { const a = s.today; return `<div class="row"><div class="who grow">${av(s.name, 'sm')}<div><b>${esc(s.name)}</b><small>${esc(s.title)}</small></div></div>${!a ? '<span class="pill p-mute plain">Not in yet</span>' : a.s === 'H' ? '<span class="pill p-info plain">On leave</span>' : a.s === 'off' ? '<span class="pill p-mute plain">Day off</span>' : a.s === 'A' ? '<span class="pill p-bad">Absent</span>' : `<span class="pill ${a.s === 'L' ? 'p-warn' : 'p-ok'} tnum">${a.s === 'L' ? 'Late · ' : ''}${a.t}</span>`}</div>`; }).join('') : `<div class="empty">No coaches added yet.</div>`}</div></div>`;
}
function lowCard() {
  const low = B.players.filter(p => p.att != null && p.attN >= 3 && p.att < 65);
  return `<div class="card"><div class="card-h"><div><h3>Low attendance</h3><div class="sub">Below 65% this month</div></div><span class="pill ${low.length ? 'p-bad' : 'p-ok'} plain">${low.length}</span></div>
  <div class="list">${low.length ? low.map(p => `<div class="row"><div class="who grow">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(batch(p.batch).name)}</small></div></div>${attPill(p.att)}</div>`).join('') : '<div class="empty">Nobody below 65%.</div>'}</div></div>`;
}
function birthdaysCard() {
  const soon = B.players.filter(p => p.dob).map(p => { for (let i = 0; i < 8; i++) { const d = T.add(B.today, i); if (d.slice(5) === p.dob.slice(5)) return { p, d, age: +d.slice(0, 4) - +p.dob.slice(0, 4) }; } return null; }).filter(Boolean);
  if (!soon.length) return '';
  return `<div class="card"><div class="card-h"><h3>Birthdays this week</h3>${ic('gift')}</div><div class="list">${soon.map(({ p, d, age }) => `<div class="row"><div class="who grow">${jersey(p)}<div><b>${esc(p.name)}</b><small>Turns ${age} · ${d === B.today ? 'Today' : T.dayShort(d)}</small></div></div><button class="btn btn-quiet btn-sm" type="button" data-act="wish" data-p="${p.id}">Send wishes</button></div>`).join('')}</div></div>`;
}
function trendCard() {
  const vals = B.trend.filter(x => x[1] != null).map(x => x[1]); const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  return `<div class="card"><div class="card-h"><div><h3>Attendance, last 14 days</h3><div class="sub">All batches</div></div><span class="mono faint" style="font-size:12px">${avg == null ? 'NO DATA YET' : 'AVG ' + avg + '%'}</span></div>
  <div class="card-b"><div class="bars">${B.trend.map(([d, v]) => `<div class="b"><i class="${v != null && v < 80 ? 'lo' : ''}" style="height:${v != null ? Math.max(8, (v - 50) * 2) : 4}%;${v != null ? '' : 'background:var(--line)'}" title="${T.dayShort(d)}: ${v != null ? v + '%' : 'no sessions'}"></i><small>${+d.slice(8)}</small></div>`).join('')}</div></div></div>`;
}
function markCard(bid, role, day) {
  const b = batch(bid), list = B.players.filter(p => p.batch === bid && !p.brk);
  const iso = day === 'yesterday' ? B.yesterday : B.today;
  const saved = day === 'yesterday' ? (B.attYesterday || {})[bid] : todayMarks(bid);
  const key = bid + '|' + iso;
  if (!U.draft[key]) U.draft[key] = Object.assign({}, saved ? saved.marks : {});
  const m = U.draft[key], t = tally(bid, m);
  const dirty = !saved || list.some(p => m[p.id] !== saved.marks[p.id]);
  const off = !C.isOn(b, iso);
  return `<div class="card"><div class="card-h"><div><h3>${esc(b.name)} · ${T.t12(b.time)}</h3><div class="sub">${T.dayShort(iso)} · ${esc(ground(b.ground).name)} · ${esc(coachName(b))}</div></div>${saved ? `<span class="pill ${dirty ? 'p-warn' : 'p-ok'}">${dirty ? 'Changed, not saved' : 'Saved ' + T.clock(saved.at) + ' · ' + esc(first(saved.by))}</span>` : '<span class="pill p-warn">Not saved</span>'}</div>
  ${off ? `<div class="note" style="margin:12px 20px 0">${ic('calendar')}<span>${esc(b.name)} has no session on ${T.dayShort(iso)}. You can still mark it if you trained.</span></div>` : ''}
  ${list.length ? `<div class="mark-list">${list.map(p => { const v = m[p.id]; return `<div class="mark"><div class="who">${jersey(p)}<div><b>${esc(p.name)}</b><small>#${p.no} · ${p.att == null ? 'new this month' : p.att + '% this month'}</small></div></div><div class="pal" role="group" aria-label="${esc(p.name)}">${['P', 'L', 'A'].map(x => `<button type="button" data-act="mark" data-k="${key}" data-p="${p.id}" data-v="${x}" aria-pressed="${v === x}" ${v === x ? `data-on="${x}"` : ''} aria-label="${{ P: 'Present', L: 'Late', A: 'Absent' }[x]}">${x}</button>`).join('')}</div></div>`; }).join('')}</div>
  <div class="sum-bar"><div class="tally"><span><span class="dot" style="background:var(--brand)"></span> Present <b>${t.P}</b></span><span><span class="dot" style="background:var(--warn)"></span> Late <b>${t.L}</b></span><span><span class="dot" style="background:var(--bad)"></span> Absent <b>${t.A}</b></span><span class="faint">of ${t.n}</span></div>
  <div class="hstack fill-sm"><button class="btn btn-ghost btn-sm" type="button" data-act="allP" data-k="${key}" data-b="${bid}">All present</button><button class="btn btn-primary btn-sm" type="button" data-act="saveAtt" data-k="${key}" data-b="${bid}" data-d="${iso}" ${B.plan.active ? '' : 'disabled'}>${ic('ok')}Save and tell parents</button></div></div>` : `<div class="card-b">${empty('players', 'No players in this batch yet.', role === 'admin' || role === 'manager' ? `<button class="btn btn-primary btn-sm" type="button" data-act="addPlayer" data-b="${bid}">${ic('plus')}Add player</button>` : '')}</div>`}</div>`;
}
function batchPicker(cur, ids, act) {
  if (!ids.length) return '';
  return `<div class="seg" role="group" aria-label="Batch" style="max-width:100%;overflow-x:auto">${ids.map(id => `<button type="button" data-act="${act || 'pickBatch'}" data-b="${id}" aria-pressed="${cur === id}">${esc(batch(id).name)}</button>`).join('')}</div>`;
}
function staffMark(canEdit) {
  const adm = B.me.role === 'admin'; const d = adm && U.sday && U.sday <= B.today && U.sday.slice(0, 7) === B.month ? U.sday : B.today; const past = d !== B.today;
  const rec = s => (past ? (s.cal || {})[d] : s.today) || {};
  return `<div class="card glow"><div class="card-h" style="flex-wrap:wrap"><div><h3>Coach & staff attendance</h3><div class="sub">${T.long(d)} · ${past ? 'changing an earlier day' : 'arrival time is saved with each mark'}</div></div>${adm ? `<input class="input" type="date" id="sday" aria-label="Day" value="${d}" min="${B.month}-01" max="${B.today}" style="width:auto">` : ''}</div>
  ${B.staff.length ? `<div class="mark-list">${B.staff.map(s => { const a = rec(s); return `<div class="mark"><div class="who">${av(s.name)}<div><b>${esc(s.name)}</b><small>${esc(s.title)} · ${a.s === 'H' ? 'On leave' + (a.paid ? ' (paid)' : '') : a.s === 'off' ? 'Day off' : a.t ? 'In at ' + a.t : a.s === 'P' || a.s === 'L' ? 'Present' : a.s === 'A' ? 'Absent' : past ? 'Not marked' : 'Not in yet'} · ${s.days}/${s.of} this month${s.leave ? ` · ${s.leave} leave` : ''}</small></div></div>${canEdit ? (a.s === 'H' ? `<span class="pill p-info plain">Leave</span>` : `<div class="pal pal4" role="group" aria-label="${esc(s.name)}">${['P', 'L', 'A'].map(x => `<button type="button" data-act="smark" data-s="${s.id}" data-d="${d}" data-v="${x}" aria-pressed="${a.s === x}" ${a.s === x ? `data-on="${x}"` : ''} aria-label="${{ P: 'Present', L: 'Late', A: 'Absent' }[x]}">${x}</button>`).join('')}<button type="button" data-act="smark" data-s="${s.id}" data-d="${d}" data-v="off" aria-pressed="${a.s === 'off'}" title="Day off" style="font-size:11px">Off</button></div>`) : ''}</div>`; }).join('')}</div>` : `<div class="card-b">${empty('whistle', 'Add your coaches and manager first.', B.me.role === 'admin' ? `<button class="btn btn-primary btn-sm" type="button" data-act="addStaff">${ic('plus')}Add coach or manager</button>` : '')}</div>`}
  <div class="sum-bar"><span class="faint" style="font-size:13px">Marks save as you tap.${B.academy.selfCheckin ? ' Coaches can also check in from their own app.' : ''}${adm ? ' For leave or holidays, open Manage on the coach.' : ''}</span></div></div>`;
}

/* ---------- admin ---------- */
function setupSteps() {
  const steps = [[!!B.batches.length, 'Add your batches', 'Days, time, ground and monthly fee', 'admin-batches', 'addBatch'], [!!B.staff.length, 'Add coaches and a manager', 'They get their own login', 'admin-staff', 'addStaff'], [!!B.players.length, 'Add players', 'Parents get the app by email', 'admin-players', 'addPlayer'], [!!B.academy.upi, 'Add your UPI ID', 'So parents can pay fees', 'admin-setup', '']];
  if (steps.every(s => s[0])) return '';
  return `<div class="card glow"><div class="card-h"><div><h3>Set up ${esc(B.academy.name)}</h3><div class="sub">${steps.filter(s => s[0]).length} of 4 done</div></div></div><div class="card-b steps">${steps.map(([done, t, s, href, a], i) => `<div class="step ${done ? 'done' : ''}"><span class="n">${done ? ic('ok') : i + 1}</span><div class="grow"><b>${t}</b><small>${s}</small></div>${done ? '' : a ? `<button class="btn btn-primary btn-sm" type="button" data-act="${a}">Start</button>` : `<a class="btn btn-primary btn-sm" href="#${href}">Start</a>`}</div>`).join('')}</div></div>`;
}
function money() {
  let paid = 0, ver = 0, due = 0, over = 0, nd = 0, no = 0;
  B.players.forEach(p => { const c = p.cur || {}; if (c.st === 'paid') paid += c.amt; else if (c.st === 'verify') ver += c.amt; else if (c.st === 'due') { due += c.amt; nd++; } else if (c.st === 'overdue') { over += c.amt; no++; } });
  B.players.forEach(p => (p.bills || []).forEach(b => { if (b.m < B.month && b.st === 'overdue') { over += b.amt; } }));
  return { paid, ver, due, over, nd, no, total: paid + ver + due + over };
}
function adminHome() {
  const m = money(); const marked = B.sessionsToday.filter(b => todayMarks(b)); let pres = 0, tot = 0; marked.forEach(b => { const t = tally(b, todayMarks(b).marks); pres += t.P + t.L; tot += t.n; });
  const owing = B.players.filter(p => p.owes > 0 && (p.bills || []).some(b => b.st === 'overdue')).length;
  const joined = B.players.filter(p => (p.joined || '').slice(0, 7) === B.month).length;
  return `<div class="page-head"><div><h2>${hello()}, ${esc(first(B.me.name))}</h2><p>${T.long(B.today)} · ${esc(B.academy.name)}</p></div><div class="hstack"><button class="btn btn-ghost" type="button" data-act="cash">${ic('rupee')}Record payment</button><button class="btn btn-primary" type="button" data-act="addPlayer">${ic('plus')}Add player</button></div></div>
  ${setupSteps()}
  <div class="kpis">
    <div class="card kpi"><span class="label">Active players</span><span class="v">${B.players.length}</span><span class="d">${joined ? `<span class="up">+${joined}</span> joined in ${T.monthOnly(B.month)}` : B.batches.length + ' batches'}</span></div>
    <div class="card kpi"><span class="label">Present today</span><span class="v">${tot ? Math.round(pres / tot * 100) : 0}%</span><span class="d">${tot ? `${pres} of ${tot} marked so far` : B.sessionsToday.length ? 'Nothing marked yet' : 'No sessions today'}</span><span class="bar"><i style="width:${tot ? pres / tot * 100 : 0}%"></i></span></div>
    <div class="card kpi"><span class="label">${T.monthOnly(B.month)} fees in</span><span class="v">${inr(m.paid)}</span><span class="d">of ${inr(m.paid + m.ver + m.due + (m.over))} · ${inr(m.ver)} to check</span><span class="bar"><i style="width:${m.total ? m.paid / m.total * 100 : 0}%"></i></span></div>
    <div class="card kpi"><span class="label">Overdue</span><span class="v" style="color:var(--bad)">${inr(m.over)}</span><span class="d">${owing} player${owing === 1 ? '' : 's'} · <a href="#admin-reminders" style="color:var(--brand);font-weight:600">Send reminder</a></span></div>
  </div>
  <div class="grid g-main"><div class="stack">${sessionsCard('admin')}${trendCard()}${feedCard()}</div><div class="stack">${queueCard(true)}${staffTodayCard('#admin-staff')}${lowCard()}${birthdaysCard()}</div></div>`;
}
function feedCard() {
  const f = B.feed.slice(0, 6);
  return `<div class="card"><div class="card-h"><div><h3>Live across your apps</h3><div class="sub">What coaches, the manager and parents just did</div></div><button class="btn btn-quiet btn-sm" type="button" data-act="bell">All</button></div><div class="list">${f.length ? f.map(feedRow).join('') : '<div class="empty">Nothing yet. Activity from every app shows here.</div>'}</div></div>`;
}
function feedRow(f) {
  const seen = U.modal && U.modal.t === 'bell' && U.seenBefore != null ? U.seenBefore : (B.feedSeenAt || 0);
  const tab = (f.href || {})[B.me.role];
  return `<button class="feed-row ${f.at > seen && f.by !== B.me.name ? 'new' : ''}" type="button" ${tab ? `data-act="goto" data-h="${B.me.role}-${tab}"` : ''}><span class="fi">${ic(f.ico || 'bell')}</span><span style="min-width:0"><b>${esc(f.title)}</b><small>${esc(f.sub)}${f.by && f.by !== 'Veyra' ? ' · ' + esc(f.by) : ''}</small></span><time>${when(f.at)}</time></button>`;
}
function playersView(role) {
  const list = B.players.filter(p => (U.pb === 'all' || p.batch === U.pb) && (!U.pq || (p.name + ' ' + (p.parentName || '') + ' ' + (p.parentEmail || '')).toLowerCase().includes(U.pq.toLowerCase())));
  const adm = role === 'admin';
  return `<div class="page-head"><div><h2>Players</h2><p>${B.players.length} active players in ${B.batches.length} batches.</p></div><div class="hstack">${adm ? `<button class="btn btn-ghost" type="button" data-act="importPlayers">${ic('up')}Import</button><button class="btn btn-ghost hide-sm" type="button" data-act="exportPlayers">${ic('down')}Export CSV</button>` : ''}<button class="btn btn-primary" type="button" data-act="addPlayer">${ic('plus')}Add player</button></div></div>
  <div class="card"><div class="card-h" style="flex-wrap:wrap"><div class="toolbar" style="flex:1"><label class="search" for="pq">${ic('search')}<input class="input input-sm" id="pq" type="search" placeholder="Search player or parent" value="${esc(U.pq)}"></label>
    <select class="select select-sm" id="pb" style="width:auto" aria-label="Batch"><option value="all">All batches</option>${B.batches.map(b => `<option value="${b.id}" ${U.pb === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div><span class="faint mono hide-sm" style="font-size:12px">${list.length} SHOWN</span></div>
  ${B.players.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Player</th><th class="hide-sm">Batch</th><th class="hide-sm">Parent</th><th class="hide-xs">Attend.</th>${adm ? `<th>${T.monthShort(B.month)} fee</th><th class="r hide-sm">Fee/mo</th>` : '<th>App</th>'}<th class="hide-sm"></th></tr></thead><tbody>
  ${list.map(p => `<tr data-act="viewPlayer" data-p="${p.id}" style="cursor:pointer"><td><div class="who">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(batch(p.batch).name)} · #${p.no}</small></div></div></td><td class="hide-sm">${esc(batch(p.batch).name)}</td><td class="hide-sm">${esc(p.parentName)}</td><td class="hide-xs">${attPill(p.att)}</td>${adm ? `<td>${feePill((p.cur || {}).st || 'none')}</td><td class="r hide-sm">${inr(p.fee)}</td>` : `<td>${p.hasApp ? '<span class="pill p-ok">Has login</span>' : '<span class="pill p-mute">No email</span>'}</td>`}<td class="r hide-sm"><button class="btn btn-quiet btn-sm" type="button" data-act="viewPlayer" data-p="${p.id}">View</button></td></tr>`).join('') || '<tr><td colspan="7"><div class="empty">No players match.</div></td></tr>'}
  </tbody></table></div>` : `<div class="card-b">${empty('players', B.batches.length ? 'No players yet. Add your first player and their parent gets the app.' : 'Add a batch first, then add players to it.', B.batches.length ? `<button class="btn btn-primary btn-sm" type="button" data-act="addPlayer">${ic('plus')}Add player</button>` : `<button class="btn btn-primary btn-sm" type="button" data-act="addBatch">${ic('plus')}Add batch</button>`)}</div>`}</div>
  ${adm && B.pastPlayers && B.pastPlayers.length ? `<details class="card" style="padding:0"><summary class="card-h" style="cursor:pointer"><h3>Past players</h3><span class="faint mono" style="font-size:12px">${B.pastPlayers.length}</span></summary><div class="list">${B.pastPlayers.map(p => `<div class="row"><div class="grow"><b>${esc(p.name)}</b><small class="faint" style="display:block;font-size:12.5px">Left ${T.full(p.left)}</small></div></div>`).join('')}</div></details>` : ''}`;
}
function attendanceView(role) {
  const staffOk = role === 'admin'; const mode = staffOk ? U.attMode : 'players';
  const ids = B.batches.map(b => b.id);
  const dayIso = U.attDay === 'yesterday' ? B.yesterday : B.today;
  if (!ids.includes(U.attBatch)) U.attBatch = (B.batches.filter(b => C.isOn(b, dayIso)).find(b => !(U.attDay === 'yesterday' ? (B.attYesterday || {})[b.id] : todayMarks(b.id))) || B.batches.find(b => C.isOn(b, dayIso)) || B.batches[0] || {}).id || '';
  return `<div class="page-head"><div><h2>${role === 'manager' ? 'Player attendance' : 'Attendance'}</h2><p>${role === 'admin' ? 'You can mark or change any batch.' : 'Change any mark a coach got wrong.'}</p></div>
    <div class="hstack">${mode === 'players' ? `<div class="seg" role="group" aria-label="Day"><button type="button" data-act="attDay" data-v="today" aria-pressed="${U.attDay === 'today'}">Today</button><button type="button" data-act="attDay" data-v="yesterday" aria-pressed="${U.attDay === 'yesterday'}">Yesterday</button></div>` : ''}${staffOk ? `<div class="seg" role="group" aria-label="Who"><button type="button" data-act="attMode" data-v="players" aria-pressed="${mode === 'players'}">Players</button><button type="button" data-act="attMode" data-v="staff" aria-pressed="${mode === 'staff'}">Coaches & staff</button></div>` : ''}</div></div>
  ${mode === 'staff' ? staffMark(true) : B.batches.length ? `${batchPicker(U.attBatch, ids)}${markCard(U.attBatch, role, U.attDay)}` : `<div class="card"><div class="card-b">${empty('batch', 'Add a batch first.', role === 'admin' ? `<button class="btn btn-primary btn-sm" type="button" data-act="addBatch">${ic('plus')}Add batch</button>` : '')}</div></div>`}`;
}
function feeMonths() { const s = new Set([B.month]); B.players.forEach(p => (p.bills || []).forEach(b => s.add(b.m))); return [...s].sort().reverse().slice(0, 12); }
function feesView() {
  const months = feeMonths(); if (!months.includes(U.feeMonth)) U.feeMonth = B.month;
  const M = U.feeMonth; const f = U.feeFilter;
  const rows = B.players.map(p => ({ p, b: (p.bills || []).find(b => b.m === M) })).filter(x => x.b);
  const sum = s => rows.filter(x => x.b.st === s).reduce((t, x) => t + x.b.amt, 0);
  const tot = rows.reduce((t, x) => t + x.b.amt, 0) || 1;
  const list = rows.filter(x => f === 'all' || x.b.st === f);
  return `<div class="page-head"><div><h2>Fees & billing</h2><p>Due on the ${ord(B.academy.dueDay)} · late fee ${inr(B.academy.lateFee)} after the ${ord(B.academy.lateAfter)} · ${B.academy.upi ? 'UPI ' + esc(B.academy.upi) : '<a href="#admin-setup" style="color:var(--bad);font-weight:600">Add your UPI ID</a>'}</p></div><div class="hstack"><select class="select" id="feeMonth" aria-label="Month" style="width:auto">${months.map(m => `<option value="${m}" ${m === M ? 'selected' : ''}>${T.monthName(m)}</option>`).join('')}</select><button class="btn btn-primary" type="button" data-act="cash">${ic('rupee')}Record payment</button></div></div>
  <div class="kpis">${[['Collected', sum('paid'), 'var(--ok)'], ['To check (UPI)', sum('verify'), 'var(--info)'], ['Due', sum('due'), 'var(--warn)'], ['Overdue', sum('overdue'), 'var(--bad)']].map(([l, v, c]) => `<div class="card kpi"><span class="label">${l}</span><span class="v" style="color:${c}">${inr(v)}</span><span class="bar"><i style="width:${v / tot * 100}%;background:${c}"></i></span></div>`).join('')}</div>
  ${queueCard()}
  <div class="card"><div class="card-h" style="flex-wrap:wrap"><h3>${T.monthName(M)} bills</h3><div class="seg" role="group" aria-label="Filter" style="max-width:100%;overflow-x:auto">${[['all', 'All'], ['paid', 'Paid'], ['verify', 'To check'], ['due', 'Due'], ['overdue', 'Overdue']].map(([k, l]) => `<button type="button" data-act="feeFilter" data-v="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div></div>
  ${rows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Player</th><th class="hide-sm">Parent</th><th>Status</th><th class="r">Amount</th><th class="r"></th></tr></thead><tbody>
  ${list.map(({ p, b }) => `<tr><td><div class="who">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(batch(p.batch).name)}${b.receipt ? ' · ' + b.receipt : ''}</small></div></div></td><td class="hide-sm">${esc(p.parentName)}</td><td>${feePill(b.st)}</td><td class="r tnum">${inr(b.amt)}${b.late ? '<small class="faint" style="display:block;font-size:11px">incl. late fee</small>' : ''}</td><td class="r"><div class="hstack" style="justify-content:flex-end;flex-wrap:nowrap">${b.st === 'paid' ? `<button class="btn btn-quiet btn-sm" type="button" data-act="receipt" data-p="${p.id}" data-m="${M}">${ic('receipt')}<span class="hide-sm">Receipt</span></button>` : b.st === 'verify' ? `<span class="faint" style="font-size:13px">See above</span>` : b.st === 'waived' ? `<button class="btn btn-quiet btn-sm" type="button" data-act="waive" data-p="${p.id}" data-m="${M}">Undo</button>` : `<button class="btn btn-ghost btn-sm" type="button" data-act="markPaid" data-p="${p.id}" data-m="${M}">Mark paid</button><button class="btn btn-quiet btn-sm hide-sm" type="button" data-act="waive" data-p="${p.id}" data-m="${M}">Waive</button>`}</div></td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">Nothing here.</div></td></tr>'}
  </tbody></table></div>` : `<div class="card-b">${empty('rupee', 'No bills yet. Bills appear for every player each month.')}</div>`}</div>`;
}
function remindersView() {
  const S = B.academy.settings;
  const targets = B.players.filter(p => (p.bills || []).some(b => b.st === 'due' || b.st === 'overdue'));
  const p = targets[0]; const b = p && p.bills.find(x => x.st === 'due' || x.st === 'overdue');
  const prev = p ? C.fillTpl({ settings: S, name: B.academy.name }, { name: p.name, parentName: p.parentName }, b, p.owes) : 'Nobody owes anything right now.';
  return `<div class="page-head"><div><h2>Fee reminders</h2><p>Reminders go out on their own at 9:00 AM. You can also send them now.</p></div><button class="btn btn-primary" type="button" data-act="sendNow" ${targets.length ? '' : 'disabled'}>${ic('bell')}Remind ${targets.length} parent${targets.length === 1 ? '' : 's'} now</button></div>
  <div class="grid g2 g2-wide"><div class="stack">
    <div class="card"><div class="card-h"><h3>When to remind</h3></div>${[['before', '3 days before the due date', 'Gentle heads-up'], ['due', 'On the due date', '“Due today”'], ['after', '3 days after the due date', 'Mentions the late fee'], ['weekly', 'Every 7 days while overdue', 'Stops once paid']].map(([k, t, s]) => `<label class="rule" for="r-${k}"><div class="grow"><b>${t}</b><small>${s}</small></div><span class="switch"><input type="checkbox" id="r-${k}" data-rule="${k}" ${S.rules[k] ? 'checked' : ''}><i></i></span></label>`).join('')}</div>
    <div class="card"><div class="card-h"><h3>How to send</h3></div>${[['app', 'App notification', 'Shows in the parent app bell'], ['email', 'Email', LIVE && !CFG.mail ? 'Needs email set up by Veyra' : 'From Veyra Academy, in your academy name'], ['wa', 'WhatsApp message', 'Opens WhatsApp with the text ready, one parent at a time']].map(([k, t, s]) => `<label class="rule" for="c-${k}"><div class="grow"><b>${t}</b><small>${s}</small></div><span class="switch"><input type="checkbox" id="c-${k}" data-chan="${k}" ${S.chan[k] ? 'checked' : ''}><i></i></span></label>`).join('')}</div>
  </div><div class="stack">
    <div class="card"><div class="card-h"><h3>Message</h3><span class="faint" style="font-size:12.5px">{parent} {player} {month} {amount} {due}</span></div><div class="card-b" style="display:grid;gap:16px"><label class="field" for="tpl"><span class="sr">Message text</span><textarea class="textarea" id="tpl" rows="5">${esc(S.tpl)}</textarea></label><span class="label">Preview</span><div class="bubble-msg" id="tplPrev">${esc(prev)}</div></div><div class="card-f"><button class="btn btn-primary btn-sm" type="button" data-act="saveTpl">Save message</button></div></div>
    <div class="card"><div class="card-h"><h3>Who gets it now</h3><span class="pill p-warn plain">${targets.length}</span></div><div class="list">${targets.length ? targets.map(p => `<div class="row"><div class="who grow">${av(p.parentName, 'sm')}<div><b>${esc(p.parentName)}</b><small>for ${esc(p.name)} · ${inr(p.owes)}</small></div></div>${feePill(p.bills.find(x => x.st === 'overdue') ? 'overdue' : 'due')}<button class="btn btn-quiet btn-sm" type="button" data-act="remindOne" data-p="${p.id}">Remind</button></div>`).join('') : '<div class="empty">Everyone has paid.</div>'}</div></div>
  </div></div>`;
}
function staffView() {
  return `<div class="page-head"><div><h2>Coaches & staff</h2><p>Each person logs in with their own email or Google account.</p></div><button class="btn btn-primary" type="button" data-act="addStaff">${ic('plus')}Add coach or manager</button></div>
  <div class="card">${B.staff.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Name</th><th class="hide-sm">Role</th><th class="hide-sm">Batches</th><th>This month</th><th class="hide-xs">Today</th><th></th></tr></thead><tbody>
  ${B.staff.map(s => { const a = s.today; const bs = B.batches.filter(b => b.coach === s.id).map(b => b.name).join(', ') || (s.role === 'manager' ? 'All batches' : 'None yet'); return `<tr><td><div class="who">${av(s.name)}<div><b>${esc(s.name)}</b><small>${esc(s.email || '')}</small></div></div></td><td class="hide-sm"><span class="pill ${s.role === 'manager' ? 'p-info' : 'p-brand'} plain">${esc(s.title)}</span></td><td class="hide-sm">${esc(bs)}</td><td class="tnum">${s.days}/${s.of} days</td><td class="hide-xs">${!a ? '<span class="pill p-mute plain">Not in</span>' : a.s === 'H' ? '<span class="pill p-info plain">On leave</span>' : a.s === 'off' ? '<span class="pill p-mute plain">Day off</span>' : a.s === 'A' ? '<span class="pill p-bad">Absent</span>' : `<span class="pill ${a.s === 'L' ? 'p-warn' : 'p-ok'} tnum">${a.t}</span>`}</td><td class="r"><button class="btn btn-quiet btn-sm" type="button" data-act="editStaff" data-s="${s.id}">Manage</button></td></tr>`; }).join('')}
  </tbody></table></div>` : `<div class="card-b">${empty('whistle', 'No coaches yet. Add one and they get their own login.', `<button class="btn btn-primary btn-sm" type="button" data-act="addStaff">${ic('plus')}Add coach or manager</button>`)}</div>`}</div>${B.staff.length ? staffMark(true) : ''}`;
}
function parentsView() {
  const map = {}; B.players.forEach(p => { const k = p.parentEmail || 'n:' + p.parentName; (map[k] = map[k] || { name: p.parentName, email: p.parentEmail, phone: p.parentPhone, app: p.hasApp, kids: [] }).kids.push(p); });
  const rows = Object.values(map);
  return `<div class="page-head"><div><h2>Parents</h2><p>${rows.length} families · ${rows.filter(r => r.app).length} have a login</p></div></div>
  <div class="card">${rows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Parent</th><th class="hide-sm">Children</th><th class="hide-xs">Login</th><th>Owes</th><th></th></tr></thead><tbody>
  ${rows.map(r => { const owe = r.kids.reduce((t, k) => t + (k.owes || 0), 0); return `<tr><td><div class="who">${av(r.name)}<div><b>${esc(r.name)}</b><small>${esc(r.email || 'No email yet')}</small></div></div></td><td class="hide-sm">${r.kids.map(k => esc(first(k.name))).join(', ')}</td><td class="hide-xs">${r.app ? '<span class="pill p-ok">Has login</span>' : '<span class="pill p-mute">No email</span>'}</td><td class="tnum">${owe ? `<b style="color:var(--bad)">${inr(owe)}</b>` : '<span class="faint">Nothing</span>'}</td><td class="r"><div class="hstack" style="justify-content:flex-end;flex-wrap:nowrap">${owe ? `<button class="btn btn-quiet btn-sm" type="button" data-act="remindOne" data-p="${r.kids[0].id}">Remind</button>` : ''}${r.app ? `<button class="btn btn-quiet btn-sm" type="button" data-act="parentReset" data-p="${r.kids[0].id}">New password</button>` : `<button class="btn btn-quiet btn-sm" type="button" data-act="viewPlayer" data-p="${r.kids[0].id}">Add email</button>`}</div></td></tr>`; }).join('')}
  </tbody></table></div>` : `<div class="card-b">${empty('parent', 'Parents appear here when you add players with a parent email.')}</div>`}</div>`;
}

function batchesView(role) {
  return `<div class="page-head"><div><h2>Batches</h2><p>${B.batches.length} batch${B.batches.length === 1 ? '' : 'es'} across ${B.grounds.length} ground${B.grounds.length === 1 ? '' : 's'}.</p></div>${role === 'admin' ? `<button class="btn btn-primary" type="button" data-act="addBatch">${ic('plus')}New batch</button>` : ''}</div>
  ${B.batches.length ? `<div class="grid g3">${B.batches.map(b => { const n = B.players.filter(p => p.batch === b.id); const v = n.filter(p => p.att != null); const avg = v.length ? Math.round(v.reduce((t, p) => t + p.att, 0) / v.length) : null; return `<article class="card" style="overflow:hidden"><div style="height:6px;background:${TINT[b.tint]}"></div><div class="card-b" style="display:grid;gap:14px">
    <div class="between"><div><h3 style="font-size:20px">${esc(b.name)}</h3><span class="faint" style="font-size:13px">${esc(b.age || '')}</span></div><span class="pill p-mute plain tnum">${n.length} players</span></div>
    <dl class="kv" style="font-size:13.5px"><dt>Days</dt><dd>${C.daysText(b.days)}</dd><dt>Time</dt><dd>${T.t12(b.time)} · ${b.mins || 60} min</dd><dt>Ground</dt><dd>${esc(ground(b.ground).name)}</dd><dt>Coach</dt><dd>${esc(coachName(b))}</dd><dt>Fee</dt><dd>${inr(b.fee)}/mo</dd><dt>Attendance</dt><dd>${avg == null ? '—' : avg + '%'}</dd></dl>
    ${(b.off || []).filter(d => d >= B.today).length ? `<div class="note">${ic('calendar')}<span>No session on ${(b.off || []).filter(d => d >= B.today).map(T.dayShort).join(', ')}</span></div>` : ''}
    <div class="hstack"><a class="btn btn-ghost btn-sm" href="#${role}-attendance" data-act="pickBatchGo" data-b="${b.id}">${ic('check')}Attendance</a>${role === 'admin' ? `<button class="btn btn-quiet btn-sm" type="button" data-act="editBatch" data-b="${b.id}">Edit</button>` : ''}<button class="btn btn-quiet btn-sm" type="button" data-act="cancelSession" data-b="${b.id}">Cancel a session</button></div></div></article>`; }).join('')}</div>` : `<div class="card"><div class="card-b">${empty('batch', 'No batches yet. A batch is a group that trains together, like U-10 on Mon, Wed and Fri at 7:30 AM.', role === 'admin' ? `<button class="btn btn-primary btn-sm" type="button" data-act="addBatch">${ic('plus')}Add your first batch</button>` : '')}</div></div>`}`;
}
const STAGES = [{ id: 'enquiry', name: 'Enquiry', t: 'blue' }, { id: 'trial', name: 'Trial booked', t: 'green' }, { id: 'fees', name: 'First fee pending', t: 'red' }, { id: 'enrolled', name: 'Joined', t: 'slate' }];
function admissionsView() {
  const c = s => B.adm.filter(a => a.s === s); const thisM = a => T.date(a.at).slice(0, 7) === B.month;
  return `<div class="page-head"><div><h2 class="disp" style="font-size:clamp(30px,4vw,44px)">From first call <em>to the pitch</em></h2><p>Every enquiry, trial and first fee on one board. Drag a card to move a player.</p></div>
    <div class="toolbar"><label class="search" for="aq">${ic('search')}<input class="input" id="aq" type="search" placeholder="Search" value="${esc(U.aq)}"></label><button class="btn btn-primary" type="button" data-act="addEnq">${ic('plus')}Add enquiry</button></div></div>
  <div class="kpis">${[['Enquiries', c('enquiry').length, 'Waiting for a trial'], ['Trials booked', c('trial').length, 'Coming up'], ['First fees pending', inr(c('fees').reduce((t, a) => t + a.fee, 0)), c('fees').length + ' players'], ['Joined this month', c('enrolled').filter(thisM).length, 'From this board']].map(([l, v, d]) => `<div class="card kpi"><span class="label">${l}</span><span class="v">${v}</span><span class="d">${d}</span></div>`).join('')}</div>
  <section class="card glow" style="padding:14px;border-radius:20px"><div class="between" style="padding:2px 4px 12px"><h3 style="font-size:17px">Admissions pipeline</h3><span class="faint" style="font-size:12.5px">Drag, or focus a card and press ← →. Tap a card to edit or enrol.</span></div><div class="board" id="board">${boardHTML()}</div></section>`;
}
function boardHTML(dropId) {
  return STAGES.map((st, k) => { const list = B.adm.filter(a => a.s === st.id && (!U.aq || (a.n + ' ' + a.parent).toLowerCase().includes(U.aq.toLowerCase())));
    return `<div class="col" data-stage="${st.id}" style="--c:${TINT[st.t]}"><div class="col-head"><span class="bar"></span><h3>${st.name}</h3><span class="n">${list.length}</span><span class="sum">${inr(list.reduce((t, a) => t + a.fee, 0))}</span></div>
    <div class="drop">${list.length ? list.map(a => `<article class="adm ${dropId === a.id ? 'dropped' : ''}" tabindex="0" data-id="${a.id}" style="--c:${TINT[st.t]}" aria-label="${esc(a.n)}, ${st.name}"><div class="top-r"><div class="who"><div><b>${esc(a.n)}</b><small>${esc(a.parent ? 'Parent: ' + a.parent : a.phone || '')}</small></div></div><span class="age">${esc(a.age)}</span></div><div class="meta"><span class="fee">${inr(a.fee)}<small>/mo</small></span>${chev(k + 1)}</div><div class="meta"><span>${esc(a.src)} · ${st.id === 'trial' && a.trial ? esc(a.trial) : when(a.at)}</span>${k < 3 ? `<button class="next" type="button" data-act="nextStage" data-id="${a.id}">Next ${ic('arrow')}</button>` : a.pid ? '' : `<button class="next" type="button" data-act="enrol" data-id="${a.id}">Add ${ic('plus')}</button>`}</div></article>`).join('') : `<div class="empty">${U.aq ? 'No match' : 'Drop a player here'}</div>`}</div></div>`; }).join('');
}
function noticesView(canPost) {
  const role = B.me.role;
  const opts = role === 'coach' ? B.batches.filter(b => B.myBatches.includes(b.id)) : B.batches;
  const upcoming = [];
  B.tournaments.forEach(t => t.matches.forEach(m => { if (m.date >= B.today && !m.score) upcoming.push({ t, m }); }));
  upcoming.sort((a, b) => (a.m.date + a.m.time).localeCompare(b.m.date + b.m.time));
  const toName = n => n.to === 'all' ? 'All parents' : n.to === 'coaches' ? 'Coaches' : batch(n.to).name;
  return `${canPost ? `<div class="card"><div class="card-h"><h3>Post a notice</h3></div><form class="card-b" id="noticeForm" style="display:grid;gap:14px">
    <div class="grid g2"><label class="field" for="n-title"><span>Title</span><input class="input" id="n-title" placeholder="e.g. Kit day on Saturday" required></label>
    <label class="field" for="n-to"><span>Send to</span><select class="select" id="n-to">${role === 'coach' ? '' : '<option value="all">All parents</option>'}${opts.map(b => `<option value="${b.id}">${esc(b.name)} parents</option>`).join('')}${role === 'coach' ? '' : '<option value="coaches">Coaches only</option>'}</select></label></div>
    <label class="field" for="n-body"><span>Message</span><textarea class="textarea" id="n-body" placeholder="What should they know?"></textarea></label>
    <div class="between"><span class="faint" style="font-size:13px">It shows in their app straight away${B.academy.settings.chan && B.academy.settings.chan.email ? ' and goes by email' : ''}.</span><button class="btn btn-primary" type="submit" ${B.plan.active ? '' : 'disabled'}>${ic('megaphone')}Post notice</button></div></form></div>` : ''}
  <div class="grid g-main"><div class="card"><div class="card-h"><h3>Notices</h3><span class="faint mono" style="font-size:12px">${B.notices.length}</span></div><div class="list">${B.notices.length ? B.notices.map(n => `<div class="notice"><div class="hstack"><span class="pill p-brand plain">${esc(n.tag)}</span><span>${when(n.at)} · ${esc(toName(n))} · ${esc(n.by)}</span>${(role === 'admin' || role === 'manager') ? `<button class="btn btn-quiet btn-sm" type="button" data-act="delNotice" data-id="${n.id}" style="margin-left:auto">Remove</button>` : ''}</div><b>${esc(n.title)}</b>${n.body ? `<p>${esc(n.body)}</p>` : ''}</div>`).join('') : '<div class="empty">No notices yet.</div>'}</div></div>
  <div class="card"><div class="card-h"><h3>Coming up</h3>${ic('trophy')}</div><div class="list">${upcoming.length ? upcoming.slice(0, 6).map(({ t, m }) => `<div class="session" style="grid-template-columns:76px minmax(0,1fr)"><time>${T.dayShort(m.date).replace(' ', '<br>')}</time><div style="min-width:0"><b>vs ${esc(m.vs)}</b><small>${esc(t.name)}${m.time ? ' · ' + T.t12(m.time) : ''} · ${esc(m.venue)}</small></div></div>`).join('') : '<div class="empty">No matches coming up.</div>'}</div></div></div>`;
}
function reportsView() {
  const max = Math.max(1, ...B.revenue.map(r => r[1]));
  const first_ = B.revenue.find(r => r[1] > 0), last = B.revenue[B.revenue.length - 1];
  const growth = first_ && first_ !== last && first_[1] ? Math.round((last[1] - first_[1]) / first_[1] * 100) : null;
  return `<div class="page-head"><div><h2>Reports</h2><p>${T.monthName(B.revenue[0][0])} to ${T.monthName(B.month)}</p></div><div class="hstack"><button class="btn btn-ghost" type="button" data-act="exportFees">${ic('down')}Fees CSV</button><button class="btn btn-ghost" type="button" data-act="exportAtt">${ic('down')}Attendance CSV</button></div></div>
  <div class="grid g2"><div class="card"><div class="card-h"><div><h3>Fees collected</h3><div class="sub">By the month the money came in</div></div>${growth != null ? `<span class="pill ${growth >= 0 ? 'p-ok' : 'p-bad'} plain">${growth >= 0 ? '+' : ''}${growth}% since ${T.monthShort(first_[0])}</span>` : ''}</div><div class="card-b"><div class="bars" style="height:200px">${B.revenue.map(([m, v], i) => `<div class="b"><i style="height:${Math.max(2, v / max * 100)}%;${i === B.revenue.length - 1 ? 'box-shadow:0 0 18px var(--brand)' : ''}" title="${inr(v)}"></i><small>${T.monthShort(m)} · ${v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v >= 1000 ? Math.round(v / 1000) + 'k' : v}</small></div>`).join('')}</div></div></div>
  <div class="card"><div class="card-h"><div><h3>Attendance by batch</h3><div class="sub">${T.monthName(B.month)} average</div></div></div><div class="card-b" style="display:grid;gap:16px">${B.batches.length ? B.batches.map(b => { const n = B.players.filter(p => p.batch === b.id && p.att != null); const v = n.length ? Math.round(n.reduce((t, p) => t + p.att, 0) / n.length) : 0; return `<div class="hbar"><span>${esc(b.name)}</span><span class="track"><i style="width:${v}%;background:${TINT[b.tint]}"></i></span><b>${n.length ? v + '%' : '—'}</b></div>`; }).join('') : '<div class="empty">No batches yet.</div>'}</div></div></div>
  <div class="grid g3">${[['Paid on time', B.onTimeRate == null ? '—' : B.onTimeRate + '%', 'Last month, by the late-fee date'], ['Active players', B.players.length, (B.pastPlayers || []).length + ' have left'], ['Trial to joined', B.trialRate == null ? '—' : B.trialRate + '%', 'From the admissions board']].map(([l, v, d]) => `<div class="card kpi"><span class="label">${l}</span><span class="v">${v}</span><span class="d">${d}</span></div>`).join('')}</div>`;
}
function setupView() {
  const y = U.planSel === 'yearly', P = B.plan, pr = CFG.plans;
  const save = pr.monthly * 12 - pr.yearly;
  return `<div class="page-head"><div><h2>Settings & plan</h2><p>${esc(B.academy.name)}</p></div></div>
  <section class="card glow"><div class="card-h"><div><h3>Your plan</h3><div class="sub">${P.type === 'trial' ? 'Free trial' : P.type === 'yearly' ? 'Yearly plan' : 'Monthly plan'} · ${P.active ? `${P.daysLeft} day${P.daysLeft === 1 ? '' : 's'} left · ends ${T.full(T.date(P.until))}` : 'ended ' + T.full(T.date(P.until))}</div></div><span class="pill ${!P.active ? 'p-bad' : P.type === 'trial' ? 'p-warn' : 'p-ok'}">${!P.active ? 'Ended' : P.type === 'trial' ? 'Trial' : 'Active'}</span></div>
  <div class="card-b" style="display:grid;gap:16px"><div class="grid g2">
    <button class="plan-opt" type="button" data-act="plan" data-v="monthly" aria-pressed="${!y}"><span class="between"><span class="label">Monthly</span></span><span class="amt">${inr(pr.monthly)}<small>/month</small></span><span class="faint" style="font-size:13px">30 days, pay again when it ends</span></button>
    <button class="plan-opt" type="button" data-act="plan" data-v="yearly" aria-pressed="${y}"><span class="between"><span class="label">Yearly</span>${save > 0 ? `<span class="pill p-brand plain">Save ${inr(save)}</span>` : ''}</span><span class="amt">${inr(pr.yearly)}<small>/year</small></span><span class="faint" style="font-size:13px">${inr(Math.round(pr.yearly / 12))} a month</span></button></div>
    <div class="between"><span class="faint" style="font-size:13px">${ic('shield', '')} Secure payment by Razorpay: UPI, cards, net banking. No GST added.${P.active && P.type !== 'trial' ? ' Days are added on top of what you have left.' : ''}</span><button class="btn btn-primary btn-lg" type="button" data-act="buyPlan">Pay ${y ? inr(pr.yearly) : inr(pr.monthly)} with Razorpay</button></div>
    <div class="divider"></div><div class="between"><label class="field" for="lic" style="flex:1;min-width:220px"><span>Have a licence key from Veyra?</span><input class="input mono" id="lic" placeholder="VFB-XXXX-XXXX-XXXX" autocomplete="off"></label><button class="btn btn-ghost" type="button" data-act="lic" style="align-self:end">${ic('key')}Activate key</button></div></div></section>
  <div class="grid g2 g2-wide" style="align-items:start"><div class="card"><div class="card-h"><h3>Fee collection</h3></div><div class="card-b" style="display:grid;gap:14px">
    <label class="field" for="s-upi"><span>Academy UPI ID</span><input class="input mono" id="s-upi" value="${esc(B.academy.upi)}" placeholder="yourname@okaxis"></label>
    <label class="field" for="s-payee"><span>Name parents see</span><input class="input" id="s-payee" value="${esc(B.academy.payee)}"></label>
    <div class="grid g3"><label class="field" for="s-due"><span>Due on day</span><input class="input" id="s-due" inputmode="numeric" value="${B.academy.dueDay}"></label><label class="field" for="s-lateafter"><span>Late after day</span><input class="input" id="s-lateafter" inputmode="numeric" value="${B.academy.lateAfter}"></label><label class="field" for="s-late"><span>Late fee (₹)</span><input class="input" id="s-late" inputmode="numeric" value="${B.academy.lateFee}"></label></div>
    <div class="note">${ic('upi')}<span>Parents pay this UPI ID and paste the transaction ID. You approve it under Fees. Money never passes through Veyra.</span></div>
  </div><div class="card-f"><button class="btn btn-primary btn-sm" type="button" data-act="saveFees">Save</button></div></div>
  <div class="stack"><div class="card"><div class="card-h"><h3>Academy</h3></div><div class="card-b" style="display:grid;gap:14px"><label class="field" for="s-name"><span>Academy name</span><input class="input" id="s-name" value="${esc(B.academy.name)}"></label><label class="field" for="s-place"><span>Area</span><input class="input" id="s-place" value="${esc(B.academy.place)}"></label><label class="field" for="s-sport"><span>Sport</span><select class="select" id="s-sport">${B.sports.map(([k, n]) => `<option value="${k}" ${k === B.academy.sport ? 'selected' : ''}>${n}</option>`).join('')}</select><small class="faint" style="font-size:12.5px">Skills on progress cards and the drill library follow this.</small></label><label class="check" style="display:flex;gap:10px;align-items:flex-start;font-size:14px"><input type="checkbox" id="s-self" ${B.academy.selfCheckin ? 'checked' : ''} style="margin-top:3px"><span>Coaches can check themselves in<small class="faint" style="display:block;font-size:12.5px">Off: only you (and the manager) mark coach attendance.</small></span></label></div><div class="card-f"><button class="btn btn-primary btn-sm" type="button" data-act="saveAcademy">Save</button></div></div>
  <div class="card"><label class="rule" for="s-google"><div class="grow"><b>Sign in with Google</b><small>Coaches and parents can log in with their Google account</small></div><span class="switch"><input type="checkbox" id="s-google" ${B.academy.settings.google ? 'checked' : ''}><i></i></span></label>
  <div class="rule"><div class="grow"><b>Grounds</b><small>${B.grounds.map(g => esc(g.name)).join(', ')}</small></div><a class="btn btn-ghost btn-sm" href="#admin-grounds">${ic('pin')}Manage</a></div>
  <div class="rule"><div class="grow"><b>Install on your phone</b><small>Works like an app on Android, iPhone and laptop</small></div><button class="btn btn-ghost btn-sm" type="button" data-act="install">${ic('phone')}Install</button></div>
  <div class="rule"><div class="grow"><b>Your data</b><small>${LIVE ? 'Backed up every night. Download a full copy any time.' : 'In this preview, data lives in this browser.'}</small></div><button class="btn btn-ghost btn-sm" type="button" data-act="exportAll">${ic('down')}Download all data</button></div></div></div></div>`;
}

/* ---------- manager ---------- */
function managerHome() {
  const notIn = B.staff.filter(s => !s.today && B.batches.some(b => b.coach === s.id && B.sessionsToday.includes(b.id))).length;
  const me = myStaff();
  return `<div class="page-head"><div><h2>${hello()}, ${esc(first(B.me.name))}</h2><p>${T.long(B.today)} · ${esc(B.academy.name)}</p></div><div class="hstack">${B.academy.selfCheckin && me && !(me.today && me.today.t) ? `<button class="btn btn-ghost" type="button" data-act="checkin">${ic('clock')}Check in</button>` : ''}<a class="btn btn-primary" href="#manager-staffatt">${ic('whistle')}Mark coaches</a></div></div>
  <div class="kpis">${[['Coaches in today', B.staff.filter(s => s.today && s.today.t).length + ' of ' + B.staff.filter(s => !s.today || s.today.s !== 'off').length, notIn ? notIn + ' with a session not in yet' : 'Everyone needed is in'], ['Sessions today', B.sessionsToday.length, B.sessionsToday.filter(b => todayMarks(b)).length + ' marked'], ['Trials booked', B.adm.filter(a => a.s === 'trial').length, 'On the admissions board'], ['Low attendance', B.players.filter(p => p.att != null && p.attN >= 3 && p.att < 65).length, 'players below 65%']].map(([l, v, d]) => `<div class="card kpi"><span class="label">${l}</span><span class="v">${v}</span><span class="d">${d}</span></div>`).join('')}</div>
  <div class="grid g-main"><div class="stack">${sessionsCard('manager')}${feedCard()}</div><div class="stack">${staffTodayCard('#manager-staffatt')}${lowCard()}${birthdaysCard()}</div></div>`;
}

/* ---------- coach ---------- */
function coachHome() {
  const me = myStaff() || { today: null }; const a = me.today;
  const mineToday = B.sessionsToday.filter(id => B.myBatches.includes(id));
  const out = B.injuries.filter(i => i.status !== 'fit' && B.myBatches.includes((player(i.pid) || {}).batch));
  const nxt = [];
  B.tournaments.filter(t => B.myBatches.includes(t.batch)).forEach(t => t.matches.forEach(m => { if (!m.score && m.date >= B.today) nxt.push({ t, m }); }));
  nxt.sort((x, y) => (x.m.date + x.m.time).localeCompare(y.m.date + y.m.time));
  return `<div class="hero-card glow"><div class="between"><div><span class="label">${T.long(B.today)}</span><h2 class="disp" style="font-size:40px;margin-top:8px">Hi <em>${esc(first(B.me.name))}</em></h2></div>${av(B.me.name, 'lg')}</div>
  ${B.academy.selfCheckin ? `<div class="checkin"><button class="big ${a && a.t ? 'done' : ''}" type="button" data-act="checkin" ${a && a.t ? 'disabled' : ''}>${a && a.t ? `In at<br>${a.t}` : 'Check in'}</button><span class="faint" style="font-size:13px">${a && a.t ? `The manager can see you are in${a.s === 'L' ? ' (late)' : ''}.` : mineToday.length ? `Tap when you reach ${esc(ground(batch(mineToday[0]).ground).name)}. The time is saved for the manager.` : 'No sessions for you today.'}</span></div>` : `<p class="faint" style="font-size:13px;margin-top:12px">${a && a.s === 'H' ? 'You are on leave today.' : a && (a.s === 'P' || a.s === 'L') ? `Marked present${a.t ? ' at ' + a.t : ''} by the academy.` : 'The academy marks your attendance.'}</p>`}</div>
  ${sessionsCard('coach')}
  ${out.length ? `<div class="card"><div class="card-h"><h3>Injured players</h3><span class="pill p-bad plain">${out.length}</span></div><div class="list">${out.map(i => { const p = player(i.pid); return `<div class="row"><div class="who grow">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(i.what)}${i.back ? ' · back ' + T.short(i.back) : ''}</small></div></div>${i.status === 'out' ? '<span class="pill p-bad">Out</span>' : '<span class="pill p-warn">Light only</span>'}</div>`; }).join('')}</div></div>` : ''}
  ${nxt.length ? `<div class="card"><div class="card-h"><h3>Next match</h3>${ic('trophy')}</div><div class="list"><div class="session" style="grid-template-columns:76px minmax(0,1fr) auto"><time>${T.dayShort(nxt[0].m.date).replace(' ', '<br>')}</time><div style="min-width:0"><b>vs ${esc(nxt[0].m.vs)}</b><small>${esc(nxt[0].t.name)} · ${esc(nxt[0].m.venue)}</small></div><a class="btn btn-quiet btn-sm" href="#coach-matches" data-act="tourn" data-v="${nxt[0].t.id}">Open</a></div></div></div>` : ''}
  <div class="card"><div class="card-h"><h3>Latest notice</h3><a class="btn btn-quiet btn-sm" href="#coach-notices">All</a></div><div class="list">${B.notices.slice(0, 1).map(n => `<div class="notice"><b>${esc(n.title)}</b><p>${esc(n.body)}</p></div>`).join('') || '<div class="empty">No notices.</div>'}</div></div>`;
}
function coachMark() {
  const mine = B.myBatches;
  if (!mine.includes(U.attBatch)) U.attBatch = mine.find(id => B.sessionsToday.includes(id) && !todayMarks(id)) || mine.find(id => B.sessionsToday.includes(id)) || mine[0];
  return `<div class="between"><div><h2 style="font-size:24px">Take attendance</h2><p class="muted" style="margin-top:4px">Tap All present, then change the few who missed.</p></div></div>${mine.length ? batchPicker(U.attBatch, mine) + markCard(U.attBatch, 'coach', 'today') : `<div class="card"><div class="card-b">${empty('batch', 'You have no batches yet. The academy admin gives you batches.')}</div></div>`}`;
}
function calendarHTML(m, cal, days, offs) {
  const [y, mo] = m.split('-').map(Number); const firstDow = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay(); const off = (firstDow + 6) % 7; const cells = [];
  for (let i = 0; i < off; i++) cells.push('<span></span>');
  for (let d = 1; d <= T.days(m); d++) { const iso = `${m}-${String(d).padStart(2, '0')}`; const v = cal[iso]; const train = days.includes(T.dow(iso)) && !(offs || []).includes(iso);
    cells.push(`<span class="d ${v || (train ? (iso < B.today ? 'x' : '') : 'off')} ${iso === B.today ? 'today' : ''}" title="${T.dayShort(iso)}${v ? ': ' + { P: 'Present', L: 'Late', A: 'Absent' }[v] : train ? (iso < B.today ? ': not marked' : ': session') : ''}">${d}</span>`); }
  return `<div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="dow">${x}</span>`).join('')}${cells.join('')}</div>
  <div class="legend"><span><i class="dot" style="background:var(--brand)"></i>Present</span><span><i class="dot" style="background:var(--warn)"></i>Late</span><span><i class="dot" style="background:var(--bad)"></i>Absent</span><span><i class="dot" style="background:var(--surface-2)"></i>No session</span></div>`;
}
function coachMyAtt() {
  const st = B.myMonth || { worked: 0, expected: 0, cal: {}, list: [] };
  const me = myStaff(); const days = me && me.role === 'manager' ? [1, 2, 3, 4, 5, 6] : [...new Set(B.batches.filter(b => b.coach === B.me.sid).flatMap(b => b.days))];
  return `<div class="between"><div><h2 style="font-size:24px">My attendance</h2><p class="muted" style="margin-top:4px">${T.monthName(B.month)} · ${st.worked} of ${st.expected} days</p></div>${attPill(st.expected ? Math.round(st.worked / st.expected * 100) : null)}</div>
  <div class="card"><div class="card-b" style="display:grid;gap:16px">${calendarHTML(B.month, st.cal, days)}</div></div>
  <div class="card"><div class="card-h"><h3>Recent check-ins</h3></div><div class="list">${st.list.length ? st.list.slice(0, 10).map(([d, r]) => `<div class="row"><div class="grow"><b>${T.dayShort(d)}</b></div><span class="pill ${r.s === 'L' ? 'p-warn' : r.s === 'A' ? 'p-bad' : 'p-ok'} tnum">${r.s === 'A' ? 'Absent' : (r.s === 'L' ? 'Late · ' : '') + (r.t || '')}</span></div>`).join('') : '<div class="empty">No check-ins yet this month.</div>'}</div></div>`;
}
function coachProgress() {
  const mine = B.players.filter(p => B.me.role !== 'coach' || B.myBatches.includes(p.batch));
  if (!mine.length) return `<div class="card"><div class="card-b">${empty('star', 'No players in your batches yet.')}</div></div>`;
  if (!mine.some(p => p.id === U.progP)) U.progP = mine[0].id;
  const p = player(U.progP); const saved = B.progress[p.id];
  const sc = U.prog[p.id] || (U.prog[p.id] = { scores: saved ? [...saved.scores] : [3, 3, 3, 3, 3, 3], note: saved ? saved.note : '' });
  return `<div><h2 style="font-size:24px">Player progress</h2><p class="muted" style="margin-top:4px">Parents see these ratings and your note in their app.</p></div>
  <label class="field" for="progP"><span>Player</span><select class="select" id="progP">${mine.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)} · ${esc(batch(x.batch).name)}${B.progress[x.id] && B.progress[x.id].m === B.month ? ' ✓' : ''}</option>`).join('')}</select></label>
  <div class="card"><div class="card-h"><div class="who">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(batch(p.batch).name)} · ${p.att == null ? 'new' : p.att + '% attendance'}</small></div></div><span class="faint mono" style="font-size:12px">${saved ? 'SHARED ' + T.short(T.date(saved.at)).toUpperCase() : 'NOT SHARED YET'}</span></div>
  <div class="card-b" style="display:grid;gap:16px">${B.skills.map((s, i) => `<div class="skill"><span>${s}</span><span class="pips edit" role="group" aria-label="${s}">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= sc.scores[i] ? 'on' : ''}" data-act="pip" data-k="${i}" data-n="${n}" role="button" tabindex="0" aria-label="${s} ${n} of 5"></i>`).join('')}</span><b class="tnum">${sc.scores[i]}/5</b></div>`).join('')}
  <label class="field" for="progNote"><span>Note for parents</span><textarea class="textarea" id="progNote" placeholder="What went well, what to work on next">${esc(sc.note)}</textarea></label></div>
  <div class="card-f"><button class="btn btn-primary" type="button" data-act="saveProg">${ic('ok')}Save and share</button></div></div>`;
}

/* ---------- parent ---------- */
function kids() { return B.players.filter(p => B.kids.includes(p.id)); }
function childTabs() {
  const k = kids(); if (!k.some(p => p.id === U.child)) U.child = (k[0] || {}).id;
  return k.length > 1 ? `<div class="child-tabs" role="group" aria-label="Child">${k.map(x => `<button type="button" data-act="child" data-p="${x.id}" aria-pressed="${U.child === x.id}">${jersey(x)}${esc(first(x.name))}</button>`).join('')}</div>` : '';
}
function noKids() { return `<div class="card"><div class="card-b">${empty('parent', 'Your academy has not linked a child to this email yet. Ask them to add your email to your child.')}</div></div>`; }
function nextSession(p) { const b = batch(p.batch); for (const [d, ids] of B.week) { if (!ids.includes(b.id)) continue; if (d === B.today && (todayMarks(b.id))) continue; return d; } return null; }
function openBills(p) { return (p.bills || []).filter(b => b.st === 'due' || b.st === 'overdue' || b.st === 'verify'); }
function feeCard(p, big) {
  const ob = openBills(p); const pay = ob.filter(b => b.st !== 'verify'); const ver = ob.filter(b => b.st === 'verify');
  if (!ob.length && p.brk) return `<div class="card"><div class="card-b" style="display:grid;gap:10px"><div class="between"><span class="label">Fees</span><span class="pill p-info">On break</span></div><span class="disp tnum" style="font-size:${big ? 48 : 40}px">${inr(0)}</span><p class="faint" style="font-size:13px">${esc(p.name)} is on a break${p.brk.to ? ' until ' + T.monthName(p.brk.to) : ''}. No fee for these months.</p></div></div>`;
  if (!ob.length) { const last = (B.payments || []).find(x => x.pid === p.id); return `<div class="card"><div class="card-b" style="display:grid;gap:10px"><div class="between"><span class="label">Fees</span><span class="pill p-ok">All paid</span></div><span class="disp tnum" style="font-size:${big ? 48 : 40}px">${inr(0)}</span><p class="faint" style="font-size:13px">${last ? `Last paid ${T.short(T.date(last.at))} · ${T.monthOnly(last.m)} fee` : 'Nothing due right now.'}</p></div></div>`; }
  const b = pay[0] || ver[0]; const total = pay.reduce((t, x) => t + x.amt, 0);
  return `<div class="card ${pay.length ? 'glow' : ''}"><div class="card-b" style="display:grid;gap:10px"><div class="between"><span class="label">${pay.length > 1 ? pay.length + ' months due' : T.monthOnly(b.m) + ' fee'}</span>${b.st === 'verify' ? '<span class="pill p-info">Being checked</span>' : b.st === 'overdue' ? '<span class="pill p-bad">Overdue</span>' : `<span class="pill p-warn">Due ${T.short(b.due)}</span>`}</div><span class="disp tnum" style="font-size:${big ? 48 : 40}px">${inr(pay.length ? total : b.amt)}</span>${b.late ? `<span class="faint" style="font-size:13px">Includes ${inr(b.late)} late fee</span>` : ''}${pay.length ? `<button class="btn btn-primary ${big ? 'btn-lg' : ''} btn-block" type="button" data-act="pay" data-p="${p.id}" data-m="${pay[0].m}">${ic('upi')}Pay ${T.monthOnly(pay[0].m)} by UPI</button>` : '<p class="faint" style="font-size:13px">The academy is matching your transaction ID. You will get the receipt here.</p>'}</div></div>`;
}
function parentHome() {
  const k = kids(); if (!k.length) return noKids();
  const tabs = childTabs(); const p = player(U.child), b = batch(p.batch);
  const nx = nextSession(p); const tm = todayMarks(b.id); const mk = tm && tm.marks[p.id];
  const inj = B.injuries.find(i => i.pid === p.id && i.status !== 'fit');
  const ups = []; B.tournaments.forEach(t => t.matches.forEach(m => { if (!m.score && m.date >= B.today && (t.squad.includes(p.id) || t.batch === p.batch)) ups.push({ t, m }); })); ups.sort((x, y) => (x.m.date + x.m.time).localeCompare(y.m.date + y.m.time));
  return `${tabs}
  <div class="hero-card glow"><div class="who">${jersey(p, 'lg')}<div><span class="label">${esc(b.name)}</span><h2 class="disp" style="font-size:36px;margin-top:6px">${esc(p.name)}</h2><small style="font-size:13px">${/^coach\b/i.test(coachName(b)) ? "" : "Coach "}${esc(coachName(b))} · ${esc(ground(b.ground).name)}</small></div></div>
  <div class="divider"></div><div class="between"><div><span class="label">Next session</span><b style="display:block;font-size:17px;margin-top:6px">${nx ? (nx === B.today ? 'Today' : T.dayShort(nx)) + ', ' + T.t12(b.time) : 'Not scheduled'}</b></div>${mk ? `<span class="pill ${mk === 'A' ? 'p-bad' : mk === 'L' ? 'p-warn' : 'p-ok'}">${{ P: 'Present today', L: 'Late today', A: 'Absent today' }[mk]}</span>` : ''}</div></div>
  ${inj ? `<div class="banner warn">${ic('shield')}<span class="grow"><b>${esc(inj.what)}.</b> ${inj.status === 'out' ? 'Resting from training' : 'Light training only'}${inj.back ? ', back around ' + T.short(inj.back) : ''}.</span></div>` : ''}
  <div class="grid g2"><div class="card"><div class="card-b" style="display:flex;align-items:center;gap:20px"><span class="ring" style="--v:${p.att || 0}"><b>${p.att == null ? '—' : p.att + '%'}</b></span><div><span class="label">${T.monthOnly(B.month)} attendance</span><p style="margin-top:8px;font-size:14px" class="muted">${p.attN ? `${Object.values(p.cal[B.month] || {}).filter(v => v !== 'A').length} of ${p.attN} sessions` : 'No sessions marked yet'}</p><a href="#parent-attendance" style="color:var(--brand);font-weight:600;font-size:14px;display:inline-block;margin-top:6px">See calendar</a></div></div></div>
  ${feeCard(p)}</div>
  <div class="card"><div class="card-h"><h3>Coming up</h3>${ic('trophy')}</div><div class="list">${ups.length ? ups.slice(0, 3).map(({ t, m }) => `<div class="session" style="grid-template-columns:76px minmax(0,1fr)"><time>${T.dayShort(m.date).replace(' ', '<br>')}</time><div style="min-width:0"><b>vs ${esc(m.vs)}</b><small>${esc(t.name)}${m.time ? ' · ' + T.t12(m.time) : ''} · ${esc(m.venue)}${t.squad.includes(p.id) ? ' · in the squad' : ''}</small></div></div>`).join('') : '<div class="empty">No matches coming up.</div>'}</div></div>
  <div class="card"><div class="card-h"><h3>Latest notice</h3><a class="btn btn-quiet btn-sm" href="#parent-notices">All</a></div><div class="list">${B.notices.slice(0, 1).map(n => `<div class="notice"><b>${esc(n.title)}</b><p>${esc(n.body)}</p></div>`).join('') || '<div class="empty">No notices.</div>'}</div></div>`;
}
function parentAtt() {
  if (!kids().length) return noKids();
  const tabs = childTabs(); const p = player(U.child), b = batch(p.batch);
  const months = Object.keys(p.cal || {}).sort().reverse(); if (!months.includes(U.calM)) U.calM = B.month;
  const cal = (p.cal || {})[U.calM] || {}; const v = Object.values(cal); const pc = v.length ? Math.round(v.filter(x => x !== 'A').length / v.length * 100) : null;
  return `${tabs}<div class="between"><div><h2 style="font-size:24px">Attendance</h2><p class="muted" style="margin-top:4px">${esc(b.name)} · ${C.daysText(b.days)} · ${T.t12(b.time)}</p></div>${attPill(pc)}</div>
  <div class="card"><div class="card-h"><h3>${T.monthName(U.calM)}</h3><div class="seg" role="group" aria-label="Month">${months.slice().reverse().map(m => `<button type="button" data-act="calM" data-v="${m}" aria-pressed="${m === U.calM}">${T.monthShort(m)}</button>`).join('')}</div></div><div class="card-b" style="display:grid;gap:16px">${calendarHTML(U.calM, cal, b.days, b.off)}
  <div class="hstack" style="gap:16px;font-size:14px"><span>Present <b>${v.filter(x => x === 'P').length}</b></span><span>Late <b>${v.filter(x => x === 'L').length}</b></span><span>Absent <b>${v.filter(x => x === 'A').length}</b></span></div></div></div>
  <div class="note">${ic('bell')}<span>You get a notification in this app as soon as the coach marks ${esc(first(p.name))} absent or late.</span></div>`;
}
function parentFees() {
  if (!kids().length) return noKids();
  const tabs = childTabs(); const p = player(U.child);
  const ob = openBills(p); const paid = (B.payments || []).filter(x => x.pid === p.id);
  return `${tabs}<div><h2 style="font-size:24px">Fees</h2><p class="muted" style="margin-top:4px">${inr(p.fee)} a month · due on the ${ord(B.academy.dueDay)} · late fee ${inr(B.academy.lateFee)} after the ${ord(B.academy.lateAfter)}</p></div>
  ${feeCard(p, true)}
  <div class="note">${ic('rupee')}<span>Paid in cash to the coach or the office? That counts too. The academy marks it paid and you get a receipt here.</span></div>
  ${ob.length > 1 ? `<div class="card"><div class="card-h"><h3>Open bills</h3></div><div class="list">${ob.map(b => `<div class="row"><div class="grow"><b>${T.monthName(b.m)}</b><small class="faint" style="display:block;font-size:12.5px">${b.st === 'verify' ? (b.utr ? 'Being checked · ID ' + esc(b.utr) : 'Being checked · screenshot sent') : b.st === 'overdue' ? 'Overdue' : 'Due ' + T.short(b.due)}</small></div><b class="tnum">${inr(b.amt)}</b>${b.st === 'verify' ? feePill('verify') : `<button class="btn btn-primary btn-sm" type="button" data-act="pay" data-p="${p.id}" data-m="${b.m}">Pay</button>`}</div>`).join('')}</div></div>` : ''}
  <div class="card"><div class="card-h"><h3>Past payments</h3></div><div class="list">${paid.length ? paid.map(x => `<div class="row"><div class="grow"><b>${T.monthName(x.m)}</b><small class="faint" style="display:block;font-size:12.5px">Paid ${T.short(T.date(x.at))} · ${esc(x.via)} · ${x.receipt}</small></div><span class="tnum" style="font-weight:600">${inr(x.amt)}</span><button class="btn btn-quiet btn-sm" type="button" data-act="receipt" data-p="${p.id}" data-m="${x.m}" aria-label="Receipt ${x.receipt}">${ic('receipt')}</button></div>`).join('') : '<div class="empty">No payments yet.</div>'}</div></div>`;
}
function parentProgress() {
  if (!kids().length) return noKids();
  const tabs = childTabs(); const p = player(U.child), pr = B.progress[p.id];
  const st = statsFor(p.id);
  const badges = []; if (p.att === 100 && p.attN >= 4) badges.push('🏅 Full attendance this month'); if (st.g) badges.push(`⚽ ${st.g} goal${st.g === 1 ? '' : 's'}`); if (st.potm) badges.push(`⭐ Player of the match ×${st.potm}`); if (pr && pr.scores[5] >= 5) badges.push('🤝 Team player');
  return `${tabs}<div><h2 style="font-size:24px">Progress card</h2><p class="muted" style="margin-top:4px">${pr ? `${T.monthName(pr.m || T.date(pr.at).slice(0, 7))} · by ${esc(pr.by)}` : 'The coach has not shared a card yet'}</p></div>
  ${pr ? `<div class="card glow"><div class="card-b" style="display:grid;gap:16px">${(pr.skills || B.skills).map((s, i) => `<div class="skill"><span>${s}</span><span class="pips">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= pr.scores[i] ? 'on' : ''}"></i>`).join('')}</span><b class="tnum">${pr.scores[i]}/5</b></div>`).join('')}
  ${pr.note ? `<div class="divider"></div><div class="who" style="align-items:flex-start">${av(pr.by, 'sm')}<div><b>Coach's note</b><p class="muted" style="font-size:14px;margin-top:4px;white-space:normal">${esc(pr.note)}</p></div></div>` : ''}</div></div>` : `<div class="card"><div class="card-b">${empty('star', 'You get a notification when the coach shares the first progress card.')}</div></div>`}
  ${badges.length ? `<div class="card"><div class="card-h"><h3>Badges</h3></div><div class="card-b hstack" style="gap:10px">${badges.map(b => `<span class="pill p-brand plain" style="height:30px;font-size:13px">${b}</span>`).join('')}</div></div>` : ''}
  ${parentHealth(p)}`;
}
function parentHealth(p) {
  const m = p.med || {};
  return `<div class="card"><div class="card-h"><h3>Health & forms</h3><button class="btn btn-quiet btn-sm" type="button" data-act="editMed" data-p="${p.id}">Edit</button></div><div class="card-b" style="display:grid;gap:14px"><dl class="kv"><dt>Blood group</dt><dd>${esc(m.blood || 'Not added')}</dd><dt>Allergies</dt><dd>${esc(m.allergy || 'None')}</dd><dt>Note for coach</dt><dd>${esc(m.note || 'None')}</dd><dt>Emergency contact</dt><dd>${esc([m.ename, m.ephone].filter(Boolean).join(' · ') || 'Not added')}</dd></dl>
  <div class="divider"></div><span class="label">Forms</span><div class="list" style="margin:0 -20px">${B.docs.map(([k, l]) => { const d = (p.docs || {})[k]; return `<div class="row"><div class="grow"><b style="font-size:14px">${l}</b><small class="faint" style="display:block;font-size:12.5px">${d ? 'Added ' + T.short(T.date(d.at)) + (d.name ? ' · ' + esc(d.name) : '') : 'Not added yet'}</small></div>${d ? `<span class="pill p-ok">Added</span>${d.file ? `<a class="btn btn-quiet btn-sm" href="/api/file/${d.file}" target="_blank" rel="noopener">View</a>` : ''}` : `<label class="btn btn-ghost btn-sm" style="cursor:pointer">${ic('down')}Upload<input type="file" accept="image/*,application/pdf" data-up="${k}" data-p="${p.id}" style="position:absolute;width:1px;height:1px;opacity:0"></label>`}</div>`; }).join('')}</div></div></div>`;
}

/* ---------- football modules ---------- */
const us = () => first(B.academy.name) + ' ' + (B.academy.name.split(' ')[1] || '');
const resPill = m => { if (!m.score) return '<span class="pill p-mute plain">Upcoming</span>'; const [a, b] = m.score; return a > b ? `<span class="pill p-ok plain tnum">W ${a}–${b}</span>` : a < b ? `<span class="pill p-bad plain tnum">L ${a}–${b}</span>` : `<span class="pill p-warn plain tnum">D ${a}–${b}</span>`; };
const tPill = t => ({ ongoing: '<span class="pill p-ok">On now</span>', upcoming: '<span class="pill p-info">Coming up</span>', done: '<span class="pill p-mute">Finished</span>' }[tStatus(t)]);
function statsFor(pid) { let g = 0, a = 0, mp = 0, potm = 0; B.tournaments.forEach(t => t.matches.forEach(m => { if (!m.score) return; if (t.squad.includes(pid)) mp++; (m.scorers || []).forEach(([p, n]) => { if (p === pid) g += n; }); (m.assists || []).forEach(([p, n]) => { if (p === pid) a += n; }); if (m.potm === pid) potm++; })); return { g, a, mp, potm }; }
function canEditT(t) { const r = B.me.role; return r === 'admin' || r === 'manager' || (r === 'coach' && B.myBatches.includes(t.batch)); }
function tournamentsView(role) {
  const list = role === 'coach' ? B.tournaments.filter(t => !t.batch || B.myBatches.includes(t.batch)) : B.tournaments;
  if (!list.some(t => t.id === U.tourn)) U.tourn = (list.find(t => tStatus(t) !== 'done') || list[0] || {}).id;
  const t = list.find(x => x.id === U.tourn);
  return `<div class="page-head"><div><h2>${role === 'coach' ? 'Matches' : 'Tournaments & matches'}</h2><p>Squads, fixtures, results, scorers and certificates.</p></div>${role === 'admin' || role === 'manager' ? `<button class="btn btn-primary" type="button" data-act="newTourn">${ic('plus')}New tournament</button>` : ''}</div>
  ${list.length ? `<div class="grid g3">${list.map(x => { const played = x.matches.filter(m => m.score); const w = played.filter(m => m.score[0] > m.score[1]).length;
    return `<button class="tcard ${U.tourn === x.id ? 'on' : ''}" type="button" data-act="tourn" data-v="${x.id}" aria-pressed="${U.tourn === x.id}"><div class="between"><span class="label">${esc(x.cat)}${x.batch ? ' · ' + esc(batch(x.batch).name) : ''}</span>${tPill(x)}</div><b class="tname">${esc(x.name)}</b><small class="faint">${x.start === x.end ? T.full(x.start) : T.short(x.start) + ' to ' + T.full(x.end)}<br>${esc(x.venue)}</small>
      <div class="tmeta"><span><b class="tnum">${x.squad.length}</b> in squad</span><span><b class="tnum">${played.length}</b> played</span><span><b class="tnum">${w}</b> won</span>${x.result ? `<span class="pill p-brand plain">${ic('trophy')}${esc(x.result)}</span>` : ''}</div></button>`; }).join('')}</div>${t ? tournDetail(t) : ''}`
    : `<div class="card"><div class="card-b">${empty('trophy', role === 'coach' ? 'No tournaments for your batches yet.' : 'No tournaments yet. Add one to pick a squad and record results.', role === 'admin' || role === 'manager' ? `<button class="btn btn-primary btn-sm" type="button" data-act="newTourn">${ic('plus')}New tournament</button>` : '')}</div></div>`}`;
}
function tournDetail(t) {
  const ed = canEditT(t), am = B.me.role === 'admin' || B.me.role === 'manager';
  const sq = t.squad.map(pid => ({ p: player(pid), ...statsFor(pid) })).filter(x => x.p).sort((a, b) => b.g - a.g || b.a - a.a);
  const played = t.matches.filter(m => m.score); const gf = played.reduce((s, m) => s + m.score[0], 0), ga = played.reduce((s, m) => s + m.score[1], 0);
  return `<div class="grid g-main">
  <div class="stack"><div class="card glow"><div class="card-h"><div><h3>${esc(t.name)}</h3><div class="sub">${esc(t.format || t.cat)}${t.entry ? ' · entry ' + inr(t.entry) : ''}</div></div><div class="hstack">${am ? `<button class="btn btn-quiet btn-sm" type="button" data-act="editTourn" data-v="${t.id}">Edit</button><button class="btn btn-ghost btn-sm" type="button" data-act="addMatch">${ic('plus')}Add match</button>` : ''}</div></div>
    <div class="list">${t.matches.length ? t.matches.map(m => `<div class="fx"><div class="fx-d"><b>${T.short(m.date)}</b><small>${C.DOW[T.dow(m.date)]}${m.time ? ' · ' + T.t12(m.time) : ''}</small></div>
      <div class="fx-m"><div class="fx-teams"><span>${esc(us())}</span><span class="fx-score tnum">${m.score ? `${m.score[0]}<i>–</i>${m.score[1]}` : '<i>vs</i>'}</span><span>${esc(m.vs)}</span></div><small class="faint">${esc(m.venue)}${m.scorers && m.scorers.length ? ` · ⚽ ${m.scorers.map(([p, n]) => esc(first((player(p) || { name: '?' }).name)) + (n > 1 ? ' ×' + n : '')).join(', ')}` : ''}</small></div>
      <div class="fx-r">${resPill(m)}${ed && t.squad.length ? `<button class="btn ${m.score ? 'btn-quiet' : 'btn-primary'} btn-sm" type="button" data-act="result" data-m="${m.id}">${m.score ? 'Edit' : 'Add result'}</button>` : ''}${m.potm && player(m.potm) ? `<button class="btn btn-quiet btn-sm" type="button" data-act="cert" data-p="${m.potm}" data-m="${m.id}" title="Player of the match certificate">${ic('star')}<span class="hide-sm">${esc(first(player(m.potm).name))}</span></button>` : ''}</div></div>`).join('') : '<div class="empty">No matches added yet.</div>'}</div>
    ${played.length ? `<div class="card-f" style="justify-content:flex-start;gap:8px 16px;font-size:14px;flex-wrap:wrap"><span>Won <b>${played.filter(m => m.score[0] > m.score[1]).length}</b></span><span>Drawn <b>${played.filter(m => m.score[0] === m.score[1]).length}</b></span><span>Lost <b>${played.filter(m => m.score[0] < m.score[1]).length}</b></span><span>Goals <b>${gf}–${ga}</b></span>${am ? `<button class="btn btn-quiet btn-sm" type="button" data-act="tournResult" data-v="${t.id}" style="margin-left:auto">${t.result ? 'Final place: ' + esc(t.result) : 'Add final place'}</button>` : ''}</div>` : ''}</div></div>
  <div class="stack"><div class="card"><div class="card-h"><div><h3>Squad</h3><div class="sub">${t.squad.length} players picked</div></div>${ed ? `<button class="btn btn-ghost btn-sm" type="button" data-act="squad">${ic('players')}Pick squad</button>` : ''}</div>
    <div class="list">${sq.length ? sq.map(x => `<div class="row"><div class="who grow">${jersey(x.p)}<div><b>${esc(x.p.name)}</b><small>${x.mp} played${x.potm ? ` · ${x.potm}× player of the match` : ''}</small></div></div><span class="stat-chip" title="Goals">⚽ <b class="tnum">${x.g}</b></span><span class="stat-chip" title="Assists">🅰 <b class="tnum">${x.a}</b></span></div>`).join('') : '<div class="empty">No squad picked yet.</div>'}</div></div></div></div>`;
}
function trainingView(role) {
  const ids = role === 'coach' ? B.myBatches : B.batches.map(b => b.id);
  if (!ids.length) return `<div class="page-head"><div><h2>Training plan</h2></div></div><div class="card"><div class="card-b">${empty('whistle', role === 'coach' ? 'You have no batches yet.' : 'Add a batch first.')}</div></div>`;
  if (!ids.includes(U.planB)) U.planB = ids[0];
  const b = batch(U.planB), saved = B.plans[U.planB] || { focus: '', note: '', drills: [] };
  const ed = U.planEdit && U.planEdit.b === U.planB ? U.planEdit : null; const pl = ed || saved;
  const dr = id => B.drills.find(d => d.id === id) || { name: 'Removed drill', cat: '', mins: 0 };
  let t = 0; const total = pl.drills.reduce((s, id) => s + (dr(id).mins || 0), 0) + 5;
  const can = role !== 'coach' || B.myBatches.includes(U.planB);
  return `<div class="page-head"><div><h2>Training plan</h2><p>${role === 'coach' ? 'Your plan for each batch. Change it any time.' : 'Coaches see this on their phone before the session.'}</p></div>${can ? (ed ? `<div class="hstack"><button class="btn btn-ghost" type="button" data-act="planCancel">Cancel</button><button class="btn btn-primary" type="button" data-act="planSave">${ic('ok')}Save and share</button></div>` : `<button class="btn btn-primary" type="button" data-act="planEdit">${ic('whistle')}Edit plan</button>`) : ''}</div>
  ${batchPicker(U.planB, ids, 'pickPlan')}
  <div class="grid g-main"><div class="card glow"><div class="card-h"><div>${ed ? `<label class="field" for="pl-focus"><span>Focus this week</span><input class="input" id="pl-focus" value="${esc(ed.focus)}" placeholder="e.g. Passing and moving"></label>` : `<h3>${esc(b.name)} · ${esc(pl.focus || 'No plan yet')}</h3><div class="sub">${C.daysText(b.days)} · ${T.t12(b.time)} · ${esc(coachName(b))}${saved.at ? ' · updated ' + when(saved.at) : ''}</div>`}</div><span class="pill p-brand plain mono">${total} MIN</span></div>
    <div class="list">${pl.drills.map((id, k) => { const d = dr(id); const st = t; t += d.mins || 0; return `<div class="drill"><span class="drill-t mono">${String(st).padStart(2, '0')}′</span><div class="grow" style="min-width:0"><b>${esc(d.name)}</b><small class="faint">${esc(d.cat)} · ${d.mins} min</small></div>${ed ? `<div class="hstack" style="flex-wrap:nowrap">${k ? `<button class="btn btn-quiet btn-sm" type="button" data-act="drillUp" data-i="${k}" aria-label="Move up">↑</button>` : ''}<button class="btn btn-quiet btn-sm" type="button" data-act="drillDel" data-i="${k}" aria-label="Remove">${ic('x')}</button></div>` : `<span class="pill p-mute plain">${k + 1}</span>`}</div>`; }).join('')}
    <div class="drill"><span class="drill-t mono">${String(t).padStart(2, '0')}′</span><div class="grow"><b>Cool-down and team talk</b><small class="faint">5 min</small></div></div></div>
    <div class="card-f" style="justify-content:flex-start">${ed ? `<label class="field" for="pl-note" style="width:100%"><span>Note for the coach</span><input class="input" id="pl-note" value="${esc(ed.note)}"></label>` : pl.note ? `<span class="note" style="width:100%">${ic('whistle')}<span>${esc(pl.note)}</span></span>` : ''}</div></div>
  <div class="card"><div class="card-h"><h3>Drill library</h3><button class="btn btn-quiet btn-sm" type="button" data-act="newDrill">${ic('plus')}New</button></div><div class="list">${B.drills.map(d => `<div class="row"><div class="grow" style="min-width:0"><b style="font-size:14px">${esc(d.name)}</b><small class="faint" style="display:block;font-size:12.5px">${esc(d.cat)} · ${d.mins} min</small></div>${can ? `<button class="btn btn-quiet btn-sm" type="button" data-act="addDrill" data-id="${d.id}" aria-label="Add ${esc(d.name)}">${ic('plus')}</button>` : ''}</div>`).join('')}</div></div></div>`;
}
function healthView() {
  const inj = B.injuries; const role = B.me.role;
  const missing = B.players.filter(p => B.docs.some(([k]) => !(p.docs || {})[k]));
  const med = B.players.filter(p => p.med && (p.med.blood || p.med.allergy || p.med.note));
  return `<div class="page-head"><div><h2>Health & documents</h2><p>Injuries, medical notes and the forms you need from each family.</p></div><button class="btn btn-primary" type="button" data-act="logInjury">${ic('plus')}Log an injury</button></div>
  <div class="kpis">${[['Out injured', inj.filter(i => i.status === 'out').length, 'Coach is told not to play them'], ['Light training', inj.filter(i => i.status === 'light').length, 'No contact drills'], ['Missing forms', missing.length, 'players'], ['Allergies on file', B.players.filter(p => p.med && p.med.allergy).length, 'Coaches see these']].map(([l, v, d]) => `<div class="card kpi"><span class="label">${l}</span><span class="v">${v}</span><span class="d">${d}</span></div>`).join('')}</div>
  <div class="grid g2 g2-wide"><div class="card glow"><div class="card-h"><h3>Injury list</h3></div><div class="list">${inj.length ? inj.map(i => { const p = player(i.pid); if (!p) return ''; return `<div class="row"><div class="who grow">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(i.what)} · since ${T.short(i.since)}</small></div></div><select class="select select-sm" data-inj="${i.id}" aria-label="Status for ${esc(p.name)}" style="width:auto"><option value="out" ${i.status === 'out' ? 'selected' : ''}>Out</option><option value="light" ${i.status === 'light' ? 'selected' : ''}>Light training</option><option value="fit" ${i.status === 'fit' ? 'selected' : ''}>Fit again</option></select></div>`; }).join('') : '<div class="empty">No injuries. Good news.</div>'}</div></div>
  <div class="card"><div class="card-h"><h3>Medical notes</h3><span class="faint" style="font-size:12.5px">Blood group · allergy</span></div><div class="list">${med.length ? med.map(p => `<div class="row"><div class="who grow">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(p.med.note || 'No notes')}</small></div></div>${p.med.blood ? `<span class="pill p-mute plain mono">${esc(p.med.blood)}</span>` : ''}${p.med.allergy ? `<span class="pill p-warn plain">${esc(p.med.allergy)}</span>` : ''}<button class="btn btn-quiet btn-sm" type="button" data-act="editMed" data-p="${p.id}">Edit</button></div>`).join('') : '<div class="empty">Parents add these in their app.</div>'}</div></div></div>
  <div class="card"><div class="card-h"><div><h3>Documents</h3><div class="sub">Parents upload these in their app. Tap a cross to mark a paper copy as received.</div></div><button class="btn btn-ghost btn-sm" type="button" data-act="askDocs" ${missing.length ? '' : 'disabled'}>${ic('mail')}Ask ${missing.length} parent${missing.length === 1 ? '' : 's'}</button></div>
  ${B.players.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Player</th>${B.docs.map(([, l]) => `<th class="c">${l}</th>`).join('')}</tr></thead><tbody>${B.players.map(p => `<tr><td><div class="who">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(batch(p.batch).name)}</small></div></div></td>${B.docs.map(([k, l]) => { const d = (p.docs || {})[k]; return `<td class="c">${d ? (d.file ? `<a class="tick ok" href="/api/file/${d.file}" target="_blank" rel="noopener" title="Open ${l}">${ic('ok')}</a>` : `<button class="tick ok" type="button" data-act="docToggle" data-p="${p.id}" data-k="${k}" data-on="1" title="${l}: received. Tap to undo." style="border:0;cursor:pointer">${ic('ok')}</button>`) : `<button class="tick no" type="button" data-act="docToggle" data-p="${p.id}" data-k="${k}" title="${l}: missing. Tap when you get a paper copy." style="border:0;cursor:pointer">${ic('x')}</button>`}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` : `<div class="card-b">${empty('copy', 'No players yet.')}</div>`}</div>`;
}
function kitView() {
  const low = B.kit.filter(k => k.have < k.min);
  return `<div class="page-head"><div><h2>Kit & equipment</h2><p>Stock at all grounds. Low items turn red.</p></div><button class="btn btn-primary" type="button" data-act="addStock">${ic('plus')}Add item</button></div>
  ${low.length ? `<div class="note warn-note">${ic('bell')}<span><b>${low.length} item${low.length === 1 ? ' is' : 's are'} running low:</b> ${low.map(k => esc(k.name)).join(', ')}.</span></div>` : ''}
  <div class="grid g2 g2-wide"><div class="card"><div class="card-h"><h3>Stock</h3><span class="faint" style="font-size:12.5px">In stock / keep at least</span></div><div class="list">${B.kit.length ? B.kit.map(k => `<div class="row"><div class="grow" style="min-width:0"><button type="button" data-act="editStock" data-id="${k.id}" style="all:unset;cursor:pointer;font-weight:600;font-size:14px">${esc(k.name)}</button><span class="stock"><i style="width:${Math.min(100, k.have / Math.max(k.min * 2, 1) * 100)}%;background:${k.have < k.min ? 'var(--bad)' : 'var(--brand)'}"></i></span></div><b class="tnum" style="min-width:64px;text-align:right;${k.have < k.min ? 'color:var(--bad)' : ''}">${k.have}<span class="faint" style="font-weight:500"> / ${k.min}</span></b><div class="qty"><button type="button" data-act="qty" data-id="${k.id}" data-d="-1" aria-label="One less ${esc(k.name)}">−</button><button type="button" data-act="qty" data-id="${k.id}" data-d="1" aria-label="One more ${esc(k.name)}">+</button></div></div>`).join('') : `<div class="empty">No items yet. Add balls, cones, bibs and kit.</div>`}</div></div>
  <div class="card"><div class="card-h"><h3>Kit given to players</h3><span class="faint" style="font-size:12.5px">${Object.keys(B.kitGiven).filter(id => player(id)).length} of ${B.players.length}</span></div><div class="list">${B.players.length ? B.players.map(p => { const g = B.kitGiven[p.id]; return `<div class="row"><div class="who grow">${jersey(p)}<div><b>${esc(p.name)}</b><small>${g ? 'Size ' + esc(g.size) + ' · given ' + T.short(T.date(g.at)) : 'Not given yet'}</small></div></div>${g ? `<button class="btn btn-quiet btn-sm" type="button" data-act="kitUndo" data-p="${p.id}">Undo</button><span class="pill p-ok">Given</span>` : `<button class="btn btn-ghost btn-sm" type="button" data-act="giveKit" data-p="${p.id}">Mark given</button>`}</div>`; }).join('') : '<div class="empty">No players yet.</div>'}</div></div></div>`;
}
function moneyView() {
  const M = B.month; const inM = x => T.date(x.at).slice(0, 7) === M;
  const received = (B.payments || []).filter(inM).reduce((s, x) => s + x.amt, 0);
  const exps = B.expenses.filter(x => x.date.slice(0, 7) === M); const exp = exps.reduce((s, x) => s + x.amt, 0);
  const sal = B.staff.reduce((s, x) => s + (x.sal ? x.sal.amt : 0), 0); const salPaid = B.staff.reduce((s, x) => s + (x.sal && x.sal.paid ? x.sal.paid.amt : 0), 0);
  return `<div class="page-head"><div><h2>Expenses & salaries</h2><p>${T.monthName(M)} · what came in and what went out.</p></div><button class="btn btn-primary" type="button" data-act="addExp">${ic('plus')}Add expense</button></div>
  <div class="kpis">${[['Fees received', inr(received), 'var(--ok)'], ['Salaries', inr(sal), 'var(--ink)'], ['Expenses', inr(exp), 'var(--bad)'], ['Left over', inr(received - sal - exp), received - sal - exp >= 0 ? 'var(--brand)' : 'var(--bad)']].map(([l, v, c]) => `<div class="card kpi"><span class="label">${l}</span><span class="v" style="color:${c}">${v}</span></div>`).join('')}</div>
  <div class="grid g2 g2-wide"><div class="card glow"><div class="card-h"><div><h3>Coach & staff salaries</h3><div class="sub">Per-day pay is worked out from attendance · ${inr(salPaid)} paid</div></div><span class="pill p-warn plain">${B.staff.filter(s => s.sal && !s.sal.paid && s.sal.amt).length} to pay</span></div><div class="list">${B.staff.length ? B.staff.map(s => `<div class="row"><div class="who grow">${av(s.name, 'sm')}<div><b>${esc(s.name)}</b><small>${esc(s.sal.how)} · ${s.sal.days}/${s.sal.of} days${s.sal.leave ? ` · ${s.sal.leave} leave${s.sal.paidLeave ? ` (${s.sal.paidLeave} paid)` : ''}` : ''}${s.sal.cut ? ` · −${inr(s.sal.cut)} unpaid leave` : ''}${s.sal.paid && s.sal.paid.note ? ' · ' + esc(s.sal.paid.note) : ''}</small></div></div><b class="tnum">${inr(s.sal.paid ? s.sal.paid.amt : s.sal.amt)}</b>${s.sal.paid ? `<button class="pill p-ok" type="button" data-act="paySal" data-s="${s.id}" title="Tap to undo" style="border:0;cursor:pointer">Paid</button>` : `<button class="btn btn-primary btn-sm" type="button" data-act="salModal" data-s="${s.id}">Mark paid</button>`}</div>`).join('') : '<div class="empty">No staff yet.</div>'}</div></div>
  <div class="card"><div class="card-h"><h3>Expenses</h3><span class="faint mono" style="font-size:12px">${inr(exp)}</span></div><div class="list">${exps.length ? exps.map(x => `<div class="row"><div class="grow" style="min-width:0"><b style="font-size:14px">${esc(x.what)}</b><small class="faint" style="display:block;font-size:12.5px">${esc(x.cat)} · ${T.short(x.date)}</small></div><b class="tnum">${inr(x.amt)}</b><button class="btn btn-quiet btn-sm" type="button" data-act="delExp" data-id="${x.id}" aria-label="Remove ${esc(x.what)}">${ic('x')}</button></div>`).join('') : '<div class="empty">No expenses this month.</div>'}</div></div></div>`;
}
function groundsView() {
  const role = B.me.role;
  if (!B.grounds.some(g => g.id === U.ground)) U.ground = (B.grounds[0] || {}).id;
  const g = U.ground; const days = []; for (let i = 0; i < 7; i++) days.push(T.add(B.today, i));
  const times = [...new Set(['06:30', '07:30', '08:30', '17:30', '18:30', ...B.batches.filter(b => b.ground === g).map(b => b.time), ...B.bookings.filter(b => b.gid === g).map(b => b.time)])].sort();
  const cell = (d, s) => { const b = B.batches.find(b => b.ground === g && b.time === s && C.isOn(b, d)); if (b) return `<td><span class="slot" style="--c:${TINT[b.tint]}">${esc(b.name)}</span></td>`;
    const k = B.bookings.find(x => x.gid === g && x.date === d && x.time === s); if (k) return `<td><button class="slot" type="button" style="--c:var(--brand);cursor:pointer" data-act="unbook" data-id="${k.id}" title="${esc(k.what)} · tap to remove">${esc(k.what)}</button></td>`;
    return `<td><button class="slot free" type="button" data-act="book" data-d="${d}" data-t="${s}">Free</button></td>`; };
  return `<div class="page-head"><div><h2>Grounds</h2><p>Who is on which turf this week. Tap a free slot to book it.</p></div><div class="hstack">${B.grounds.length > 1 ? `<div class="seg" role="group" aria-label="Ground">${B.grounds.map(x => `<button type="button" data-act="ground" data-v="${x.id}" aria-pressed="${g === x.id}">${esc(x.name.split(',')[0])}</button>`).join('')}</div>` : ''}${role === 'admin' ? `<button class="btn btn-ghost" type="button" data-act="addGround">${ic('plus')}Ground</button>` : ''}</div></div>
  ${B.grounds.length ? `<div class="card glow"><div class="card-h"><div><h3>${esc(ground(g).name)}</h3><div class="sub">Next 7 days</div></div>${role === 'admin' ? `<button class="btn btn-quiet btn-sm" type="button" data-act="editGround" data-v="${g}">Rename</button>` : ''}</div><div class="table-wrap"><table class="t grid-t"><thead><tr><th>Time</th>${days.map(d => `<th class="c">${d === B.today ? 'Today' : C.DOW[T.dow(d)] + ' ' + +d.slice(8)}</th>`).join('')}</tr></thead><tbody>${times.map(s => `<tr><td class="mono" style="font-size:12.5px">${T.t12(s)}</td>${days.map(d => cell(d, s)).join('')}</tr>`).join('')}</tbody></table></div></div>` : ''}
  <div class="note">${ic('pin')}<span>Bookings show up for coaches and the manager straight away.</span></div>`;
}

/* ---------- screens per app ---------- */
const VIEWS = {
  admin: { home: adminHome, admissions: admissionsView, players: () => playersView('admin'), batches: () => batchesView('admin'), attendance: () => attendanceView('admin'), fees: feesView, reminders: remindersView, staff: staffView, parents: parentsView, notices: () => `<div class="page-head"><div><h2>Notices</h2><p>Post to all parents, one batch, or coaches.</p></div></div>${noticesView(true)}`, reports: reportsView, setup: setupView, tournaments: () => tournamentsView('admin'), training: () => trainingView('admin'), health: healthView, kit: kitView, money: moneyView, grounds: groundsView },
  manager: { home: managerHome, staffatt: () => `<div class="page-head"><div><h2>Coach attendance</h2><p>Mark each coach as they arrive. The time is saved.</p></div></div>${staffMark(true)}`, attendance: () => attendanceView('manager'), admissions: admissionsView, players: () => playersView('manager'), batches: () => batchesView('manager'), notices: () => `<div class="page-head"><div><h2>Notices</h2></div></div>${noticesView(true)}`, tournaments: () => tournamentsView('manager'), training: () => trainingView('manager'), health: healthView, grounds: groundsView, kit: kitView },
  coach: { home: coachHome, mark: coachMark, training: () => trainingView('coach'), matches: () => tournamentsView('coach'), progress: coachProgress, myatt: coachMyAtt, notices: () => `<div><h2 style="font-size:24px">Notices</h2></div>${noticesView(B.myBatches.length > 0)}` },
  parent: { home: parentHome, attendance: parentAtt, fees: parentFees, matches: parentMatches, progress: parentProgress, notices: () => `${childTabs()}<div><h2 style="font-size:24px">Notices</h2></div>${noticesView(false)}` }
};
function parentMatches() {
  if (!kids().length) return noKids();
  const tabs = childTabs(); const p = player(U.child); const st = statsFor(p.id);
  const ts = B.tournaments.filter(t => t.squad.includes(p.id) || t.batch === p.batch);
  return `${tabs}<div><h2 style="font-size:24px">Matches</h2><p class="muted" style="margin-top:4px">${esc(first(p.name))}'s tournaments and stats</p></div>
  <div class="kpis">${[['Matches', st.mp], ['Goals', st.g], ['Assists', st.a], ['Player of the match', st.potm]].map(([l, v]) => `<div class="card kpi"><span class="label">${l}</span><span class="v">${v}</span></div>`).join('')}</div>
  ${ts.length ? ts.map(t => `<div class="card ${tStatus(t) !== 'done' ? 'glow' : ''}"><div class="card-h"><div><h3>${esc(t.name)}</h3><div class="sub">${t.start === t.end ? T.full(t.start) : T.short(t.start) + ' to ' + T.full(t.end)} · ${esc(t.venue)}</div></div>${t.squad.includes(p.id) ? '<span class="pill p-ok">In the squad</span>' : '<span class="pill p-mute plain">Not picked</span>'}</div><div class="list">${t.matches.map(m => `<div class="fx"><div class="fx-d"><b>${T.short(m.date)}</b><small>${m.time ? T.t12(m.time) : C.DOW[T.dow(m.date)]}</small></div><div class="fx-m"><div class="fx-teams"><span>${esc(us())}</span><span class="fx-score tnum">${m.score ? `${m.score[0]}<i>–</i>${m.score[1]}` : '<i>vs</i>'}</span><span>${esc(m.vs)}</span></div><small class="faint">${esc(m.venue)}</small></div><div class="fx-r">${resPill(m)}${m.potm === p.id ? `<button class="btn btn-quiet btn-sm" type="button" data-act="cert" data-p="${p.id}" data-m="${m.id}">${ic('star')}Certificate</button>` : ''}</div></div>`).join('') || '<div class="empty">Fixtures not added yet.</div>'}</div>${t.result ? `<div class="card-f" style="justify-content:flex-start"><span class="pill p-brand plain">${ic('trophy')}${esc(t.result)}</span></div>` : ''}</div>`).join('') : `<div class="card"><div class="card-b">${empty('trophy', `No tournaments yet for ${esc(batch(p.batch).name)}. They show here as soon as the academy enters one.`)}</div></div>`}`;
}

/* ---------- draw ---------- */
let lastView = '';
function render() {
  const r = route(); let html = '';
  if (r.view === 'home') return go(B ? B.me.role : 'login');
  if (r.view === 'app') {
    if (!B) { if (!LIVE) { DemoAPI.loginAs(r.role).then(() => refresh()).then(() => { render(); countUp(); }); return; } return go('login'); }
    if (B.me.role !== r.role) {
      if (!LIVE) { DemoAPI.loginAs(r.role).then(() => refresh()).then(() => { U.draft = {}; U.prog = {}; render(); countUp(); }); return; }
      const m = (B.memberships || []).find(x => x.aid === B.academy.id && x.role === r.role);
      if (m) { API.switchTo(m.aid, m.role).then(() => refresh()).then(() => { render(); countUp(); }); return; }
      return go(B.me.role);
    }
    const tab = B.plan.active || r.role !== 'admin' || ['setup', 'home'].includes(r.tab) ? r.tab : 'setup';
    html = shell(r.role, tab, VIEWS[r.role][tab]());
  } else if (['login', 'signup', 'forgot', 'reset'].includes(r.view)) html = auth(r.view, r.token);
  else html = VFL.render(CFG, IC);
  $('#app').innerHTML = html + modal(); $('#app').toggleAttribute('data-notrack', r.view === 'app');
  const tr = i18nOn(); $('#app').classList.toggle('tr', tr); if (tr) trDom($('#app'));
  document.title = r.view === 'landing' ? 'Sports Academy Management App India | Veyra Academy' : r.view === 'app' ? `${ROLES[r.role].tabs.find(t => t[0] === r.tab)[1]} · ${B.academy.name}` : 'Veyra Academy';
  if (location.hash !== lastView) { lastView = location.hash; if (r.view === 'login' || r.view === 'signup') mountGoogle(); }
}
function rerender() { const y = window.scrollY; render(); window.scrollTo(0, y); }
function countUp() {
  const c = $('.content'); if (!c) return; c.classList.add('enter');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  c.querySelectorAll('.kpi .v, .ring b').forEach(el => {
    const txt = el.textContent, m = txt.match(/[\d,]+/); if (!m) return;
    const end = +m[0].replace(/,/g, ''); if (!end) return; const t0 = performance.now(), dur = 900;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3), v = Math.round(end * e); el.textContent = txt.replace(m[0], m[0].includes(',') ? v.toLocaleString('en-IN') : String(v)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

/* ---------- pop-ups ---------- */
const F = (id, label, v, o) => { o = o || {}; return `<label class="field" for="${id}"><span>${label}</span><input class="input ${o.cls || ''}" id="${id}" value="${esc(v == null ? '' : v)}" ${o.type ? `type="${o.type}"` : ''} ${o.im ? `inputmode="${o.im}"` : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.ac ? `autocomplete="${o.ac}"` : ''} ${o.max ? `max="${o.max}"` : ''}>${o.help ? `<small class="faint" style="font-size:12.5px">${o.help}</small>` : ''}</label>`; };
const SEL = (id, label, opts, cur) => `<label class="field" for="${id}"><span>${label}</span><select class="select" id="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
const btns = (cancel, main, act, icon) => `<button class="btn btn-ghost" type="button" data-act="close">${cancel}</button><button class="btn btn-primary" type="button" data-act="${act}">${icon ? ic(icon) : ''}${main}</button>`;
function upiQR(text) {
  if (window.qrcode) { try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return `<div class="qrimg" role="img" aria-label="UPI QR code">${q.createSvgTag({ cellSize: 4, margin: 0, scalable: true })}</div>`; } catch (_) {} }
  return `<div class="qrimg" style="display:grid;place-items:center;text-align:center;font-size:12px;color:#444">Open your UPI app and pay the ID shown</div>`;
}
function modal() {
  const m = U.modal; if (!m) return '';
  let h = '', title = '', foot = '', wide = false;
  const role = B && B.me.role;
  if (m.t === 'pay') { const p = player(m.p), b = (p.bills || []).find(x => x.m === m.m) || {}; const A = B.academy;
    title = `Pay ${T.monthOnly(m.m)} fee`;
    const link = `upi://pay?pa=${encodeURIComponent(A.upi)}&pn=${encodeURIComponent(A.payee)}&am=${b.amt}&cu=INR&tn=${encodeURIComponent(p.name + ' ' + T.monthOnly(m.m) + ' fee')}`;
    const amt = `<div><span class="label">Amount</span><div class="disp tnum" style="font-size:44px;margin-top:6px">${inr(b.amt)}</div><small class="faint">${esc(p.name)} · ${esc(batch(p.batch).name)}${b.late ? ' · incl. ' + inr(b.late) + ' late fee' : ''}</small></div>`;
    if (!A.upi) { h = amt + `<div class="banner warn">${ic('upi')}<span class="grow">The academy has not added its UPI ID yet. Please pay them directly for now.</span></div>`; foot = `<button class="btn btn-ghost" type="button" data-act="close">Close</button>`; }
    else if (!m.step2) { h = amt + `<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">${upiQR(link)}<div style="display:grid;gap:10px;min-width:0;flex:1"><span class="label">Pay to</span><b>${esc(A.payee)}</b><div class="hstack"><span class="utr">${esc(A.upi)}</span><button class="btn btn-quiet btn-sm" type="button" data-act="copyUpi">${ic('copy')}Copy</button></div><a class="btn btn-primary" href="${link}">${ic('upi')}Open UPI app</a></div></div>
      <div class="note">${ic('phone')}<span>On a phone, tap Open UPI app. On a laptop, scan the code with GPay, PhonePe or Paytm. Then come back and paste the transaction ID.</span></div>`;
      foot = `<button class="btn btn-primary" type="button" data-act="payNext">I have paid ${ic('arrow')}</button>`; }
    else { h = `<label class="field" for="utr"><span>UPI transaction ID (12 digits)</span><input class="input mono" id="utr" inputmode="numeric" maxlength="14" autocomplete="off" placeholder="e.g. 434512908761" style="font-size:18px;letter-spacing:.08em;height:52px"></label><span class="faint" id="utrErr" style="font-size:13px">In your UPI app, open the payment and look for “UPI transaction ID” or “UTR”.</span>
      <div class="or">or</div>${m.shot ? `<div class="banner">${ic('ok')}<span class="grow">Screenshot added: <b>${esc(m.shot.name)}</b></span><label class="btn btn-quiet btn-sm" style="cursor:pointer">Change<input type="file" accept="image/*" data-shot="1" hidden></label></div>` : `<label class="btn btn-ghost btn-lg btn-block" style="cursor:pointer">${ic('up')}Upload payment screenshot<input type="file" accept="image/*" data-shot="1" hidden></label>`}`;
      foot = `<button class="btn btn-ghost" type="button" data-act="payBack">Back</button><button class="btn btn-primary" type="button" data-act="paySubmit">${ic('ok')}Send to academy</button>`; } }
  if (m.t === 'player') { const p = player(m.p); if (!p) { U.modal = null; return ''; } const b = batch(p.batch); title = p.name; const am = role === 'admin';
    h = `<div class="who">${jersey(p, 'lg')}<div><b style="font-size:18px">${esc(p.name)}</b><small>${esc(b.name)} · #${p.no}${p.dob ? ' · born ' + T.full(p.dob) : ''}</small></div></div><dl class="kv"><dt>Parent</dt><dd>${esc(p.parentName)}</dd><dt>Email</dt><dd>${esc(p.parentEmail || 'Not added')}</dd><dt>Phone</dt><dd>${p.parentPhone ? `<a href="tel:${esc(p.parentPhone)}">${esc(p.parentPhone)}</a>` : 'Not added'}</dd><dt>Batch</dt><dd>${esc(b.name)}, ${C.daysText(b.days)} ${T.t12(b.time)}</dd><dt>Coach</dt><dd>${esc(coachName(b))}</dd><dt>Attendance</dt><dd>${p.att == null ? 'New' : p.att + '% this month'}</dd>${am ? `<dt>Monthly fee</dt><dd>${inr(p.fee)}${p.feeCustom ? ' (own fee)' : ''}</dd><dt>Owes</dt><dd>${p.owes ? inr(p.owes) : 'Nothing'}</dd>` : ''}${p.brk ? `<dt>Break</dt><dd>${T.monthOnly(p.brk.from)}${p.brk.to ? ' to ' + T.monthOnly(p.brk.to) : ' onwards'}${p.brk.why ? ' · ' + esc(p.brk.why) : ''}</dd>` : ''}<dt>Joined</dt><dd>${p.joined ? T.full(p.joined) : ''}</dd>${p.med && p.med.allergy ? `<dt>Allergy</dt><dd style="color:var(--bad)">${esc(p.med.allergy)}</dd>` : ''}</dl>${am ? `<button class="btn btn-ghost btn-block" type="button" data-act="breakModal" data-p="${p.id}">${ic('calendar')}${p.brk ? 'Manage break' : 'Break / holiday (no fee)'}</button>` : ''}`;
    foot = am ? `<button class="btn btn-quiet" type="button" data-act="leave" data-p="${p.id}">Left academy</button>${p.hasApp ? `<button class="btn btn-ghost" type="button" data-act="parentReset" data-p="${p.id}">New parent password</button>` : ''}<button class="btn btn-primary" type="button" data-act="editPlayer" data-p="${p.id}">Edit</button>` : `<button class="btn btn-ghost" type="button" data-act="close">Close</button>`; }
  if (m.t === 'break') { const p = player(m.p); title = 'Break for ' + p.name;
    h = `<p class="muted" style="font-size:14px">While on a break there is no fee for those months, and ${esc(first(p.name))} is not on the attendance list. Months already paid are not changed.</p>
    ${(p.breaks || []).length ? `<div class="list" style="margin:0 -16px">${p.breaks.map((b, i) => `<div class="row"><div class="grow"><b>${T.monthName(b.from)}${b.to ? (b.to !== b.from ? ' to ' + T.monthName(b.to) : '') : ' onwards'}</b><small class="faint" style="display:block;font-size:12.5px">${esc(b.why || 'No reason added')}</small></div><button class="btn btn-quiet btn-sm" type="button" data-act="unbreak" data-p="${p.id}" data-i="${i}">Remove</button></div>`).join('')}</div>` : ''}
    <div class="grid g2">${F('br-f', 'First month', B.month, { type: 'month' })}${F('br-t', 'Last month (optional)', '', { type: 'month', help: 'Empty = until you remove the break.' })}</div>${F('br-w', 'Reason (optional)', '', { ph: 'e.g. Exams, family trip' })}`;
    foot = btns('Cancel', 'Add break', 'saveBreak', 'ok'); }
  if (m.t === 'sleave') { const s = B.staff.find(x => x.id === m.s); title = 'Leave for ' + s.name;
    h = `<div class="grid g2">${F('lv-f', 'First day', B.today, { type: 'date' })}${F('lv-t', 'Last day', B.today, { type: 'date' })}</div>${SEL('lv-p', 'Pay for these days', [['0', 'Unpaid leave (salary is cut)'], ['1', 'Paid leave (no cut)']], '0')}${F('lv-w', 'Reason (optional)', '', { ph: 'e.g. Diwali holiday' })}
    <div class="note">${ic('rupee')}<span>Monthly pay: each unpaid leave day cuts one day's pay. Per-day pay: paid leave days are paid like days worked.</span></div>`;
    foot = `<button class="btn btn-quiet" type="button" data-act="clearLeave" data-s="${s.id}">Remove leave on these days</button><button class="btn btn-primary" type="button" data-act="saveLeave" data-s="${s.id}">${ic('ok')}Save leave</button>`; }
  if (m.t === 'sal') { const s = B.staff.find(x => x.id === m.s); title = 'Pay ' + s.name;
    h = `<dl class="kv"><dt>Worked out</dt><dd>${inr(s.sal.amt)} · ${esc(s.sal.how)}</dd><dt>Days</dt><dd>${s.sal.days}/${s.sal.of} worked${s.sal.leave ? ` · ${s.sal.leave} leave` : ''}</dd>${s.sal.cut ? `<dt>Unpaid leave</dt><dd>−${inr(s.sal.cut)}</dd>` : ''}</dl>${F('sal-a', 'Amount paid (₹)', s.sal.amt, { im: 'numeric', help: 'Change it for an advance, bonus or cut.' })}${F('sal-n', 'Note (optional)', '', { ph: 'e.g. ₹2,000 advance taken' })}`;
    foot = btns('Cancel', 'Mark paid', 'paySal', 'ok'); }
  if (m.t === 'addPlayer') { const p = m.p ? player(m.p) : null; const pre = m.pre || {}; title = p ? 'Edit ' + p.name : 'Add player';
    if (!B.batches.length) { h = empty('batch', 'Add a batch first. Players join a batch.'); foot = `<button class="btn btn-primary" type="button" data-act="addBatch">${ic('plus')}Add batch</button>`; }
    else { h = `<div class="grid g2">${F('ap-n', 'Player name', p ? p.name : pre.n)}${F('ap-dob', 'Date of birth', p ? p.dob : '', { type: 'date', max: B.today })}</div>
    <div class="grid g2">${SEL('ap-b', 'Batch', B.batches.map(b => [b.id, `${b.name} · ${inr(b.fee)}/mo`]), p ? p.batch : (m.b || pre.batch || B.batches[0].id))}${F('ap-no', 'Jersey number', p ? p.no : '', { im: 'numeric' })}</div>
    <div class="grid g2">${F('ap-p', 'Parent name', p ? p.parentName : pre.parent)}${F('ap-ph', 'Parent phone', p ? p.parentPhone : pre.phone, { type: 'tel', ph: 'For WhatsApp reminders' })}</div>
    ${F('ap-e', 'Parent email (their login)', p ? p.parentEmail : '', { type: 'email', ph: 'parent@gmail.com' })}
    ${role === 'admin' ? `<div class="grid g2">${F('ap-fee', 'Own monthly fee (optional)', p && p.feeCustom ? p.fee : '', { im: 'numeric', ph: 'Same as batch', help: 'Only for a special fee. Empty = batch fee.' })}${p ? '' : F('ap-j', 'Joined on', B.today, { type: 'date', max: B.today })}</div>` : ''}
    <div class="note">${ic('mail')}<span>The parent gets a login for the parent app. They can also sign in with Google using this email.</span></div>`;
    foot = btns('Cancel', p ? 'Save' : 'Add player', 'savePlayer', p ? 'ok' : 'plus'); } }
  if (m.t === 'staff') { const s = m.s ? B.staff.find(x => x.id === m.s) : null; title = s ? s.name : 'Add coach or manager';
    h = `${F('st-n', 'Name', s ? s.name : '')}${s ? `<dl class="kv"><dt>Email</dt><dd>${esc(s.email)}</dd><dt>Batches</dt><dd>${esc(B.batches.filter(b => b.coach === s.id).map(b => b.name).join(', ') || 'None')}</dd></dl>` : F('st-e', 'Email (their login)', '', { type: 'email' })}
    <div class="grid g2">${s ? '' : SEL('st-r', 'Role', [['coach', 'Coach: marks players, training, results'], ['manager', 'Manager: marks coaches, runs the day']], 'coach')}${F('st-t', 'Title', s ? s.title : '', { ph: 'e.g. Head coach' })}${F('st-ph', 'Phone', s ? s.phone : '', { type: 'tel' })}</div>
    <div class="grid g2">${SEL('st-pt', 'Pay', [['month', 'Fixed per month'], ['session', 'Per day worked']], s && s.pay ? s.pay.type : 'month')}${F('st-pa', 'Amount (₹)', s && s.pay ? s.pay.amt : '', { im: 'numeric' })}</div>${s && s.hist ? `<div><span class="label">Salary, last months</span><div class="list" style="margin:6px -16px 0">${s.hist.length ? s.hist.map(x => `<div class="row"><div class="grow"><b style="font-size:14px">${T.monthName(x.m)}</b><small class="faint" style="display:block;font-size:12.5px">${x.days} days worked${x.leave ? ` · ${x.leave} leave` : ''}${x.paid && x.paid.note ? ' · ' + esc(x.paid.note) : ''}</small></div><b class="tnum">${inr(x.paid ? x.paid.amt : x.amt)}</b>${x.paid ? '<span class="pill p-ok">Paid</span>' : '<span class="pill p-warn">Not paid</span>'}</div>`).join('') : '<div class="empty">No earlier months yet.</div>'}</div></div>` : ''}${s ? `<button class="btn btn-ghost btn-block" type="button" data-act="leaveModal" data-s="${s.id}">${ic('calendar')}Leave / holiday</button>` : ''}`;
    foot = s ? `<button class="btn btn-quiet" type="button" data-act="removeStaff" data-s="${s.id}">Remove</button><button class="btn btn-ghost" type="button" data-act="staffReset" data-s="${s.id}">New password</button><button class="btn btn-primary" type="button" data-act="saveStaff" data-s="${s.id}">${ic('ok')}Save</button>` : btns('Cancel', 'Add and make login', 'saveStaff', 'mail'); }
  if (m.t === 'creds') { title = 'Login for ' + m.name; const msg = `Hi ${first(m.name)}, here is your Veyra Academy login for ${B.academy.name}.\nOpen: ${location.href.split('#')[0]}#login\nEmail: ${m.login.email}${m.login.temp ? '\nPassword: ' + m.login.temp : ''}\nYou can also tap Continue with Google.`;
    h = `<div class="creds"><span class="label">Email</span><code>${esc(m.login.email)}</code>${m.login.temp ? `<span class="label">Password</span><code>${esc(m.login.temp)}</code>` : '<span class="faint">They already have an account. They use their own password or Google.</span>'}</div><p class="muted" style="font-size:14px">${LIVE && CFG.mail ? 'We also emailed this to them.' : 'Send this to them on WhatsApp. They can change the password after logging in.'}</p>`;
    foot = `<button class="btn btn-ghost" type="button" data-act="copyText" data-t="${esc(msg)}">${ic('copy')}Copy</button><a class="btn btn-primary" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${ic('chat')}Send on WhatsApp</a>`; }
  if (m.t === 'import') { title = 'Import players'; wide = true;
    if (m.done) { const d = m.done; h = `<div class="banner">${ic('ok')}<span class="grow"><b>${d.added} player${d.added === 1 ? '' : 's'} added.</b> ${d.parents ? `${d.parents} parent${d.parents === 1 ? '' : 's'} got their login by email.` : ''}</span></div>${d.bad.length ? `<span class="label">Skipped rows</span><div class="list">${d.bad.map(x => `<div class="row"><div class="grow"><b>Row ${x.row}${x.name ? ' · ' + esc(x.name) : ''}</b><small class="faint" style="display:block">${esc(x.why)}</small></div></div>`).join('')}</div>` : ''}`; foot = `<button class="btn btn-primary" type="button" data-act="close">Done</button>`; }
    else if (m.rows) { const rs = m.rows; h = `<p class="muted">${rs.length} player${rs.length === 1 ? '' : 's'} found in <b>${esc(m.file)}</b>. Check the first few:</p><div class="table-wrap"><table class="t"><thead><tr><th>Player</th><th>Batch</th><th class="hide-sm">Parent</th><th class="hide-sm">Parent email</th></tr></thead><tbody>${rs.slice(0, 6).map(r => `<tr><td><b>${esc(r.name || '—')}</b></td><td>${esc(r.batch || '—')}</td><td class="hide-sm">${esc(r.parentName || '—')}</td><td class="hide-sm">${esc(r.parentEmail || '—')}</td></tr>`).join('')}</tbody></table></div>${rs.length > 6 ? `<p class="faint" style="font-size:13px">and ${rs.length - 6} more</p>` : ''}<div class="note">${ic('mail')}<span>Parents with an email get their app login by email, the same as adding them one by one.</span></div>`;
      foot = `<button class="btn btn-ghost" type="button" data-act="importReset">Pick another file</button><button class="btn btn-primary" type="button" data-act="importGo">${ic('ok')}Add ${rs.length} player${rs.length === 1 ? '' : 's'}</button>`; }
    else { h = `<p class="muted">Bring all your players in at once from Excel or Google Sheets.</p><ol class="steps-ol"><li>Download the template and fill one row per player. Use your batch names exactly: ${B.batches.map(b => `<b>${esc(b.name)}</b>`).join(', ') || 'add a batch first'}.</li><li>In Excel: File › Save as › <b>CSV</b>. In Google Sheets: File › Download › <b>CSV</b>.</li><li>Pick the file below. You'll see a preview before anything is added.</li></ol>${m.err ? `<div class="banner bad">${ic('x')}<span class="grow">${esc(m.err)}</span></div>` : ''}<div class="grid g2"><button class="btn btn-ghost btn-lg btn-block" type="button" data-act="importTpl">${ic('down')}Download template</button><label class="btn btn-primary btn-lg btn-block" style="cursor:pointer">${ic('up')}Pick CSV file<input type="file" accept=".csv,text/csv" data-import="1" hidden></label></div>`; } }
  if (m.t === 'cash') { title = 'Record a payment'; const owe = B.players.filter(p => p.owes > 0 || openBills(p).length);
    h = owe.length ? `${SEL('c-p', 'Player', owe.map(p => [p.id, `${p.name} · owes ${inr(p.owes)}`]), m.p || owe[0].id)}<div id="c-months">${cashMonths(m.p || owe[0].id, m.m)}</div><div class="grid g2">${SEL('c-how', 'Paid by', [['Cash', 'Cash'], ['UPI', 'UPI (already checked)'], ['Bank transfer', 'Bank transfer'], ['Cheque', 'Cheque']], 'Cash')}${F('c-amt', 'Amount (₹)', '', { im: 'numeric', ph: 'Leave empty for the full bill' })}</div>` : empty('ok', 'Nobody owes anything right now.');
    foot = owe.length ? btns('Cancel', 'Save and send receipt', 'saveCash', 'ok') : ''; }
  if (m.t === 'receipt') { const p = player(m.p); const x = (B.payments || []).find(y => y.pid === m.p && y.m === m.m) || {}; const b = (p.bills || []).find(y => y.m === m.m) || {}; title = 'Receipt';
    h = `<div class="printable" style="display:grid;gap:14px"><div class="between"><span class="brand" style="padding:0">${logo()}<div><b>${esc(B.academy.name)}</b><small>${esc(B.academy.place)}</small></div></span></div><dl class="kv"><dt>Receipt</dt><dd class="mono">${esc(x.receipt || b.receipt || '')}</dd><dt>Player</dt><dd>${esc(p.name)}</dd><dt>Parent</dt><dd>${esc(p.parentName)}</dd><dt>For</dt><dd>${T.monthName(m.m)} fee</dd><dt>Paid on</dt><dd>${x.at || b.at ? T.full(T.date(x.at || b.at)) : ''}</dd><dt>Paid by</dt><dd>${esc(x.via || b.via || '')}${x.utr ? ' · ' + esc(x.utr) : ''}</dd><dt>Amount</dt><dd><b>${inr(x.amt || b.amt)}</b></dd></dl><p class="faint" style="font-size:12.5px">No GST charged. Made with Veyra Academy.</p></div>`;
    foot = `<button class="btn btn-ghost" type="button" data-act="close">Close</button><button class="btn btn-primary" type="button" data-act="print">${ic('down')}Print or save PDF</button>`; }
  if (m.t === 'squad') { const t = B.tournaments.find(x => x.id === U.tourn); title = 'Pick squad · ' + t.name; const pool = B.players.filter(p => !t.batch || p.batch === t.batch);
    h = `<p class="muted" style="font-size:14px">${t.batch ? esc(batch(t.batch).name) + ' players.' : 'All players.'} Injured players are marked.</p><div class="sq-grid">${pool.map(p => { const on = U.sq.includes(p.id); const inj = B.injuries.find(i => i.pid === p.id && i.status === 'out'); return `<button type="button" class="sq ${on ? 'on' : ''}" data-act="sq" data-p="${p.id}" aria-pressed="${on}">${jersey(p)}<span><b>${esc(p.name)}</b><small>${p.att == null ? 'New' : p.att + '% attendance'}${inj ? ' · <span style="color:var(--bad)">injured</span>' : ''}</small></span>${on ? ic('ok') : ''}</button>`; }).join('')}</div>`;
    foot = `<span class="faint" style="font-size:13px;margin-right:auto">${U.sq.length} picked</span><button class="btn btn-primary" type="button" data-act="saveSquad">${ic('ok')}Save and tell parents</button>`; }
  if (m.t === 'result') { const t = B.tournaments.find(x => x.matches.some(y => y.id === m.m)), mt = t.matches.find(y => y.id === m.m); title = 'Result vs ' + mt.vs;
    const opts = [['', 'Nobody']].concat(t.squad.map(pid => [pid, (player(pid) || { name: '?' }).name]));
    const sc = m.sc || (mt.scorers && mt.scorers.length ? mt.scorers.map(x => [...x]) : [['', 1]]);
    U.modal.sc = sc;
    h = `<div class="score-in"><label class="field" for="r-us"><span>${esc(us())}</span><input class="input tnum" id="r-us" inputmode="numeric" value="${mt.score ? mt.score[0] : ''}"></label><span class="disp" style="font-size:28px;padding-top:22px">–</span><label class="field" for="r-them"><span>${esc(mt.vs)}</span><input class="input tnum" id="r-them" inputmode="numeric" value="${mt.score ? mt.score[1] : ''}"></label></div>
    <span class="label">Who scored</span>${sc.map((s, i) => `<div class="sc-row"><select class="select" data-sc="${i}" aria-label="Scorer ${i + 1}">${opts.map(([v, l]) => `<option value="${v}" ${v === s[0] ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select><input class="input tnum" data-scn="${i}" inputmode="numeric" value="${s[1]}" aria-label="Goals"><button class="btn btn-quiet btn-sm" type="button" data-act="scDel" data-i="${i}" aria-label="Remove">${ic('x')}</button></div>`).join('')}<button class="btn btn-quiet btn-sm" type="button" data-act="scAdd" style="justify-self:start">${ic('plus')}Another scorer</button>
    ${SEL('r-potm', 'Player of the match', opts, mt.potm || '')}<div class="note">${ic('bell')}<span>Parents of the squad get the score, and the player of the match gets a certificate in their app.</span></div>`;
    foot = btns('Cancel', 'Save result', 'saveResult', 'ok'); }
  if (m.t === 'cert') { const p = player(m.p); let t, mt; B.tournaments.forEach(x => x.matches.forEach(y => { if (y.id === m.m) { t = x; mt = y; } })); title = 'Certificate'; wide = true;
    h = `<div class="cert printable"><div class="hstack" style="justify-content:center">${logo()}<b class="mono" style="font-size:11px;letter-spacing:.14em">${esc(B.academy.name.toUpperCase())}</b></div><span class="label">Player of the match</span><h2 class="disp" style="font-size:38px">${esc(p.name)}</h2><p class="muted">${esc(t.name)} · vs ${esc(mt.vs)} · ${T.full(mt.date)}</p><div class="cert-score tnum">${mt.score ? mt.score.join(' – ') : ''}</div><div class="cert-sign"><span>${esc(coachName(batch(p.batch)))}<small>Coach</small></span><span>${esc(B.academy.name)}<small>Academy</small></span></div></div>`;
    foot = `<button class="btn btn-ghost" type="button" data-act="close">Close</button><button class="btn btn-primary" type="button" data-act="print">${ic('down')}Print or save PDF</button>`; }
  if (m.t === 'injury') { title = 'Log an injury'; const pool = role === 'coach' ? B.players.filter(p => B.myBatches.includes(p.batch)) : B.players;
    h = `${SEL('i-p', 'Player', pool.map(p => [p.id, `${p.name} · ${batch(p.batch).name}`]), m.p || (pool[0] || {}).id)}${F('i-w', 'What happened', '', { ph: 'e.g. Twisted right ankle in a tackle' })}
    <div class="grid g2">${SEL('i-s', 'Can they train?', [['out', 'No, out'], ['light', 'Light training only']], 'out')}${F('i-b', 'Expected back', '', { type: 'date' })}</div>`;
    foot = btns('Cancel', 'Save and tell parent', 'saveInjury', 'ok'); }
  if (m.t === 'med') { const p = player(m.p), d = p.med || {}; title = 'Medical details · ' + p.name;
    h = `<div class="grid g2">${SEL('md-b', 'Blood group', [['', 'Not sure'], ...['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(x => [x, x])], d.blood || '')}${F('md-a', 'Allergies', d.allergy, { ph: 'e.g. Peanuts' })}</div>${F('md-n', 'Note for the coach', d.note, { ph: 'e.g. Carries an inhaler' })}<div class="grid g2">${F('md-en', 'Emergency contact name', d.ename)}${F('md-ep', 'Emergency phone', d.ephone, { type: 'tel' })}</div>`;
    foot = btns('Cancel', 'Save', 'saveMed', 'ok'); }
  if (m.t === 'exp') { title = 'Add expense'; h = `${F('e-n', 'What was it for', '', { ph: 'e.g. New bibs' })}<div class="grid g3">${F('e-a', 'Amount (₹)', '', { im: 'numeric' })}${SEL('e-c', 'Type', ['Equipment', 'Rent', 'Tournament', 'Travel', 'Medical', 'Marketing', 'Other'].map(x => [x, x]), 'Equipment')}${F('e-d', 'Date', B.today, { type: 'date', max: B.today })}</div>`; foot = btns('Cancel', 'Add expense', 'saveExp', 'plus'); }
  if (m.t === 'stock') { const k = m.id ? B.kit.find(x => x.id === m.id) : null; title = k ? 'Edit item' : 'Add item'; h = `${F('k-n', 'Item', k ? k.name : '', { ph: 'e.g. ' + ((B.sportInfo || {}).ball || 'Training cones') })}<div class="grid g2">${F('k-h', 'In stock', k ? k.have : '', { im: 'numeric' })}${F('k-m', 'Keep at least', k ? k.min : '', { im: 'numeric' })}</div>`; foot = (k ? `<button class="btn btn-quiet" type="button" data-act="delStock" data-id="${k.id}">Remove</button>` : '') + btns('Cancel', 'Save', 'saveStock', 'ok'); }
  if (m.t === 'kitGive') { const p = player(m.p); title = 'Kit for ' + p.name; h = `${SEL('kg-s', 'Size', ['XS', 'S', 'M', 'L', 'XL'].map(x => [x, x]), 'M')}<p class="faint" style="font-size:13px">Jersey #${p.no} with the name on the back.</p>`; foot = btns('Cancel', 'Mark given', 'saveKit', 'ok'); }
  if (m.t === 'batch') { const b = m.b ? batch(m.b) : null; title = b ? 'Edit ' + b.name : 'New batch'; const days = b ? b.days : [1, 3, 5];
    h = `<div class="grid g2">${F('b-n', 'Batch name', b ? b.name : '', { ph: 'e.g. U-10 Kickers' })}${F('b-a', 'Ages', b ? b.age : '', { ph: 'e.g. 8 to 10 yrs' })}</div>
    <div class="field"><span>Training days</span><div class="daypick">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" data-day="${d}" ${days.includes(d) ? 'checked' : ''} aria-label="${C.DOW[d]}"><span>${C.DOW[d]}</span></label>`).join('')}</div></div>
    <div class="grid g3">${F('b-t', 'Start time', b ? b.time : '07:00', { type: 'time' })}${F('b-m', 'Minutes', b ? b.mins : 60, { im: 'numeric' })}${F('b-f', 'Monthly fee (₹)', b ? b.fee : '', { im: 'numeric' })}</div>
    <div class="grid g2">${SEL('b-g', 'Ground', B.grounds.map(g => [g.id, g.name]), b ? b.ground : (B.grounds[0] || {}).id)}${SEL('b-c', 'Coach', [['', 'No coach yet'], ...B.staff.filter(s => s.role === 'coach').map(s => [s.id, s.name])], b ? b.coach : '')}</div>
    ${SEL('b-tint', 'Colour', [['blue', 'Blue'], ['green', 'Green'], ['red', 'Red'], ['lime', 'Gold'], ['slate', 'Slate']], b ? b.tint : C.TINTS[B.batches.length % 5])}`;
    foot = (b ? `<button class="btn btn-quiet" type="button" data-act="delBatch" data-b="${b.id}">Remove</button>` : '') + btns('Cancel', b ? 'Save' : 'Add batch', 'saveBatch', 'ok'); }
  if (m.t === 'cancel') { const b = batch(m.b); title = 'Cancel a session · ' + b.name; const next = B.week.filter(([d, ids]) => ids.includes(b.id)).map(([d]) => d); const offs = (b.off || []).filter(d => d >= B.today);
    h = `${next.length ? SEL('cx-d', 'Which day', next.map(d => [d, T.long(d)]), next[0]) + F('cx-w', 'Reason (parents see this)', '', { ph: 'e.g. Turf under maintenance' }) : '<p class="muted">No sessions in the next 7 days.</p>'}${offs.length ? `<span class="label">Already cancelled</span>${offs.map(d => `<div class="between"><span>${T.long(d)}</span><button class="btn btn-quiet btn-sm" type="button" data-act="undoOff" data-b="${b.id}" data-d="${d}">Put back on</button></div>`).join('')}` : ''}`;
    foot = next.length ? btns('Close', 'Cancel session and tell parents', 'saveCancel', 'bell') : ''; }
  if (m.t === 'tourn') { const t = m.id ? B.tournaments.find(x => x.id === m.id) : null; title = t ? 'Edit tournament' : 'New tournament';
    h = `${F('t-n', 'Name', t ? t.name : '', { ph: 'e.g. Navi Mumbai Youth Cup' })}<div class="grid g2">${SEL('t-c', 'Type', ['League', 'Cup', 'Friendly', 'Festival'].map(x => [x, x]), t ? t.cat : 'Cup')}${SEL('t-b', 'Batch', [['', 'Any batch'], ...B.batches.map(b => [b.id, b.name])], t ? t.batch : '')}</div>
    <div class="grid g2">${F('t-s', 'Starts', t ? t.start : '', { type: 'date' })}${F('t-e', 'Ends', t ? t.end : '', { type: 'date' })}</div>${F('t-v', 'Venue', t ? t.venue : '')}<div class="grid g2">${F('t-f', 'Format', t ? t.format : '', { ph: 'e.g. Groups, then knockouts' })}${F('t-x', 'Entry fee (₹)', t ? t.entry : '', { im: 'numeric', ph: 'Added to expenses' })}</div>`;
    foot = (t && role === 'admin' ? `<button class="btn btn-quiet" type="button" data-act="delTourn" data-v="${t.id}">Remove</button>` : '') + btns('Cancel', 'Save', 'saveTourn', 'ok'); }
  if (m.t === 'match') { const t = B.tournaments.find(x => x.id === U.tourn); title = 'Add match · ' + t.name; h = `${F('mt-vs', 'Against', '', { ph: 'Other team' })}<div class="grid g2">${F('mt-d', 'Date', t.start >= B.today ? t.start : B.today, { type: 'date' })}${F('mt-t', 'Kick-off', '08:00', { type: 'time' })}</div>${F('mt-v', 'Venue', t.venue)}`; foot = btns('Cancel', 'Add match', 'saveMatch', 'plus'); }
  if (m.t === 'tournResult') { const t = B.tournaments.find(x => x.id === m.id); title = 'Final place'; h = F('tr-r', 'How did the team finish?', t.result, { ph: 'e.g. Winners, Runners-up, Semi-final' }); foot = btns('Cancel', 'Save', 'saveTournResult', 'ok'); }
  if (m.t === 'enq') { const a = m.id ? B.adm.find(x => x.id === m.id) : null; title = a ? a.n : 'Add enquiry';
    h = `<div class="grid g2">${F('q-n', "Child's name", a ? a.n : '')}${SEL('q-a', 'Age group', [['', 'Not sure'], ...B.batches.map(b => [b.name, b.name])], a ? a.age : '')}</div><div class="grid g2">${F('q-p', 'Parent name', a ? a.parent : '')}${F('q-ph', 'Phone', a ? a.phone : '', { type: 'tel' })}</div>
    <div class="grid g2">${SEL('q-s', 'Came from', ['Walk-in', 'Instagram', 'Google', 'Referral', 'School camp', 'Facebook', 'Other'].map(x => [x, x]), a ? a.src : 'Walk-in')}${F('q-f', 'Monthly fee (₹)', a ? a.fee : '', { im: 'numeric' })}</div>${a && a.s === 'trial' ? F('q-t', 'Trial on', a.trial, { ph: 'e.g. Sat 6:30 AM' }) : ''}${F('q-no', 'Note', a ? a.note : '')}`;
    foot = a ? `<button class="btn btn-quiet" type="button" data-act="delEnq" data-id="${a.id}">Remove</button>${a.phone ? `<a class="btn btn-ghost" href="https://wa.me/${a.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}" target="_blank" rel="noopener">${ic('chat')}WhatsApp</a>` : ''}${a.pid ? '' : `<button class="btn btn-ghost" type="button" data-act="enrol" data-id="${a.id}">${ic('plus')}Add as player</button>`}<button class="btn btn-primary" type="button" data-act="saveEnq">${ic('ok')}Save</button>` : btns('Cancel', 'Add to Enquiry', 'saveEnq', 'plus'); }
  if (m.t === 'book') { title = 'Book ' + ground(U.ground).name; h = `<p class="muted">${T.long(m.d)}, ${T.t12(m.time)}</p>${F('bk-w', 'What for', '', { ph: 'e.g. Extra session U-12, rental' })}`; foot = btns('Cancel', 'Book slot', 'saveBook', 'ok'); }
  if (m.t === 'ground') { const g = m.id ? ground(m.id) : null; title = g ? 'Rename ground' : 'Add ground'; h = F('g-n', 'Ground name', g ? g.name : '', { ph: 'e.g. Turf 1, Sector 21' }); foot = (g && B.grounds.length > 1 ? `<button class="btn btn-quiet" type="button" data-act="delGround" data-v="${g.id}">Remove</button>` : '') + btns('Cancel', 'Save', 'saveGround', 'ok'); }
  if (m.t === 'drill') { title = 'New drill'; h = `${F('dr-n', 'Drill name', '')}<div class="grid g2">${SEL('dr-c', 'Type', ['Warm-up', 'Passing', 'Dribbling', 'Shooting', 'Attacking', 'Defending', 'Fitness', 'Goalkeeping', 'Game', 'Other'].map(x => [x, x]), 'Passing')}${F('dr-m', 'Minutes', 10, { im: 'numeric' })}</div>`; foot = btns('Cancel', 'Add drill', 'saveDrill', 'plus'); }
  if (m.t === 'reject') { title = 'Reject payment'; h = `${F('rj-w', 'Tell the parent why', 'We could not find this ID in our bank. Please check it and send again.')}`; foot = btns('Cancel', 'Reject', 'saveReject', 'x'); }
  if (m.t === 'wa') { title = 'Send on WhatsApp'; h = `<p class="muted" style="font-size:14px">The reminder is in their app${B.academy.settings.chan.email ? ' and email' : ''}. Tap each parent to send it on WhatsApp too.</p><div class="list" style="margin:0 -20px">${m.list.map(x => `<div class="row"><div class="grow"><b style="font-size:14px">${esc(x.name)}</b><small class="faint" style="display:block;font-size:12.5px">${esc(x.phone || 'No phone saved')}</small></div><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/${(x.phone || '').replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(x.text)}">${ic('chat')}Send</a></div>`).join('')}</div>`; foot = `<button class="btn btn-primary" type="button" data-act="close">Done</button>`; }
  if (m.t === 'buy') { title = 'Razorpay checkout (preview)'; const amt = CFG.plans[m.plan]; h = `<div class="banner">${ic('shield')}<span class="grow">This is the preview, so no money moves. On the live site this opens Razorpay for UPI, cards and net banking.</span></div><dl class="kv"><dt>Plan</dt><dd>${m.plan === 'yearly' ? 'Yearly' : 'Monthly'}</dd><dt>Academy</dt><dd>${esc(B.academy.name)}</dd><dt>Amount</dt><dd><b>${inr(amt)}</b> · no GST</dd></dl>`; foot = btns('Cancel', 'Pay ' + inr(amt) + ' (test)', 'buyTest', 'shield'); }
  if (m.t === 'more') { const r = route(); const R = ROLES[r.role]; title = 'Menu'; h = `<nav class="nav" style="display:grid;gap:2px">${R.tabs.map(([id, l, i]) => `<a href="#${r.role}-${id}" ${id === r.tab ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span></a>`).join('')}</nav>`; }
  if (m.t === 'bell') { title = 'Notifications'; h = `<div class="list" style="margin:-16px -20px">${B.feed.length ? B.feed.map(feedRow).join('') : '<div class="empty">Nothing yet.</div>'}</div>`; }
  if (m.t === 'account') { title = 'My account'; h = `<div class="who">${av(B.me.name, 'lg')}<div><b style="font-size:18px">${esc(B.me.name)}</b><small>${esc(B.me.email)} · ${ROLES[B.me.role].label} at ${esc(B.academy.name)}</small></div></div>
    ${role === 'parent' ? F('ac-ph', 'Your phone (for the academy)', (kids()[0] || {}).parentPhone, { type: 'tel' }) : ''}
    <div class="divider"></div><span class="label">Change password</span>${F('ac-old', 'Current password', '', { type: 'password', ac: 'current-password' })}${F('ac-new', 'New password', '', { type: 'password', ac: 'new-password', ph: 'At least 8 characters' })}`;
    foot = `<button class="btn btn-quiet" type="button" data-act="logout">${ic('logout')}Log out</button>${role === 'parent' ? `<button class="btn btn-ghost" type="button" data-act="savePhone">Save phone</button>` : ''}<button class="btn btn-primary" type="button" data-act="savePw">${ic('key')}Change password</button>`; }
  if (m.t === 'install') { title = 'Install Veyra Academy'; const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); const safari = ios && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA/.test(navigator.userAgent);
    const st = (n, b, t) => `<div class="step"><span class="n">${n}</span><div class="grow"><b>${b}</b><small>${t}</small></div></div>`;
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) h = `<div class="banner">${ic('ok')}<span class="grow">Veyra Academy is already installed on this device. It updates on its own.</span></div>`;
    else if (ios) h = (safari ? '' : `<div class="banner warn">${ic('phone')}<span class="grow">On iPhone, apps install from Safari. Open this page in Safari first.</span></div>`) + `<div class="steps">${st(1, 'Tap Share', 'The square with an arrow, at the bottom of Safari (top right on iPad).')}${st(2, 'Tap Add to Home Screen', 'Scroll the list down if you do not see it.')}${st(3, 'Tap Add', 'Veyra Academy appears on your home screen and opens full screen.')}</div>`;
    else h = `<div class="steps">${st(1, 'Android (Chrome)', 'Tap the ⋮ menu, then Install app or Add to Home screen.')}${st(2, 'iPhone and iPad (Safari)', 'Tap Share, then Add to Home Screen.')}${st(3, 'Laptop (Chrome or Edge)', 'Click the install icon at the right end of the address bar.')}</div>`;
    h += `<p class="faint" style="font-size:13px">The app always opens the latest version. There is nothing to update by hand.</p>`;
    foot = `<button class="btn btn-primary" type="button" data-act="close">Got it</button>`; }
  return `<div class="scrim" data-act="scrim"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="card-h"><h3>${esc(title)}</h3><button class="icon-btn" type="button" data-act="close" aria-label="Close" style="width:34px;height:34px">${ic('x')}</button></div><div class="card-b">${h}</div>${foot ? `<div class="card-f">${foot}</div>` : ''}</div></div>`;
}
function cashMonths(pid, sel) { const p = player(pid); const ob = (p.bills || []).filter(b => b.st === 'due' || b.st === 'overdue' || b.st === 'verify'); if (!ob.length) return '<p class="faint">Nothing open for this player.</p>'; return SEL('c-m', 'For which month', ob.map(b => [b.m, `${T.monthName(b.m)} · ${inr(b.amt)}${b.st === 'verify' ? ' · UPI being checked' : ''}`]), sel || ob[0].m); }

/* ---------- taps ---------- */
function openModal(m) { U.modal = m; U.menu = false; rerender(); setTimeout(() => { const f = document.querySelector('.modal input:not([type=checkbox]):not([type=file]), .modal select, .modal textarea'); if (f && !('ontouchstart' in window)) f.focus(); }, 30); }
function closeModal() { U.modal = null; if (U.stale) { U.stale = false; refresh(true).then(rerender); } else rerender(); }
function armed(a, label) { if (a.dataset.armed) return true; a.dataset.armed = '1'; const old = a.innerHTML; a.innerHTML = label || 'Tap again to confirm'; setTimeout(() => { if (a.isConnected) { a.innerHTML = old; delete a.dataset.armed; } }, 3500); return false; }
const showCreds = r => { if (r && r.data && r.data.login && r.data.login.temp) openModal({ t: 'creds', login: r.data.login, name: r.data.name }); };
function copy(text, msg) { try { navigator.clipboard.writeText(text).then(() => toast(msg || 'Copied'), () => toast(text)); } catch (_) { toast(text); } }
let installEvt = null; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]');
  if (!a) { if (U.menu && !e.target.closest('.menu')) { U.menu = false; rerender(); } return; }
  const d = a.dataset, act_ = d.act, M = U.modal || {};
  if (act_ === 'scrim' && e.target !== a) return;
  const role = B && B.me.role;
  const H = {
    menu: () => { U.menu = !U.menu; rerender(); },
    close: closeModal, scrim: closeModal,
    more: () => { e.preventDefault(); openModal({ t: 'more' }); },
    bell: () => { U.seenBefore = B.feedSeenAt; openModal({ t: 'bell' }); act('feed.seen', {}, { quiet: true, keep: true }); },
    goto: () => { U.modal = null; go(d.h); },
    account: () => openModal({ t: 'account' }),
    logout: async () => { await API.logout(); B = null; U.modal = null; U.menu = false; U.draft = {}; toast('Logged out'); go('login'); },
    resetDemo: async () => { if (!armed(a, 'Tap again to reset')) return; await DemoAPI.reset(); U.draft = {}; U.prog = {}; await DemoAPI.loginAs(role || 'admin'); await refresh(); U.menu = false; rerender(); toast('Demo data reset'); },
    switchTo: async () => { try { await API.switchTo(d.aid, d.role); await refresh(); U.menu = false; go(d.role); } catch (er) { fail(er); } },
    install: async () => { U.menu = false; if (installEvt) { installEvt.prompt(); installEvt = null; rerender(); } else openModal({ t: 'install' }); },
    google: () => LIVE ? showAuthErr('Google sign-in is still loading. Try again in a moment, or use your email.') : API.google().catch(er => showAuthErr(er.message)),
    openMark: () => { U.attBatch = d.b; U.attDay = 'today'; U.attMode = 'players'; go(role === 'coach' ? 'coach-mark' : role + '-attendance'); },
    pickBatch: () => { U.attBatch = d.b; rerender(); },
    pickBatchGo: () => { U.attBatch = d.b; U.attMode = 'players'; U.attDay = 'today'; },
    attDay: () => { U.attDay = d.v; rerender(); }, attMode: () => { U.attMode = d.v; rerender(); },
    mark: () => { (U.draft[d.k] = U.draft[d.k] || {})[d.p] = d.v; rerender(); },
    allP: () => { const m = U.draft[d.k] = U.draft[d.k] || {}; B.players.filter(p => p.batch === d.b).forEach(p => m[p.id] = 'P'); rerender(); },
    saveAtt: async () => { const r = await act('att.save', { bid: d.b, marks: U.draft[d.k] || {}, date: d.d }, { offline: true, link: role === 'coach' ? null : null }); if (r) delete U.draft[d.k]; rerender(); },
    smark: () => act('staff.mark', { sid: d.s, s: d.v, d: d.d }, { quiet: true }),
    breakModal: () => openModal({ t: 'break', p: d.p }),
    saveBreak: () => act('player.break', { id: U.modal.p, from: val('br-f'), to: val('br-t'), why: val('br-w') }),
    unbreak: () => act('player.break', { id: d.p, remove: +d.i }, { keep: true }),
    leaveModal: () => openModal({ t: 'sleave', s: d.s }),
    saveLeave: () => act('staff.leave', { sid: U.modal.s, from: val('lv-f'), to: val('lv-t'), paid: val('lv-p') === '1', why: val('lv-w') }),
    clearLeave: () => act('staff.leave', { sid: U.modal.s, from: val('lv-f'), to: val('lv-t'), clear: true }),
    salModal: () => openModal({ t: 'sal', s: d.s }),
    checkin: () => act('coach.checkin', {}),
    approve: () => act('fee.approve', { id: d.id }),
    reject: () => openModal({ t: 'reject', id: d.id }),
    saveReject: () => act('fee.reject', { id: M.id, why: val('rj-w') }),
    feeFilter: () => { U.feeFilter = d.v; rerender(); },
    markPaid: () => openModal({ t: 'cash', p: d.p, m: d.m }),
    cash: () => openModal({ t: 'cash' }),
    saveCash: () => act('fee.record', { pid: val('c-p'), m: val('c-m'), via: val('c-how'), amt: val('c-amt') }),
    waive: () => act('fee.waive', { pid: d.p, m: d.m }),
    receipt: () => openModal({ t: 'receipt', p: d.p, m: d.m }),
    print: () => window.print(),
    sendNow: async () => { const r = await act('fee.remind', {}); if (r && r.data && r.data.wa && r.data.wa.length) openModal({ t: 'wa', list: r.data.wa }); },
    remindOne: async () => { const r = await act('fee.remind', { pid: d.p }); if (r && r.data && r.data.wa && r.data.wa.length) openModal({ t: 'wa', list: r.data.wa }); },
    saveTpl: () => act('reminders.save', { tpl: val('tpl') }),
    parentReset: async () => showCreds(await act('parent.reset', { id: d.p })),
    addPlayer: () => openModal({ t: 'addPlayer', b: d.b }),
    editPlayer: () => openModal({ t: 'addPlayer', p: d.p }),
    viewPlayer: () => openModal({ t: 'player', p: d.p }),
    savePlayer: async () => { const f = { name: val('ap-n'), dob: val('ap-dob'), batch: val('ap-b'), no: val('ap-no'), parentName: val('ap-p'), parentPhone: val('ap-ph'), parentEmail: val('ap-e'), fee: role === 'admin' ? val('ap-fee') : null, joined: val('ap-j') };
      if (M.p) f.id = M.p; if (M.pre && M.pre.admId) f.admId = M.pre.admId;
      const r = await act(M.p ? 'player.update' : 'player.add', f); showCreds(r); },
    leave: () => { if (armed(a, 'Tap again: move to past players')) act('player.leave', { id: d.p }); },
    importPlayers: () => openModal({ t: 'import' }),
    importReset: () => { U.modal = { t: 'import' }; rerender(); },
    importTpl: () => download('veyra-academy-players.csv', '\ufeff' + csv([IMPORT_COLS.map(c => c[0]), ['Aarav Patil', (B.batches[0] || { name: 'U-10' }).name, '7', '14/03/2016', 'Sneha Patil', 'sneha@example.com', '9876543210', '', '']])),
    importGo: async () => { const M = U.modal; const r = await act('player.import', { rows: M.rows }, { quiet: true }); if (r && r.data) { U.modal = { t: 'import', done: r.data }; rerender(); } },
    exportPlayers: () => download('players.csv', csv([['Name', 'Jersey', 'Batch', 'Date of birth', 'Parent', 'Parent email', 'Parent phone', 'Attendance %', 'Monthly fee', 'Owes', 'Joined'], ...B.players.map(p => [p.name, p.no, batch(p.batch).name, p.dob, p.parentName, p.parentEmail, p.parentPhone, p.att == null ? '' : p.att, p.fee, p.owes || 0, p.joined])])),
    exportFees: () => download('fees.csv', csv([['Receipt', 'Paid on', 'Player', 'For month', 'Amount', 'Paid by', 'UPI ID'], ...(B.payments || []).map(x => [x.receipt, T.date(x.at), (player(x.pid) || { name: 'Past player' }).name, x.m, x.amt, x.via, x.utr])])),
    exportAtt: () => { const rows = [['Date', 'Batch', 'Player', 'Mark', 'Marked by']]; Object.keys(B.attHistory || {}).sort().forEach(dt => Object.entries(B.attHistory[dt]).forEach(([bid, r]) => Object.entries(r.marks).forEach(([pid, v]) => rows.push([dt, batch(bid).name, (player(pid) || { name: 'Past player' }).name, { P: 'Present', L: 'Late', A: 'Absent' }[v], r.by])))); download('attendance.csv', csv(rows)); },
    exportAll: async () => { if (LIVE) { location.href = '/api/export'; return; } download('veyra-academy-data.json', JSON.stringify(B, null, 2), 'application/json'); },
    addStaff: () => openModal({ t: 'staff' }),
    editStaff: () => openModal({ t: 'staff', s: d.s }),
    saveStaff: async () => { const f = { name: val('st-n'), title: val('st-t'), phone: val('st-ph'), payType: val('st-pt'), payAmt: val('st-pa') }; if (d.s) { f.id = d.s; act('staff.update', f); } else { f.email = val('st-e'); f.role = val('st-r'); showCreds(await act('staff.add', f)); } },
    removeStaff: () => { if (armed(a, 'Tap again: remove')) act('staff.remove', { id: d.s }); },
    staffReset: async () => showCreds(await act('staff.reset', { id: d.s })),
    addBatch: () => { if (role !== 'admin') return; openModal({ t: 'batch' }); },
    editBatch: () => openModal({ t: 'batch', b: d.b }),
    saveBatch: () => act('batch.save', { id: M.b, name: val('b-n'), age: val('b-a'), days: $$('[data-day]').filter(x => x.checked).map(x => +x.dataset.day), time: val('b-t'), mins: val('b-m'), fee: val('b-f'), ground: val('b-g'), coach: val('b-c'), tint: val('b-tint') }),
    delBatch: () => { if (armed(a, 'Tap again: remove')) act('batch.delete', { id: d.b }); },
    cancelSession: () => openModal({ t: 'cancel', b: d.b }),
    saveCancel: () => act('batch.off', { id: M.b, date: val('cx-d'), why: val('cx-w') }),
    undoOff: () => act('batch.off', { id: d.b, date: d.d }),
    addEnq: () => openModal({ t: 'enq' }),
    saveEnq: () => { const f = { n: val('q-n'), age: val('q-a'), parent: val('q-p'), phone: val('q-ph'), src: val('q-s'), fee: val('q-f'), note: val('q-no'), trial: val('q-t') }; if (M.id) act('adm.update', { id: M.id, ...f }); else act('adm.add', f); },
    delEnq: () => { if (armed(a, 'Tap again: remove')) act('adm.delete', { id: d.id }); },
    nextStage: e2 => { const x = B.adm.find(y => y.id === d.id); const k = STAGES.findIndex(s => s.id === x.s); moveTo(d.id, STAGES[k + 1].id); },
    enrol: () => { const x = B.adm.find(y => y.id === d.id); const bb = B.batches.find(b => b.name === x.age) || B.batches.find(b => x.age && b.name.toLowerCase().includes(x.age.toLowerCase())); openModal({ t: 'addPlayer', pre: { n: x.n, parent: x.parent, phone: x.phone, batch: bb && bb.id, admId: x.id } }); },
    delNotice: () => { if (armed(a, 'Tap again')) act('notice.delete', { id: d.id }); },
    newTourn: () => openModal({ t: 'tourn' }),
    editTourn: () => openModal({ t: 'tourn', id: d.v }),
    saveTourn: () => act('tourn.save', { id: M.id, name: val('t-n'), cat: val('t-c'), batch: val('t-b'), start: val('t-s'), end: val('t-e'), venue: val('t-v'), format: val('t-f'), entry: val('t-x') }),
    delTourn: () => { if (armed(a, 'Tap again: remove')) act('tourn.delete', { id: d.v }); },
    tourn: () => { U.tourn = d.v; if (a.tagName !== 'A') rerender(); },
    addMatch: () => openModal({ t: 'match' }),
    saveMatch: () => act('match.save', { tid: U.tourn, vs: val('mt-vs'), date: val('mt-d'), time: val('mt-t'), venue: val('mt-v') }),
    squad: () => { const t = B.tournaments.find(x => x.id === U.tourn); U.sq = [...t.squad]; openModal({ t: 'squad' }); },
    sq: () => { const i = U.sq.indexOf(d.p); if (i > -1) U.sq.splice(i, 1); else U.sq.push(d.p); rerender(); },
    saveSquad: () => act('tourn.squad', { id: U.tourn, squad: U.sq }),
    result: () => openModal({ t: 'result', m: d.m }),
    scAdd: () => { readSc(); U.modal.sc.push(['', 1]); rerender(); },
    scDel: () => { readSc(); U.modal.sc.splice(+d.i, 1); if (!U.modal.sc.length) U.modal.sc.push(['', 1]); rerender(); },
    saveResult: () => { readSc(); const t = B.tournaments.find(x => x.matches.some(y => y.id === M.m)); if (val('r-us') === '' || val('r-them') === '') return toast('Add both scores'); act('match.result', { tid: t.id, mid: M.m, us: val('r-us'), them: val('r-them'), scorers: U.modal.sc.filter(s => s[0]), potm: val('r-potm') }); },
    cert: () => openModal({ t: 'cert', p: d.p, m: d.m }),
    tournResult: () => openModal({ t: 'tournResult', id: d.v }),
    saveTournResult: () => act('tourn.result', { id: M.id, result: val('tr-r') }),
    pickPlan: () => { U.planB = d.b; U.planEdit = null; rerender(); },
    planEdit: () => { const s = B.plans[U.planB] || { focus: '', note: '', drills: [] }; U.planEdit = { b: U.planB, focus: s.focus, note: s.note, drills: [...s.drills] }; rerender(); },
    planCancel: () => { U.planEdit = null; rerender(); },
    planSave: async () => { readPlan(); const r = await act('plan.save', { bid: U.planB, focus: U.planEdit.focus, note: U.planEdit.note, drills: U.planEdit.drills }); if (r) { U.planEdit = null; rerender(); } },
    addDrill: () => { if (!U.planEdit || U.planEdit.b !== U.planB) H.planEdit(); readPlan(); U.planEdit.drills.push(d.id); rerender(); },
    drillDel: () => { readPlan(); U.planEdit.drills.splice(+d.i, 1); rerender(); },
    drillUp: () => { readPlan(); const x = U.planEdit.drills, i = +d.i; [x[i - 1], x[i]] = [x[i], x[i - 1]]; rerender(); },
    newDrill: () => { readPlan(); openModal({ t: 'drill' }); },
    saveDrill: () => act('drill.add', { name: val('dr-n'), cat: val('dr-c'), mins: val('dr-m') }),
    logInjury: () => openModal({ t: 'injury', p: d.p }),
    saveInjury: () => act('injury.add', { pid: val('i-p'), what: val('i-w'), status: val('i-s'), back: val('i-b') }),
    editMed: () => openModal({ t: 'med', p: d.p }),
    saveMed: () => act('medical.save', { pid: M.p, blood: val('md-b'), allergy: val('md-a'), note: val('md-n'), ename: val('md-en'), ephone: val('md-ep') }),
    docToggle: () => act('doc.set', { pid: d.p, key: d.k, clear: !!d.on }, { quiet: true }),
    askDocs: () => act('docs.ask', {}),
    addStock: () => openModal({ t: 'stock' }), editStock: () => openModal({ t: 'stock', id: d.id }),
    saveStock: () => act('kit.save', { id: M.id, name: val('k-n'), have: val('k-h'), min: val('k-m') }),
    delStock: () => { if (armed(a, 'Tap again: remove')) act('kit.delete', { id: d.id }); },
    qty: () => act('kit.qty', { id: d.id, d: +d.d }, { quiet: true }),
    giveKit: () => openModal({ t: 'kitGive', p: d.p }),
    saveKit: () => act('kit.give', { pid: M.p, size: val('kg-s') }),
    kitUndo: () => act('kit.give', { pid: d.p }),
    addExp: () => openModal({ t: 'exp' }),
    saveExp: () => act('expense.add', { what: val('e-n'), amt: val('e-a'), cat: val('e-c'), date: val('e-d') }),
    delExp: () => { if (armed(a, '×?')) act('expense.delete', { id: d.id }); },
    paySal: () => U.modal && U.modal.t === 'sal' ? act('salary.paid', { sid: U.modal.s, amt: val('sal-a'), note: val('sal-n') }) : act('salary.paid', { sid: d.s }),
    ground: () => { U.ground = d.v; rerender(); },
    addGround: () => openModal({ t: 'ground' }), editGround: () => openModal({ t: 'ground', id: d.v }),
    saveGround: () => act('ground.save', { id: M.id, name: val('g-n') }),
    delGround: () => { if (armed(a, 'Tap again: remove')) act('ground.delete', { id: d.v }); },
    book: () => openModal({ t: 'book', d: d.d, time: d.t }),
    saveBook: () => act('booking.add', { gid: U.ground, date: M.d, time: M.time, what: val('bk-w') }),
    unbook: () => { if (armed(a, 'Remove?')) act('booking.delete', { id: d.id }); },
    wish: () => act('wish', { pid: d.p }),
    child: () => { U.child = d.p; rerender(); },
    calM: () => { U.calM = d.v; rerender(); },
    pay: () => openModal({ t: 'pay', p: d.p, m: d.m }),
    payNext: () => { U.modal.step2 = true; rerender(); setTimeout(() => $('#utr') && $('#utr').focus(), 30); },
    payBack: () => { U.modal.step2 = false; rerender(); },
    paySubmit: async () => { const v = val('utr').replace(/\s/g, ''); if (!v && M.shot) return act('fee.pay', { pid: M.p, m: M.m, shot: M.shot.id }); if (!/^\d{12}$/.test(v)) { const er = $('#utrErr'); er.textContent = 'The ID has 12 digits. You typed ' + v.length + '.'; er.style.color = 'var(--bad)'; return; } act('fee.pay', { pid: M.p, m: M.m, utr: v }); },
    copyUpi: () => copy(B.academy.upi, 'UPI ID copied'),
    copyText: () => copy(d.t, 'Copied'),
    pip: () => { readProg(); U.prog[U.progP].scores[+d.k] = +d.n; rerender(); },
    saveProg: async () => { readProg(); const s = U.prog[U.progP]; const r = await act('progress.save', { pid: U.progP, scores: s.scores, note: s.note }); if (r) delete U.prog[U.progP]; rerender(); },
    plan: () => { U.planSel = d.v; rerender(); },
    buyPlan: async () => { if (!LIVE) return openModal({ t: 'buy', plan: U.planSel }); a.disabled = true; try { const r = await API.buyPlan(U.planSel); await refresh(); rerender(); toast(r.msg || 'Payment received. Your plan is on.'); } catch (er) { fail(er); } a.disabled = false; },
    buyTest: async () => { const r = await DemoAPI.buyPlan(M.plan); await refresh(); U.modal = null; rerender(); toast(r.msg, CFG.hosted ? undefined : { href: 'hq.html', label: 'See it in HQ' }); },
    lic: async () => { const code = val('lic'); if (!/^VFB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(code)) return toast('Keys look like VFB-XXXX-XXXX-XXXX'); try { const r = await API.activateKey(code); await refresh(); rerender(); toast(r.msg || 'Key activated'); } catch (er) { fail(er); } },
    saveFees: () => act('academy.save', { upi: val('s-upi'), payee: val('s-payee'), dueDay: val('s-due'), lateAfter: val('s-lateafter'), lateFee: val('s-late') }),
    saveAcademy: () => act('academy.save', { name: val('s-name'), place: val('s-place'), sport: val('s-sport'), selfCheckin: !!($('#s-self') || {}).checked }),
    savePw: async () => { try { const r = await API.changePw(val('ac-old'), val('ac-new')); closeModal(); toast(r.msg || 'Password changed'); } catch (er) { fail(er); } },
    savePhone: () => act('parent.phone', { phone: val('ac-ph') })
  };
  if (H[act_]) { if (a.tagName === 'BUTTON' && a.closest('form') && a.type === 'submit') return; await H[act_](); }
});
function readSc() { if (!U.modal || !U.modal.sc) return; U.modal.sc = U.modal.sc.map((s, i) => { const sel = document.querySelector(`[data-sc="${i}"]`), n = document.querySelector(`[data-scn="${i}"]`); return [sel ? sel.value : s[0], n ? Math.max(1, +n.value || 1) : s[1]]; }); }
function readPlan() { if (!U.planEdit) return; const f = $('#pl-focus'), n = $('#pl-note'); if (f) U.planEdit.focus = f.value; if (n) U.planEdit.note = n.value; }
function readProg() { const n = $('#progNote'); if (n && U.prog[U.progP]) U.prog[U.progP].note = n.value; }

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'pq') { U.pq = t.value; const pos = t.selectionStart; rerender(); const n = $('#pq'); n.focus(); n.setSelectionRange(pos, pos); }
  if (t.id === 'aq') { U.aq = t.value; $('#board').innerHTML = boardHTML(); }
  if (t.id === 'tpl') { const p = B.players.find(x => (x.bills || []).some(b => b.st === 'due' || b.st === 'overdue')); if (p) { const b = p.bills.find(x => x.st === 'due' || x.st === 'overdue'); $('#tplPrev').textContent = C.fillTpl({ settings: { tpl: t.value }, name: B.academy.name }, p, b, p.owes); } }
  if (t.id === 'utr') { t.value = t.value.replace(/\D/g, '').slice(0, 12); }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'pb') { U.pb = t.value; rerender(); }
  if (t.id === 'feeMonth') { U.feeMonth = t.value; rerender(); }
  if (t.id === 'sday') { U.sday = t.value; rerender(); }
  if (t.id === 'progP') { readProg(); U.progP = t.value; rerender(); }
  if (t.id === 'c-p') { $('#c-months').innerHTML = cashMonths(t.value); }
  if (t.dataset.rule) act('reminders.save', { rules: { [t.dataset.rule]: t.checked } }, { quiet: true }).then(() => toast(t.checked ? 'Reminder on' : 'Reminder off'));
  if (t.dataset.chan) act('reminders.save', { chan: { [t.dataset.chan]: t.checked } }, { quiet: true });
  if (t.id === 's-google') act('academy.save', { google: t.checked }, { quiet: true }).then(() => toast(t.checked ? 'Google sign-in on' : 'Google sign-in off'));
  if (t.dataset.inj) act('injury.status', { id: t.dataset.inj, status: t.value });
  if (t.dataset.import && t.files && t.files[0]) { const f = t.files[0];
    if (/\.xlsx?$/i.test(f.name)) { U.modal = { t: 'import', err: 'This is an Excel file. In Excel, use File › Save as › CSV, then pick that file.' }; return rerender(); }
    const r = readImport(await f.text(), f.name); U.modal = Object.assign({ t: 'import' }, r); rerender(); }
  if (t.dataset.shot && t.files && t.files[0] && U.modal) {
    const M = U.modal; try { const f = await shrinkImg(t.files[0]); const r = await API.upload(f, M.p, 'payshot'); M.shot = { id: r.id || 'demo', name: t.files[0].name }; rerender(); } catch (er) { fail(er); }
  }
  if (t.dataset.up && t.files && t.files[0]) {
    const f = t.files[0]; if (f.size > 4 * 1024 * 1024) return toast('Please pick a file under 4 MB');
    try { const r = await API.upload(f, t.dataset.p, t.dataset.up); await act('doc.set', { pid: t.dataset.p, key: t.dataset.up, file: r.id || '', name: f.name }); } catch (er) { fail(er); }
  }
});
/* player import: CSV from Excel or Google Sheets */
const IMPORT_COLS = [['Player name', 'name', /^(player\s*)?name$|^player$|^child/], ['Batch', 'batch', /^batch|^group|^team/], ['Jersey no', 'no', /jersey|^no\.?$|^number/], ['Date of birth', 'dob', /birth|dob/], ['Parent name', 'parentName', /parent.*name|father|mother|guardian/], ['Parent email', 'parentEmail', /e-?mail/], ['Parent phone', 'parentPhone', /phone|mobile|whatsapp/], ['Monthly fee', 'fee', /fee/], ['Joined on', 'joined', /join/]];
function parseCSV(text) {
  text = text.replace(/^\ufeff/, ''); const rows = []; let row = [], f = '', q = false;
  const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { row.push(f); f = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(c => c.trim())) rows.push(row); row = []; } else f += ch; }
  row.push(f); if (row.some(c => c.trim())) rows.push(row); return rows;
}
function isoDate(s) { s = String(s || '').trim(); if (!s) return ''; let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/); if (m) { const y = m[3].length === 2 ? (+m[3] > 40 ? '19' : '20') + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; } return ''; }
function readImport(text, name) {
  const rows = parseCSV(text); if (rows.length < 2) return { err: 'This file has no player rows. Use the template and save it as CSV.' };
  const head = rows[0].map(h => h.trim().toLowerCase()); const map = {}; IMPORT_COLS.forEach(([, k, re]) => { const i = head.findIndex((h, j) => re.test(h) && !Object.values(map).includes(j)); if (i >= 0) map[k] = i; });
  if (map.name == null) return { err: 'Could not find a "Player name" column. Use the template headings.' };
  const out = rows.slice(1).map(r => { const o = {}; Object.entries(map).forEach(([k, i]) => { o[k] = String(r[i] || '').trim(); }); o.dob = isoDate(o.dob); o.joined = isoDate(o.joined); o.fee = o.fee.replace(/[^\d]/g, ''); o.no = o.no.replace(/[^\d]/g, ''); return o; }).filter(o => o.name);
  if (!out.length) return { err: 'No player names found in the file.' };
  if (out.length > 500) return { err: 'Please import up to 500 players at a time.' };
  return { rows: out, file: name };
}
/* phone screenshots can be big: shrink to a 1600px JPEG before sending */
function shrinkImg(file) {
  return new Promise(res => { if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return res(file); const url = URL.createObjectURL(file); const im = new Image();
    im.onload = () => { const k = Math.min(1, 1600 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => res(b ? new File([b], (file.name || 'screenshot').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.82); };
    im.onerror = () => { URL.revokeObjectURL(url); res(file); }; im.src = url; });
}
document.addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target;
  if (f.id === 'authForm') {
    const kind = f.dataset.kind, em = val('f-em').toLowerCase(), pw = $('#f-pw') ? $('#f-pw').value : '';
    const btn = f.querySelector('[type=submit]'); showAuthErr('');
    if (kind !== 'reset' && !/^\S+@\S+\.\S+$/.test(em)) { showAuthErr('Enter your email'); $('#f-em').focus(); return; }
    if ((kind === 'signup' || kind === 'reset') && pw.length < 8) { showAuthErr('Use at least 8 characters for the password'); return; }
    if (kind === 'signup' && (!val('f-ac') || !val('f-nm'))) { showAuthErr('Add the academy name and your name'); return; }
    btn.disabled = true;
    try {
      if (kind === 'login') { const r = await API.login(em, pw); await afterLogin(r); }
      else if (kind === 'signup') { const r = await API.signup({ academy: val('f-ac'), sport: val('f-sport'), name: val('f-nm'), city: val('f-city'), phone: val('f-ph'), email: em, pw }); await afterLogin(Object.assign({ created: true }, r)); toast(`Academy created. Your ${CFG.plans.trial}-day trial has started.`); }
      else if (kind === 'forgot') { const r = await API.forgot(em); showAuthErr(''); toast(r.msg || 'If this email has an account, a link is on its way.'); }
      else if (kind === 'reset') { await API.resetPw(f.dataset.token, pw); toast('Password saved. Log in now.'); go('login'); }
    } catch (er) { showAuthErr(er.message); }
    btn.disabled = false;
  }
  if (f.id === 'noticeForm') { const t = val('n-title'); if (!t) { $('#n-title').focus(); return; } const r = await act('notice.post', { title: t, body: val('n-body'), to: val('n-to') }); if (r) f.reset(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (U.modal || U.menu)) { U.menu = false; closeModal(); }
  const c = e.target.closest && e.target.closest('.adm'); if (c && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { const x = B.adm.find(y => y.id === c.dataset.id), k = STAGES.findIndex(s => s.id === x.s);
    if (e.key === 'ArrowRight' && k < 3) { e.preventDefault(); moveTo(x.id, STAGES[k + 1].id); } if (e.key === 'ArrowLeft' && k > 0) { e.preventDefault(); moveTo(x.id, STAGES[k - 1].id); } }
  if (c && e.key === 'Enter' && e.target === c) openModal({ t: 'enq', id: c.dataset.id });
  if (e.target.dataset && e.target.dataset.act === 'pip' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('click', e => { const s = e.target.closest('[data-scroll]'); if (s) { e.preventDefault(); const el = document.getElementById(s.dataset.scroll); if (el) el.scrollIntoView({ behavior: 'smooth' }); } });

/* ---------- admissions drag (mouse at once, touch after a short hold so the board still scrolls) ---------- */
function moveTo(id, stage) {
  const x = B.adm.find(y => y.id === id); if (!x) return; const was = x.s; x.s = stage; x.at = Date.now();
  const b = $('#board'); if (b) { b.innerHTML = boardHTML(id); const c = b.querySelector(`.adm[data-id="${id}"]`); c && c.focus({ preventScroll: true }); }
  if (was !== stage) { toast(`${first(x.n)} moved to ${STAGES.find(s => s.id === stage).name}`); API.act('adm.move', { id, s: stage }).catch(er => { fail(er); refresh(true).then(rerender); }); }
}
let drag = null, holdT = null, moved = false;
document.addEventListener('pointerdown', e => {
  const card = e.target.closest('.adm'); if (!card || e.target.closest('.next') || e.button > 0) return;
  const start = { x: e.clientX, y: e.clientY }; moved = false;
  const begin = () => { const r = card.getBoundingClientRect(); const g = card.cloneNode(true); g.classList.add('ghost'); g.style.width = r.width + 'px';
    const st = STAGES.find(s => s.id === B.adm.find(y => y.id === card.dataset.id).s); g.insertAdjacentHTML('afterbegin', `<span class="stagetag">${st.name}</span>`); document.body.appendChild(g);
    drag = { card, g, id: card.dataset.id, dx: start.x - r.left, dy: start.y - r.top, lx: start.x, rot: 0, over: null, sx: start.x, sy: start.y }; card.classList.add('lift'); place(start.x, start.y); };
  if (e.pointerType === 'touch') { holdT = setTimeout(() => { holdT = null; begin(); }, 260);
    const cancel = ev => { if (holdT && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) { clearTimeout(holdT); holdT = null; moved = true; } };
    card.addEventListener('pointermove', cancel); card.addEventListener('pointerup', () => { const tap = !!holdT && !moved; clearTimeout(holdT); holdT = null; card.removeEventListener('pointermove', cancel); if (tap) openModal({ t: 'enq', id: card.dataset.id }); }, { once: true });
  } else { e.preventDefault(); begin(); }
});
function place(x, y) { const d = drag, v = x - d.lx; d.lx = x; d.rot += (Math.max(-8, Math.min(8, v * .6)) - d.rot) * .3; if (Math.hypot(x - d.sx, y - d.sy) > 6) moved = true;
  d.g.style.transform = `translate(${x - d.dx}px,${y - d.dy}px) rotate(${-4 + d.rot}deg) scale(1.03)`;
  const el = document.elementFromPoint(x, y), col = el && el.closest('.col');
  $$('.col').forEach(c => c.classList.toggle('over', c === col));
  if (col) { const st = STAGES.find(s => s.id === col.dataset.stage); d.g.style.setProperty('--c', TINT[st.t]); d.g.querySelector('.stagetag').textContent = st.name; }
  d.over = col; const b = $('#board'); if (b && b.scrollWidth > b.clientWidth) { const r = b.getBoundingClientRect(); if (x > r.right - 36) b.scrollLeft += 10; else if (x < r.left + 36) b.scrollLeft -= 10; } }
window.addEventListener('pointermove', e => { if (drag) { e.preventDefault(); place(e.clientX, e.clientY); } }, { passive: false });
window.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
const end = () => { if (!drag) return; const d = drag; drag = null; d.g.remove(); $$('.col').forEach(c => c.classList.remove('over'));
  if (!moved) { d.card.classList.remove('lift'); openModal({ t: 'enq', id: d.id }); return; }
  if (d.over) moveTo(d.id, d.over.dataset.stage); else d.card.classList.remove('lift'); if (U.stale) { U.stale = false; liveUpdate(); } };
window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);

function reveal() {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rv').forEach(el => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('pre'); io.observe(el); } });
}

/* ---------- start ---------- */
(async function init() {
  U.outbox = outbox.get().length;
  window.addEventListener('hashchange', () => { U.menu = false; U.modal = null; U.planEdit = null; render(); window.scrollTo(0, 0); countUp(); reveal(); });
  await refresh(true);
  render(); countUp(); reveal();
  API.subscribe(liveUpdate);
  if (LIVE) { flush(); if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {}); }
  /* installed app opens the user's own app, not the website */
  if ((window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) && !location.hash) location.hash = '#app';
  /* new version on the server: reload by itself when the person is not in the middle of something */
  if (LIVE && CFG.version) { const check = () => fetch('/healthz', { cache: 'no-store' }).then(r => r.json()).then(j => { if (j.version && j.version !== CFG.version) { const busy = U.modal || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)); if (busy) U.newVersion = true; else location.reload(); } }).catch(() => {}); setInterval(check, 10 * 60e3); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); }); }
  setInterval(() => { if (B && !U.modal && !drag && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { const t = B.today; refresh(true).then(() => { if (B && B.today !== t) { U.draft = {}; rerender(); } }); } }, 5 * 60 * 1000);
})();

/* ---------- Hindi and Marathi for the parent and coach apps ----------
   Buttons, labels and messages are translated. Names, notices, drills and anything the academy types stay as typed. */
const LANGS = [['en', 'English'], ['hi', 'हिंदी'], ['mr', 'मराठी']];
let LANG = (() => { try { const v = localStorage.getItem('vf-lang'); return ['hi', 'mr'].includes(v) ? v : 'en'; } catch (_) { return 'en'; } })();
function setLang(v) { LANG = ['hi', 'mr'].includes(v) ? v : 'en'; try { localStorage.setItem('vf-lang', LANG); } catch (_) {} document.documentElement.lang = LANG === 'en' ? 'en-IN' : LANG; rerender(); }
const i18nRole = () => !!(B && B.me && (B.me.role === 'parent' || B.me.role === 'coach'));
const i18nOn = () => LANG !== 'en' && i18nRole() && route().view === 'app';
function langPicker() { return i18nRole() ? `<label class="lang-pick" title="Language"><span class="sr">Language</span>${ic('globe')}<select data-lang aria-label="Language">${LANGS.map(([k, l]) => `<option value="${k}" ${k === LANG ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''; }

// English | Hindi | Marathi
const I18 = `Today|आज|आज
Take attendance|हाज़िरी लें|हजेरी घ्या
Training plan|ट्रेनिंग प्लान|ट्रेनिंग प्लॅन
Matches|मैच|सामने
Player progress|खिलाड़ी की प्रगति|खेळाडूची प्रगती
My attendance|मेरी हाज़िरी|माझी हजेरी
Notices|सूचनाएँ|सूचना
Home|होम|होम
Mark|हाज़िरी|हजेरी
Training|ट्रेनिंग|ट्रेनिंग
More|और|अधिक
Menu|मेन्यू|मेन्यू
Attendance|हाज़िरी|हजेरी
Fees|फ़ीस|फी
Progress & health|प्रगति और सेहत|प्रगती आणि आरोग्य
Progress|प्रगति|प्रगती
Coach app|कोच ऐप|कोच ॲप
Parent app|पेरेंट ऐप|पालक ॲप
Coach|कोच|कोच
Parent|पेरेंट|पालक
Head coach|मुख्य कोच|मुख्य कोच
Hi|नमस्ते|नमस्कार
Check in|चेक इन|चेक इन
On break|ब्रेक पर|ब्रेकवर
The academy marks your attendance.|आपकी हाज़िरी अकादमी लगाती है।|तुमची हजेरी अकॅडमी लावते.
You are on leave today.|आज आप छुट्टी पर हैं।|आज तुम्ही रजेवर आहात.
On leave|छुट्टी पर|रजेवर
Checked in|चेक इन हो गया|चेक इन झाले
My sessions today|आज के मेरे सेशन|आजचे माझे सेशन
Injured players|घायल खिलाड़ी|जखमी खेळाडू
Out|बाहर|बाहेर
Next match|अगला मैच|पुढचा सामना
Open|खोलें|उघडा
Latest notice|ताज़ा सूचना|नवीन सूचना
Tap All present, then change the few who missed.|पहले "सब मौजूद" दबाएँ, फिर जो नहीं आए उन्हें बदलें।|आधी "सगळे हजर" दाबा, मग जे आले नाहीत त्यांना बदला.
Not saved|सेव नहीं हुआ|सेव्ह झाले नाही
Saved|सेव हो गया|सेव्ह झाले
Present|मौजूद|हजर
Late|देर से|उशिरा
Absent|ग़ैरहाज़िर|गैरहजर
All present|सब मौजूद|सगळे हजर
Save and tell parents|सेव करें और पेरेंट्स को बताएँ|सेव्ह करा आणि पालकांना कळवा
Batch|बैच|बॅच
Your plan for each batch. Change it any time.|हर बैच का प्लान। कभी भी बदलें।|प्रत्येक बॅचचा प्लॅन. कधीही बदला.
Edit plan|प्लान बदलें|प्लॅन बदला
Drill library|ड्रिल लाइब्रेरी|ड्रिल लायब्ररी
New|नया|नवीन
Squads, fixtures, results, scorers and certificates.|टीम, मैच, नतीजे, गोल करने वाले और सर्टिफ़िकेट।|संघ, सामने, निकाल, गोल करणारे आणि प्रमाणपत्रे.
Coming up|आने वाले|येणारे
in squad|टीम में|संघात
played|खेले|खेळले
won|जीते|जिंकले
Upcoming|आने वाला|येणारा
Add result|नतीजा जोड़ें|निकाल जोडा
Squad|टीम|संघ
Pick squad|टीम चुनें|संघ निवडा
Goals|गोल|गोल
Assists|असिस्ट|असिस्ट
Parents see these ratings and your note in their app.|पेरेंट्स ऐप में ये रेटिंग और आपका नोट देखते हैं।|पालक ॲपमध्ये हे रेटिंग आणि तुमची नोंद पाहतात.
Player|खिलाड़ी|खेळाडू
NOT SHARED YET|अभी भेजा नहीं|अजून पाठवले नाही
Passing|पासिंग|पासिंग
Dribbling|ड्रिब्लिंग|ड्रिब्लिंग
Shooting|शूटिंग|शूटिंग
First touch|फ़र्स्ट टच|फर्स्ट टच
Fitness|फ़िटनेस|फिटनेस
Teamwork|टीमवर्क|टीमवर्क
Note for parents|पेरेंट्स के लिए नोट|पालकांसाठी नोंद
Save and share|सेव करें और भेजें|सेव्ह करा आणि पाठवा
What went well, what to work on next|क्या अच्छा रहा, आगे किस पर काम करना है|काय चांगले झाले, पुढे कशावर काम करायचे
No session|सेशन नहीं|सेशन नाही
Recent check-ins|हाल के चेक-इन|अलीकडचे चेक-इन
Post a notice|सूचना भेजें|सूचना पाठवा
Title|शीर्षक|शीर्षक
Send to|किसे भेजें|कोणाला पाठवायचे
Message|संदेश|संदेश
It shows in their app straight away.|यह तुरंत उनके ऐप में दिखेगा।|हे लगेच त्यांच्या ॲपमध्ये दिसेल.
Post notice|सूचना भेजें|सूचना पाठवा
All parents|सभी पेरेंट्स|सर्व पालक
e.g. Kit day on Saturday|जैसे: शनिवार को किट डे|उदा. शनिवारी किट डे
What should they know?|उन्हें क्या जानना चाहिए?|त्यांना काय कळायला हवे?
Next session|अगला सेशन|पुढचे सेशन
See calendar|कैलेंडर देखें|कॅलेंडर पाहा
No matches coming up.|अभी कोई मैच नहीं है।|सध्या कोणताही सामना नाही.
Child|बच्चा|मूल
Month|महीना|महिना
Past payments|पिछले भुगतान|मागील पेमेंट
Paid in cash to the coach or the office? That counts too. The academy marks it paid and you get a receipt here.|कोच या ऑफ़िस में नकद दिया? वह भी गिना जाएगा। अकादमी उसे भरा हुआ मार्क करेगी और आपको यहाँ रसीद मिलेगी।|कोच किंवा ऑफिसमध्ये रोख दिले? तेही चालते. अकादमी ते भरले म्हणून नोंदवेल आणि तुम्हाला इथे पावती मिळेल.
Player of the match|मैन ऑफ़ द मैच|सामनावीर
In the squad|टीम में|संघात
Certificate|सर्टिफ़िकेट|प्रमाणपत्र
Runners-up|उपविजेता|उपविजेता
Winners|विजेता|विजेता
Progress card|प्रगति कार्ड|प्रगती कार्ड
Coach's note|कोच का नोट|कोचची नोंद
Badges|बैज|बॅज
Health & forms|सेहत और फ़ॉर्म|आरोग्य आणि फॉर्म
Edit|बदलें|बदला
Blood group|ब्लड ग्रुप|रक्तगट
Allergies|एलर्जी|ॲलर्जी
None|कोई नहीं|काही नाही
Note for coach|कोच के लिए नोट|कोचसाठी नोंद
Emergency contact|इमरजेंसी संपर्क|आपत्कालीन संपर्क
Forms|फ़ॉर्म|फॉर्म
Birth certificate|जन्म प्रमाणपत्र|जन्म दाखला
Not added yet|अभी नहीं जोड़ा|अजून जोडले नाही
Upload|अपलोड करें|अपलोड करा
Photo|फ़ोटो|फोटो
Added|जोड़ा गया|जोडले
View|देखें|पाहा
Medical form|मेडिकल फ़ॉर्म|मेडिकल फॉर्म
Parent consent|पेरेंट की सहमति|पालकांची संमती
Amount|रकम|रक्कम
Pay to|किसे भरें|कोणाला भरायचे
Copy|कॉपी करें|कॉपी करा
Copied|कॉपी हो गया|कॉपी झाले
Open UPI app|UPI ऐप खोलें|UPI ॲप उघडा
On a phone, tap Open UPI app. On a laptop, scan the code with GPay, PhonePe or Paytm. Then come back and paste the transaction ID.|फ़ोन पर "UPI ऐप खोलें" दबाएँ। लैपटॉप पर GPay, PhonePe या Paytm से कोड स्कैन करें। फिर वापस आकर ट्रांज़ैक्शन ID डालें।|फोनवर "UPI ॲप उघडा" दाबा. लॅपटॉपवर GPay, PhonePe किंवा Paytm ने कोड स्कॅन करा. मग परत येऊन ट्रान्झॅक्शन ID टाका.
I have paid|मैंने भर दिया|मी भरले आहे
UPI transaction ID (12 digits)|UPI ट्रांज़ैक्शन ID (12 अंक)|UPI ट्रान्झॅक्शन ID (12 अंक)
In your UPI app, open the payment and look for “UPI transaction ID” or “UTR”.|अपने UPI ऐप में पेमेंट खोलें और “UPI transaction ID” या “UTR” देखें।|तुमच्या UPI ॲपमध्ये पेमेंट उघडा आणि “UPI transaction ID” किंवा “UTR” पाहा.
or|या|किंवा
Upload payment screenshot|पेमेंट का स्क्रीनशॉट भेजें|पेमेंटचा स्क्रीनशॉट पाठवा
Change|बदलें|बदला
Back|पीछे|मागे
Send to academy|अकादमी को भेजें|अकादमीला पाठवा
Close|बंद करें|बंद करा
Cancel|रद्द करें|रद्द करा
Save|सेव करें|सेव्ह करा
Done|हो गया|झाले
Notifications|सूचनाएँ|सूचना
Mark all read|सब पढ़ा हुआ करें|सगळे वाचले
No notifications yet|अभी कोई सूचना नहीं|अजून सूचना नाहीत
Paid|भरा हुआ|भरले
Overdue|बकाया|थकीत
To check|जाँच बाकी|तपासणी बाकी
Being checked|जाँच हो रही है|तपासणी सुरू आहे
Receipt|रसीद|पावती
Language|भाषा|भाषा
My account|मेरा अकाउंट|माझे खाते
Log out|लॉग आउट|लॉग आउट
Install the app|ऐप इंस्टॉल करें|ॲप इंस्टॉल करा
Sent. The academy will confirm soon.|भेज दिया। अकादमी जल्द ही पुष्टि करेगी।|पाठवले. अकादमी लवकरच खात्री करेल.
Checked in. Have a good session.|चेक इन हो गया। अच्छा सेशन हो।|चेक इन झाले. सेशन छान होवो.
Notice posted|सूचना भेज दी|सूचना पाठवली
Progress card shared with the parent|प्रगति कार्ड पेरेंट को भेज दिया|प्रगती कार्ड पालकांना पाठवले
Pick a batch|बैच चुनें|बॅच निवडा
Some marks are waiting. They send when the network is back.|कुछ हाज़िरी रुकी है। नेटवर्क आते ही भेजी जाएगी।|काही हजेरी थांबली आहे. नेटवर्क आल्यावर पाठवली जाईल.
Cash|नकद|रोख
Schedule|शेड्यूल|वेळापत्रक
Fixture|मैच|सामना
General|सामान्य|सामान्य
Kit|किट|किट
Holiday|छुट्टी|सुट्टी
Cup|कप|कप
League|लीग|लीग
Friendly|फ़्रेंडली|मैत्री सामना
🤝 Team player|🤝 टीम प्लेयर|🤝 टीम प्लेयर
Batting|बल्लेबाज़ी|फलंदाजी
Bowling|गेंदबाज़ी|गोलंदाजी
Fielding|फ़ील्डिंग|क्षेत्ररक्षण
Catching|कैच|झेल
Footwork|फ़ुटवर्क|फूटवर्क
Serve|सर्व|सर्व्ह
Smash|स्मैश|स्मॅश
Net play|नेट प्ले|नेट प्ले
Game sense|खेल की समझ|खेळाची समज
Forehand|फ़ोरहैंड|फोरहँड
Backhand|बैकहैंड|बॅकहँड
Volley|वॉली|व्हॉली
Defence|डिफ़ेंस|डिफेन्स
Freestyle|फ़्रीस्टाइल|फ्रीस्टाइल
Backstroke|बैकस्ट्रोक|बॅकस्ट्रोक
Breaststroke|ब्रेस्टस्ट्रोक|ब्रेस्टस्ट्रोक
Butterfly|बटरफ़्लाई|बटरफ्लाय
Starts and turns|स्टार्ट और टर्न|स्टार्ट आणि टर्न
Endurance|सहनशक्ति|सहनशक्ती
Balance|संतुलन|तोल
Stride|स्ट्राइड|स्ट्राइड
Turns|टर्न|टर्न
Stopping|रुकना|थांबणे
Speed|स्पीड|वेग
Confidence|आत्मविश्वास|आत्मविश्वास
Sprint start|स्प्रिंट स्टार्ट|स्प्रिंट स्टार्ट
Jumps|कूद|उडी
Throws|थ्रो|फेक
Technique|तकनीक|तंत्र
Forms|फ़ॉर्म|फॉर्म
Sparring|स्पारिंग|स्पारिंग
Flexibility|लचीलापन|लवचिकता
Discipline|अनुशासन|शिस्त
Focus|ध्यान|लक्ष
Coaching|कोचिंग|कोचिंग`;
const I18N = { hi: {}, mr: {} };
I18.split('\n').forEach(l => { const [en, hi, mr] = l.split('|'); I18N.hi[en] = hi; I18N.mr[en] = mr; });
const MONS = { hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'], mr: ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'] };
const DAYS = { hi: ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'], mr: ['रवि', 'सोम', 'मंगळ', 'बुध', 'गुरु', 'शुक्र', 'शनि'] };
const DAYSL = { hi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'], mr: ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'] };
const EN_M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EN_D = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DATEW = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Wed|Thu|Fri|Sat|AM|PM)\b/g;
function trDates(s) {
  // only short date-like labels; sentences the academy typed (notices, notes) stay exactly as written
  if (!/\d/.test(s) || /[.!?]\s|[.!?]$/.test(s) || (s.replace(DATEW, '').match(/[A-Za-z]{3,}/g) || []).length > 4) return s;
  s = s.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, w => MONS[LANG][EN_M.findIndex(m => m.startsWith(w))]);
  return s.replace(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/g, w => (w.length > 3 ? DAYSL : DAYS)[LANG][EN_D.findIndex(d => d.startsWith(w))]);
}
const M_ = w => { const i = EN_M.indexOf(w); return i < 0 ? w : MONS[LANG][i]; };
const num_ = s => String(s).replace(/(st|nd|rd|th)$/, '');
// patterns for sentences that carry a name, month or number
const I18P = [
  [/^Pay (\w+) by UPI$/, (m, a) => ({ hi: `${M_(a)} की फ़ीस UPI से भरें`, mr: `${M_(a)} ची फी UPI ने भरा` })],
  [/^Pay (\w+) fee$/, (m, a) => ({ hi: `${M_(a)} की फ़ीस भरें`, mr: `${M_(a)} ची फी भरा` })],
  [/^(January|February|March|April|May|June|July|August|September|October|November|December) fee$/, (m, a) => ({ hi: `${M_(a)} की फ़ीस`, mr: `${M_(a)} ची फी` })],
  [/^(January|February|March|April|May|June|July|August|September|October|November|December) attendance$/, (m, a) => ({ hi: `${M_(a)} की हाज़िरी`, mr: `${M_(a)} ची हजेरी` })],
  [/^Due (.+)$/, (m, a) => ({ hi: `${trDates(a)} तक भरें`, mr: `${trDates(a)} पर्यंत भरा` })],
  [/^(\d+) of (\d+) sessions$/, (m, a, b) => ({ hi: `${b} में से ${a} सेशन`, mr: `${b} पैकी ${a} सेशन` })],
  [/^(.+) · (\d+) of (\d+) days$/, (m, a, b, c) => ({ hi: `${trDates(a)} · ${c} में से ${b} दिन`, mr: `${trDates(a)} · ${c} पैकी ${b} दिवस` })],
  [/^#(\d+) · (\d+)% this month$/, (m, a, b) => ({ hi: `#${a} · इस महीने ${b}%`, mr: `#${a} · या महिन्यात ${b}%` })],
  [/^(.+) · (\d+)% attendance$/, (m, a, b) => ({ hi: `${a} · ${b}% हाज़िरी`, mr: `${a} · ${b}% हजेरी` })],
  [/^Paid (.+?) · (\w+) · (R-[\d-]+)$/, (m, a, b, c) => ({ hi: `${trDates(a)} को भरा · ${b === 'Cash' ? 'नकद' : b} · ${c}`, mr: `${trDates(a)} ला भरले · ${b === 'Cash' ? 'रोख' : b} · ${c}` })],
  [/^(.+)'s tournaments and stats$/, (m, a) => ({ hi: `${a} के टूर्नामेंट और आँकड़े`, mr: `${a} च्या स्पर्धा आणि आकडे` })],
  [/^You get a notification in this app as soon as the coach marks (.+) absent or late\.$/, (m, a) => ({ hi: `कोच जैसे ही ${a} को ग़ैरहाज़िर या देर से मार्क करेंगे, आपको इस ऐप में सूचना मिलेगी।`, mr: `कोच ${a} ला गैरहजर किंवा उशिरा नोंदवताच तुम्हाला या ॲपमध्ये सूचना मिळेल.` })],
  [/^₹([\d,]+) a month · due on the (\w+) · late fee ₹([\d,]+) after the (\w+)$/, (m, a, b, c, d) => ({ hi: `₹${a} हर महीने · ${num_(b)} तारीख तक · ${num_(d)} तारीख के बाद ₹${c} लेट फ़ीस`, mr: `₹${a} दरमहा · ${num_(b)} तारखेपर्यंत · ${num_(d)} तारखेनंतर ₹${c} लेट फी` })],
  [/^Coach (.+?) · (.+)$/, (m, a, b) => ({ hi: `कोच ${a} · ${b}`, mr: `कोच ${a} · ${b}` })],
  [/^Tap when you reach (.+)\. The time is saved for the manager\.$/, (m, a) => ({ hi: `${a} पहुँचकर दबाएँ। समय मैनेजर के लिए सेव हो जाएगा।`, mr: `${a} ला पोहोचल्यावर दाबा. वेळ मॅनेजरसाठी सेव्ह होईल.` })],
  [/^(\d+) SESSIONS?$/, (m, a) => ({ hi: `${a} सेशन`, mr: `${a} सेशन` })],
  [/^(\d+) players? picked$/, (m, a) => ({ hi: `${a} खिलाड़ी चुने`, mr: `${a} खेळाडू निवडले` })],
  [/^(\d+) played$/, (m, a) => ({ hi: `${a} खेले`, mr: `${a} खेळले` })],
  [/^Receipt (R-[\d-]+)$/, (m, a) => ({ hi: `रसीद ${a}`, mr: `पावती ${a}` })],
  [/^Notifications, (\d+) new$/, (m, a) => ({ hi: `सूचनाएँ, ${a} नई`, mr: `सूचना, ${a} नवीन` })],
  [/^(\w+ \d{4}) · by (.+)$/, (m, a, b) => ({ hi: `${trDates(a)} · ${b}`, mr: `${trDates(a)} · ${b}` })],
  [/^Added (\d+ \w+)$/, (m, a) => ({ hi: `${trDates(a)} को जोड़ा`, mr: `${trDates(a)} ला जोडले` })],
  [/^Saved\. (\d+) parents? told about an absence\.$/, (m, a) => ({ hi: `सेव हो गया। ${a} पेरेंट्स को ग़ैरहाज़िरी बताई।`, mr: `सेव्ह झाले. ${a} पालकांना गैरहजेरी कळवली.` })],
  [/^The transaction ID has 12 digits\. You typed (\d+)\.$/, (m, a) => ({ hi: `ट्रांज़ैक्शन ID में 12 अंक होते हैं। आपने ${a} डाले।`, mr: `ट्रान्झॅक्शन ID मध्ये 12 अंक असतात. तुम्ही ${a} टाकले.` })],
  [/^The ID has 12 digits\. You typed (\d+)\.$/, (m, a) => ({ hi: `ID में 12 अंक होते हैं। आपने ${a} डाले।`, mr: `ID मध्ये 12 अंक असतात. तुम्ही ${a} टाकले.` })],
  [/^Being checked · ID (\d+)$/, (m, a) => ({ hi: `जाँच हो रही है · ID ${a}`, mr: `तपासणी सुरू आहे · ID ${a}` })],
  [/^Being checked · screenshot sent$/, () => ({ hi: 'जाँच हो रही है · स्क्रीनशॉट भेजा', mr: 'तपासणी सुरू आहे · स्क्रीनशॉट पाठवला' })],
  [/^Screenshot added: $/, () => ({ hi: 'स्क्रीनशॉट जोड़ा: ', mr: 'स्क्रीनशॉट जोडला: ' })],
  [/^(.+) · (\d+) players?$/, (m, a, b) => ({ hi: `${a} · ${b} खिलाड़ी`, mr: `${a} · ${b} खेळाडू` })],
  [/^(.+) parents$/, (m, a) => ({ hi: `${a} के पेरेंट्स`, mr: `${a} चे पालक` })],
  [/^(.+) · updated (.+)$/, (m, a, b) => ({ hi: `${trDates(a)} · ${trDates(b)} को बदला`, mr: `${trDates(a)} · ${trDates(b)} ला बदलले` })],
  [/^⚽ (\d+) goals?$/, (m, a) => ({ hi: `⚽ ${a} गोल`, mr: `⚽ ${a} गोल` })],
  [/^⭐ Player of the match ×(\d+)$/, (m, a) => ({ hi: `⭐ मैन ऑफ़ द मैच ×${a}`, mr: `⭐ सामनावीर ×${a}` })],
  [/^Preview as (\w+)$/, (m, a) => ({ hi: `${I18N.hi[a] || a} के रूप में देखें`, mr: `${I18N.mr[a] || a} म्हणून पाहा` })],
  [/^(\d+) waiting to send$/, (m, a) => ({ hi: `${a} भेजना बाकी`, mr: `${a} पाठवणे बाकी` })]
];
function trS(s) {
  if (LANG === 'en' || !s) return s; const t = s.trim(); if (!t) return s;
  const D = I18N[LANG]; if (D[t]) return s.replace(t, D[t]);
  for (const [re, f] of I18P) { const m = t.match(re); if (m) return s.replace(t, f(...m)[LANG]); }
  return s.replace(t, trDates(t));
}
function trDom(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement && n.parentElement.closest('textarea,script,style,.utr,code,.no-tr') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const list = []; let n; while ((n = w.nextNode())) list.push(n);
  list.forEach(x => { const v = trS(x.nodeValue); if (v !== x.nodeValue) x.nodeValue = v; });
  root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(e => ['placeholder', 'aria-label', 'title'].forEach(a => { const v = e.getAttribute(a); if (v) { const t = trS(v); if (t !== v) e.setAttribute(a, t); } }));
}
document.addEventListener('change', e => { if (e.target.matches && e.target.matches('[data-lang]')) setLang(e.target.value); });
})();
