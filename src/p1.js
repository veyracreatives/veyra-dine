/* Veyra Academy — academy apps (admin, manager, coach, parent). Built from src/p*.js */
(function(){
'use strict';
const { ic, logo } = IC, C = VFC, T = C.T;
const CFG = Object.assign({ mode: 'demo', plans: { monthly: 1450, yearly: 8500, trial: 10 }, googleClientId: '', razorpayKeyId: '', mail: false, demoBase: '' }, window.VF_CFG || {});
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
    db = { users: {}, mem: [], ac: {}, ses: null, hq: { plans: { monthly: 1450, yearly: 8500, trial: 10 }, sales: [], keys: [], activity: [], seq: 41 } };
    const ac = C.demo(env(), Date.now()); db.ac[ac.id] = ac; db.demoAid = ac.id;
    const now = Date.now(), D = 864e5;
    db.hq.sales = [['Thane Tigers Football School', 'yearly', 8500, 'Razorpay', 2], ['Vashi United Juniors', 'monthly', 1450, 'Razorpay', 6], ['Belapur Ballers', 'yearly', 8500, 'Licence key', 12], ['Panvel Footie Kids', 'monthly', 1450, 'Razorpay', 27]].map(([academy, plan, amt, via, d], i) => ({ id: 'VFR-' + new Date().getFullYear() + '-00' + (38 + i), at: now - d * D, academy, plan, amt, via }));
    db.hq.others = [['Thane Tigers Football School', 'Ghodbunder Rd, Thane', 'yearly', 142, 300], ['Vashi United Juniors', 'Vashi, Navi Mumbai', 'monthly', 68, 24], ['Belapur Ballers', 'CBD Belapur', 'yearly', 91, 200], ['Panvel Footie Kids', 'New Panvel', 'monthly', 37, 3], ['Airoli Strikers Academy', 'Airoli', 'monthly', 44, -9]].map(([name, place, type, players, days]) => ({ name, place, type, players, until: now + days * D }));
    db.hq.activity = [['Thane Tigers Football School paid ₹8,500 for yearly (Razorpay)', 2], ['Vashi United Juniors paid ₹1,450 for monthly (Razorpay)', 6], ['Licence key made for Belapur Ballers (yearly)', 12], ['Airoli Strikers Academy plan ended', 16], ['Kickstart FC Academy started a trial', 1]].map(([text, d]) => ({ at: now - d * D, text })).sort((a, b) => b.at - a.at);
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
