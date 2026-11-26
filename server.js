/* Veyra Academy server. Node 18+, no framework.
   Data lives in ./data (db.json + daily backups + uploaded files). It is never wiped by an update. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), https = require('https');
const C = require('./public/core.js');
require('./public/icons.js'); const L = require('./public/landing.js');
const { Analytics } = require('./lib/analytics.js'); const { SEO } = require('./lib/seo.js');

const ROOT = __dirname, PUB = path.join(ROOT, 'public'), DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = +process.env.PORT || 3100, HOST = process.env.HOST || '127.0.0.1';
const BASE = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SECURE = BASE.startsWith('https');
const DAY = 864e5;
fs.mkdirSync(path.join(DATA, 'backups'), { recursive: true }); fs.mkdirSync(path.join(DATA, 'files'), { recursive: true });

/* ---------------- storage ---------------- */
const DBF = path.join(DATA, 'db.json');
let db;
function fresh() { return { users: {}, mem: [], academies: {}, sessions: {}, resets: {}, files: {}, payments: {}, hq: { pw: null, plans: { monthly: 1450, yearly: 8500, trial: 10 }, sales: [], keys: [], activity: [], seq: 0, settings: { razorpay: { keyId: '', keySecret: '', webhookSecret: '' }, googleClientId: '', smtp: { host: '', port: 465, user: '', pass: '', from: '' }, seo: { gsc: { sa: '', site: '' }, bing: { key: '' }, psi: { key: '' }, verify: { google: '', bing: '' } } }, hqSessions: {} } }; }
try { db = JSON.parse(fs.readFileSync(DBF, 'utf8')); } catch (e) { if (fs.existsSync(DBF)) { console.error('db.json could not be read. Not starting, so nothing is overwritten. Restore from data/backups.'); process.exit(1); } db = fresh(); }
// 2026-11-26: Veyra set new prices (₹1,450 a month, ₹8,500 a year). Applied once; later changes in HQ are kept.
if (db.hq && !db.hq.priceV) { db.hq.plans = Object.assign({}, db.hq.plans, { monthly: 1450, yearly: 8500 }); db.hq.priceV = 2; }
const F0 = fresh(); for (const k of Object.keys(F0)) if (db[k] == null) db[k] = F0[k]; for (const k of Object.keys(F0.hq)) if (db.hq[k] == null) db.hq[k] = F0.hq[k];
for (const k of Object.keys(F0.hq.settings)) if (db.hq.settings[k] == null) db.hq.settings[k] = F0.hq.settings[k];
for (const k of Object.keys(F0.hq.settings.seo)) if (db.hq.settings.seo[k] == null) db.hq.settings.seo[k] = F0.hq.settings.seo[k];
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(saveNow, 150); }
function saveNow() { const tmp = DBF + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DBF); }
function backup() {
  try { const f = path.join(DATA, 'backups', `db-${C.T.date()}.json`); if (!fs.existsSync(f) && fs.existsSync(DBF)) fs.copyFileSync(DBF, f);
    const all = fs.readdirSync(path.join(DATA, 'backups')).filter(x => x.startsWith('db-')).sort(); while (all.length > 60) fs.unlinkSync(path.join(DATA, 'backups', all.shift())); } catch (e) { console.error('backup failed', e.message); }
}
process.on('SIGINT', () => { saveNow(); process.exit(0); }); process.on('SIGTERM', () => { saveNow(); process.exit(0); });

/* HQ first-run code: printed once, kept in data/hq-setup-code.txt until HQ has a password */
if (!db.hq.pw) { const f = path.join(DATA, 'hq-setup-code.txt'); if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(6).toString('hex').toUpperCase() + '\n', { mode: 0o600 }); console.log('Veyra HQ setup code:', fs.readFileSync(f, 'utf8').trim(), '(open /hq to set the HQ password)'); }

/* ---------------- helpers ---------------- */
const hashPw = pw => { const salt = crypto.randomBytes(16).toString('hex'); return salt + ':' + crypto.scryptSync(String(pw), salt, 32).toString('hex'); };
const checkPw = (pw, h) => { if (!h) return false; const [salt, x] = h.split(':'); const y = crypto.scryptSync(String(pw), salt, 32).toString('hex'); return crypto.timingSafeEqual(Buffer.from(x, 'hex'), Buffer.from(y, 'hex')); };
const tempPw = () => 'vf-' + crypto.randomBytes(4).toString('hex');
const tok = () => crypto.randomBytes(24).toString('hex');
const lc = s => String(s || '').trim().toLowerCase();
const userByEmail = e => Object.values(db.users).find(u => u.email === lc(e));
function cookies(req) { const o = {}; (req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
const setCookie = (res, name, v, maxAge) => res.setHeader('Set-Cookie', `${name}=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE ? '; Secure' : ''}`);
// only real keys: blocks __proto__ / constructor tricks on lookups by a value the browser sent
const GPEND = new Map(); // Google sign-ups waiting for their academy details (30 min)
const own = (o, k) => typeof k === 'string' && k && o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); };
function send(res, code, body, type, extra) { res.writeHead(code, Object.assign({ 'content-type': type || 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin', 'x-frame-options': 'DENY', 'content-security-policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'", 'permissions-policy': 'camera=(self), microphone=(), geolocation=()' }, SECURE ? { 'strict-transport-security': 'max-age=31536000' } : {}, extra || {})); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); }
const bad = (res, msg, code) => send(res, code || 400, { error: msg });
function body(req, limit) { return new Promise((ok, no) => { let n = 0; const ch = []; req.on('data', c => { n += c.length; if (n > (limit || 1e6)) { no(Object.assign(new Error('Too big'), { code: 413 })); req.destroy(); } else ch.push(c); }); req.on('end', () => { const raw = Buffer.concat(ch); req.raw = raw; try { ok(raw.length ? JSON.parse(raw) : {}); } catch (e) { no(Object.assign(new Error('Bad JSON'), { code: 400 })); } }); req.on('error', no); }); }
const hits = new Map();
function limited(req, key, max, win) { const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); const k = key + ip; const now = Date.now(); const h = (hits.get(k) || []).filter(t => now - t < win); h.push(now); hits.set(k, h); return h.length > max; }
/* ---------------- visitor stats + SEO (free, self-hosted) ---------------- */
const FUNNEL = [
  { label: 'Visited the website', match: e => e.t === 'view' },
  { label: 'Clicked Free trial', match: e => e.t === 'click' && (/#signup/.test(e.x || '') || /trial/i.test(e.n || '')) },
  { label: 'Opened the sign-up form', match: e => e.t === 'view' && e.h === '#signup' },
  { label: 'Started filling it in', match: e => e.t === 'form' && e.n === 'signup' },
  { label: 'Trial started', match: e => e.t === 'signup' },
  { label: 'Paid for a plan', match: e => e.t === 'paid' }];
const A = Analytics({ dataDir: DATA, base: BASE, funnel: FUNNEL });
const HOST_NAME = (() => { try { return new URL(BASE).hostname; } catch (_) { return 'localhost'; } })();
const seo = SEO({ dataDir: DATA, base: BASE, host: HOST_NAME, settings: () => db.hq.settings.seo });
const SEO_WORDS = ['sports academy', 'football academy', 'cricket academy', 'Navi Mumbai', 'Thane', 'attendance', 'fee'];
function hqLog(text) { db.hq.activity.unshift({ at: Date.now(), text }); if (db.hq.activity.length > 500) db.hq.activity.length = 500; }

/* ---------------- email (optional: npm i nodemailer, then fill SMTP in HQ) ---------------- */
let mailer = null, mailerKey = '';
function mail(to, subject, text) {
  const s = db.hq.settings.smtp; if (!s.host || !s.user || !s.pass || !to) return false;
  try { if (!mailer || mailerKey !== s.host + s.user + s.pass) { mailer = require('nodemailer').createTransport({ host: s.host, port: +s.port || 465, secure: +s.port !== 587, auth: { user: s.user, pass: s.pass } }); mailerKey = s.host + s.user + s.pass; }
    mailer.sendMail({ from: s.from || `Veyra Academy <${s.user}>`, to, subject, text: text + '\n\nQuestions? marketing@veyracreatives.com' }).catch(e => console.error('mail', e.message)); return true; } catch (e) { console.error('mail setup', e.message); return false; }
}
const mailOn = () => { const s = db.hq.settings.smtp; return !!(s.host && s.user && s.pass); };

/* ---------------- people & academies ---------------- */
const env = {
  url: BASE,
  ensureUser({ email, name, pw }) { const e = lc(email); const ex = userByEmail(e); if (ex) return { uid: ex.id }; const temp = pw || tempPw(); const id = C.id('u'); db.users[id] = { id, email: e, name: String(name || '').slice(0, 60), pw: hashPw(temp), createdAt: Date.now() }; return { uid: id, temp: pw ? undefined : temp }; },
  link(uid, aid, role, sid) { if (!db.mem.some(m => m.uid === uid && m.aid === aid && m.role === role)) db.mem.push({ uid, aid, role, sid: sid || '' }); },
  unlink(uid, aid, role) { db.mem = db.mem.filter(m => !(m.uid === uid && m.aid === aid && m.role === role)); Object.entries(db.sessions).forEach(([t, s]) => { if (s.uid === uid && s.aid === aid && s.role === role) delete db.sessions[t]; }); },
  resetPw(uid) { const t = tempPw(); db.users[uid].pw = hashPw(t); Object.entries(db.sessions).forEach(([k, s]) => { if (s.uid === uid) delete db.sessions[k]; }); return t; },
  mail
};
function session(req) { const t = cookies(req).vfs; const s = own(db.sessions, t); if (!s || s.exp < Date.now()) return null; const ok = db.mem.some(m => m.uid === s.uid && m.aid === s.aid && m.role === s.role); if (!ok || !db.users[s.uid] || !db.academies[s.aid]) return null; s.t = t; return s; }
function startSession(res, uid, pick) {
  const ms = db.mem.filter(m => m.uid === uid); if (!ms.length) return null;
  const order = { admin: 0, manager: 1, coach: 2, parent: 3 };
  const m = (pick && ms.find(x => x.aid === pick.aid && x.role === pick.role)) || ms.sort((a, b) => order[a.role] - order[b.role])[0];
  const t = tok(); db.sessions[t] = { uid, aid: m.aid, role: m.role, sid: m.sid, exp: Date.now() + 60 * DAY }; setCookie(res, 'vfs', t, 60 * 86400);
  Object.entries(db.sessions).forEach(([k, s]) => { if (s.exp < Date.now()) delete db.sessions[k]; });
  save(); return db.sessions[t];
}
function me(s) { const u = db.users[s.uid]; return { uid: u.id, role: s.role, sid: s.sid, name: u.name, email: u.email }; }
function bootFor(s) {
  const ac = db.academies[s.aid];
  const memberships = db.mem.filter(m => m.uid === s.uid).map(m => ({ aid: m.aid, role: m.role, name: (db.academies[m.aid] || {}).name }));
  return C.boot(ac, me(s), Date.now(), { memberships });
}

/* ---------------- live updates (Server-Sent Events) ---------------- */
const subs = new Map(); // aid -> Set(res)
function sub(aid, res) { if (!subs.has(aid)) subs.set(aid, new Set()); subs.get(aid).add(res); }
function ping(aid) { const s = subs.get(aid); if (!s) return; const v = (db.academies[aid] || {}).v; for (const r of s) { try { r.write(`data: ${v}\n\n`); } catch (_) {} } }
setInterval(() => { for (const s of subs.values()) for (const r of s) { try { r.write(': keep\n\n'); } catch (_) {} } }, 25000);

/* ---------------- plans ---------------- */
function recordSale(ac, plan, amt, via, ref) {
  db.hq.seq = (db.hq.seq || 0) + 1;
  const sale = { id: `VFR-${C.T.date().slice(0, 4)}-${String(db.hq.seq).padStart(4, '0')}`, at: Date.now(), aid: ac ? ac.id : '', academy: ac ? ac.name : '', plan, amt, via, ref: ref || '' };
  db.hq.sales.unshift(sale); return sale;
}
function applyPaid(aid, plan, amt, paymentId, orderId) {
  if (own(db.payments, paymentId)) return db.payments[paymentId];
  const ac = db.academies[aid]; if (!ac) return null;
  C.applyPlan(ac, plan, Date.now());
  const sale = recordSale(ac, plan, amt, 'Razorpay', paymentId);
  db.payments[paymentId] = { aid, plan, amt, orderId, at: Date.now(), sale: sale.id };
  hqLog(`${ac.name} paid ₹${amt.toLocaleString('en-IN')} for ${plan} (Razorpay ${paymentId})`); A.server(ac.vid, 'paid', { n: ac.name, id: ac.id, amt });
  const owner = db.users[(ac.admins || [])[0]];
  if (owner) mail(owner.email, `Payment received: Veyra Academy ${plan} plan`, `Hi ${owner.name},\n\nWe received ₹${amt.toLocaleString('en-IN')} for the ${plan} plan of ${ac.name}.\nReceipt: ${sale.id}\nPaid until: ${C.T.full(C.T.date(ac.plan.until))}\nNo GST charged.\n`);
  save(); ping(aid); return db.payments[paymentId];
}
function rzp(method, p, payload) {
  const { keyId, keySecret } = db.hq.settings.razorpay;
  return new Promise((ok, no) => {
    const data = payload ? JSON.stringify(payload) : '';
    const r = https.request({ host: 'api.razorpay.com', path: '/v1' + p, method, headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), authorization: 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64') } }, res => { let s = ''; res.on('data', c => s += c); res.on('end', () => { let j = {}; try { j = JSON.parse(s); } catch (_) {} if (res.statusCode >= 300) no(new Error((j.error && j.error.description) || 'Razorpay error')); else ok(j); }); });
    r.on('error', no); r.end(data);
  });
}
function googleCheck(credential) {
  return new Promise((ok, no) => {
    https.get('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), res => { let s = ''; res.on('data', c => s += c); res.on('end', () => { try { const j = JSON.parse(s); if (res.statusCode !== 200) return no(new Error('Google sign-in failed')); if (j.aud !== db.hq.settings.googleClientId) return no(new Error('Google sign-in is not set up for this site')); if (String(j.email_verified) !== 'true') return no(new Error('Your Google email is not verified')); ok(j); } catch (e) { no(new Error('Google sign-in failed')); } }); }).on('error', () => no(new Error('Could not reach Google')));
  });
}

/* ---------------- pages ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };
const VERSION = require('./package.json').version;
function cfg(mode) { const p = db.hq.plans; return { mode, plans: p, googleClientId: mode === 'live' ? db.hq.settings.googleClientId : '', razorpayKeyId: db.hq.settings.razorpay.keyId, mail: mailOn(), demoBase: mode === 'live' ? '/demo' : '', hosted: true, version: VERSION }; }
function page(mode) {
  const p = db.hq.plans; const c = cfg(mode);
  let h = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  h = h.replace(/{{TRIAL}}/g, p.trial).replace(/{{MONTHLY_F}}/g, p.monthly.toLocaleString('en-IN')).replace(/{{YEARLY_F}}/g, p.yearly.toLocaleString('en-IN')).replace(/{{MONTHLY}}/g, p.monthly).replace(/{{YEARLY}}/g, p.yearly).replace(/{{URL}}/g, BASE);
  const V = db.hq.settings.seo.verify; const metas = (mode === 'live' && V.google ? `<meta name="google-site-verification" content="${String(V.google).replace(/[^\w-]/g, '')}">` : '') + (mode === 'live' && V.bing ? `<meta name="msvalidate.01" content="${String(V.bing).replace(/[^\w-]/g, '')}">` : '');
  h = h.replace('<!--CFG-->', `${metas}<script>window.VF_CFG=${JSON.stringify(c).replace(/</g, '\\u003c')}</script><script src="/va.js?v=${VERSION}" defer></script>`);
  h = h.replace(/(href|src)="(style\.css|app\.css|core\.js|icons\.js|landing\.js|app\.js)"/g, `$1="/$2?v=${VERSION}"`);
  h = h.replace('<!--LD-->', mode === 'live' ? L.ld(c, BASE) : '');
  if (mode === 'live') h = h.replace('<!--LANDING-->', L.render(c, globalThis.IC));
  else h = h.replace('<meta name="description"', '<meta name="robots" content="noindex"><meta name="description"');
  return h;
}
function staticFile(res, rel) {
  if (/^(hq\.html|hq\.js|index\.html)$/.test(rel)) return false;
  const f = path.normalize(path.join(PUB, rel)); if (!f.startsWith(PUB + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return false;
  const ext = path.extname(f); const long = /\.(png|svg|css|js)$/.test(ext) && rel !== 'sw.js';
  send(res, 200, fs.readFileSync(f), MIME[ext] || 'application/octet-stream', { 'cache-control': long ? 'public, max-age=86400' : 'no-cache' }); return true;
}

/* ---------------- daily jobs: reminders at 9 AM, trial emails, backups ---------------- */
let lastRun = '';
function daily() {
  const now = Date.now(), today = C.T.date(now), hr = new Date(now + 19800000).getUTCHours();
  backup();
  if (hr < 9 || lastRun === today) return; lastRun = today;
  for (const ac of Object.values(db.academies)) {
    if (!C.planActive(ac, now)) continue;
    const R = ac.settings.rules; ac.autoDone = ac.autoDone || {}; if (ac.autoDone[today]) continue; ac.autoDone[today] = 1;
    const ctx = { uid: 'system', role: 'admin', sid: '', name: ac.name, now };
    ac.players.filter(p => !p.left).forEach(p => {
      const open = C.openBills(ac, p, today).filter(b => b.st !== 'verify'); if (!open.length) return;
      const b = open[0]; const dd = Math.round((Date.parse(today) - Date.parse(b.due)) / DAY);
      const fire = (R.before && dd === -3) || (R.due && dd === 0) || (R.after && dd === 3) || (R.weekly && dd > 3 && (dd - 3) % 7 === 0);
      if (!fire) return;
      try { C.act(ac, ctx, 'fee.remind', { pid: p.id }, env); } catch (_) {}
    });
    const owner = db.users[(ac.admins || [])[0]]; const left = Math.ceil((ac.plan.until - now) / DAY);
    if (owner && [3, 1, 0].includes(left)) mail(owner.email, left ? `Your Veyra Academy ${ac.plan.type === 'trial' ? 'trial' : 'plan'} ends in ${left} day${left === 1 ? '' : 's'}` : `Your Veyra Academy ${ac.plan.type === 'trial' ? 'trial' : 'plan'} ends today`, `Hi ${owner.name},\n\nPick a plan to keep ${ac.name} running: ${BASE}/#admin-setup\nMonthly ₹${db.hq.plans.monthly.toLocaleString('en-IN')} or yearly ₹${db.hq.plans.yearly.toLocaleString('en-IN')}. No GST. Your data is always kept.\n`);
    ping(ac.id);
  }
  save();
}
setInterval(daily, 30 * 60 * 1000); setTimeout(daily, 5000);

/* ---------------- HQ ---------------- */
function hqToken(req) { return String(req.headers['x-hq-token'] || '') || cookies(req).vfhq; }
function hqSession(req) { const t = hqToken(req); const s = own(db.hq.hqSessions, t); if (!s || s.exp < Date.now()) return null; s.exp = Date.now() + 30 * 60 * 1000; return s; }
function hqState() {
  const now = Date.now();
  const acs = Object.values(db.academies).map(ac => { const owner = db.users[(ac.admins || [])[0]] || {}; return { id: ac.id, name: ac.name, place: ac.place, sport: C.sportOf(ac).name, plan: ac.plan.type, until: ac.plan.until, active: C.planActive(ac, now), suspended: !!ac.suspended, players: ac.players.filter(p => !p.left).length, staff: ac.staff.length, batches: ac.batches.length, createdAt: ac.createdAt, owner: owner.name || '', email: owner.email || '', lastActive: ac.updatedAt || ac.createdAt }; }).sort((a, b) => b.createdAt - a.createdAt);
  const s = db.hq.settings;
  return { academies: acs, sales: db.hq.sales.slice(0, 500), keys: db.hq.keys, plans: db.hq.plans, activity: db.hq.activity.slice(0, 100), users: Object.keys(db.users).length,
    settings: { razorpay: { keyId: s.razorpay.keyId, hasSecret: !!s.razorpay.keySecret, hasWebhook: !!s.razorpay.webhookSecret, webhookUrl: BASE + '/api/razorpay/webhook' }, googleClientId: s.googleClientId, smtp: { host: s.smtp.host, port: s.smtp.port, user: s.smtp.user, from: s.smtp.from, hasPass: !!s.smtp.pass }, seo: { google: !!s.seo.gsc.sa, bing: !!s.seo.bing.key } }, base: BASE, version: VERSION, features: ['visitors', 'users', 'seo'] };
}
function hqAct(p) {
  const T = C.T; const ac = p.aid && own(db.academies, p.aid);
  switch (p.type) {
    case 'plans.save': { const m = +p.monthly, y = +p.yearly, t = +p.trial; if (!(m > 0 && y > 0 && t >= 1 && t <= 60)) throw new Error('Check the prices'); const pts = Object.assign({}, (db.hq.plans || {}).points || {}); if (p.mPoints != null) pts.monthly = C.cleanPoints(p.mPoints); if (p.yPoints != null) pts.yearly = C.cleanPoints(p.yPoints); db.hq.plans = { monthly: Math.round(m), yearly: Math.round(y), trial: Math.round(t), points: pts }; hqLog(`Prices changed: ₹${m}/month, ₹${y}/year, ${t}-day trial`); return 'Prices saved. The website shows them now.'; }
    case 'key.make': { if (!C.PLAN_DAYS[p.plan]) throw new Error('Pick a plan'); const code = C.mkKey(); db.hq.keys.unshift({ code, plan: p.plan, made: Date.now(), note: String(p.note || '').slice(0, 120), forName: String(p.forName || '').slice(0, 80), paidBy: p.paidBy || '' });
      if (p.paidBy && p.paidBy !== 'Free') recordSale(null, p.plan, Math.round(+p.amount || db.hq.plans[p.plan]), 'Licence key · ' + p.paidBy, code), db.hq.sales[0].academy = String(p.forName || 'Key ' + code);
      hqLog(`Licence key ${code} made (${p.plan})`); return { msg: 'Key made', code }; }
    case 'key.stop': { const k = db.hq.keys.find(x => x.code === p.code); if (!k) throw new Error('Key not found'); k.stopped = !k.stopped; hqLog(`Key ${k.code} ${k.stopped ? 'stopped' : 'restarted'}`); return k.stopped ? 'Key stopped. It cannot be used now.' : 'Key works again'; }
    case 'academy.extend': { if (!ac) throw new Error('Academy not found'); const d = Math.max(1, Math.min(365, +p.days || 10)); ac.plan.until = Math.max(Date.now(), ac.plan.until) + d * DAY; ac.v++; hqLog(`${ac.name}: added ${d} days`); ping(ac.id); return `Added ${d} days to ${ac.name}`; }
    case 'academy.paid': { if (!ac) throw new Error('Academy not found'); if (!C.PLAN_DAYS[p.plan]) throw new Error('Pick a plan'); C.applyPlan(ac, p.plan, Date.now()); A.server(ac.vid, 'paid', { n: ac.name, id: ac.id, amt: Math.round(+p.amount || db.hq.plans[p.plan]) }); recordSale(ac, p.plan, Math.round(+p.amount || db.hq.plans[p.plan]), 'Manual · ' + (p.via || 'UPI')); hqLog(`${ac.name} marked paid (${p.plan})`); ping(ac.id); return `${ac.name} is on the ${p.plan} plan`; }
    case 'academy.suspend': { if (!ac) throw new Error('Academy not found'); ac.suspended = !ac.suspended; ac.v++; hqLog(`${ac.name} ${ac.suspended ? 'paused' : 'restored'}`); ping(ac.id); return ac.suspended ? `${ac.name} is paused` : `${ac.name} is back on`; }
    case 'sale.manual': { const amt = Math.round(+p.amount); if (!amt) throw new Error('Add the amount'); recordSale(ac || null, p.plan || 'other', amt, 'Manual · ' + (p.via || 'UPI')); if (!ac) db.hq.sales[0].academy = String(p.forName || 'Other'); hqLog(`Manual sale ₹${amt}`); return 'Sale added'; }
    case 'settings.save': { const s = db.hq.settings;
      if (p.razorpay) { if (p.razorpay.keyId != null) s.razorpay.keyId = String(p.razorpay.keyId).trim(); if (p.razorpay.keySecret) s.razorpay.keySecret = String(p.razorpay.keySecret).trim(); if (p.razorpay.webhookSecret) s.razorpay.webhookSecret = String(p.razorpay.webhookSecret).trim(); }
      if (p.googleClientId != null) s.googleClientId = String(p.googleClientId).trim();
      if (p.smtp) { ['host', 'user', 'from'].forEach(k => { if (p.smtp[k] != null) s.smtp[k] = String(p.smtp[k]).trim(); }); if (p.smtp.port) s.smtp.port = +p.smtp.port; if (p.smtp.pass) s.smtp.pass = String(p.smtp.pass); }
      hqLog('Settings changed'); return 'Saved'; }
    case 'password': { if (String(p.pw || '').length < 10) throw new Error('Use at least 10 characters'); db.hq.pw = hashPw(p.pw); db.hq.hqSessions = {}; hqLog('HQ password changed'); return 'HQ password changed. Log in again.'; }
    case 'mail.test': { if (!mailOn()) throw new Error('Fill in the email settings first'); mail(p.to || db.hq.settings.smtp.user, 'Veyra Academy test email', 'Email works.'); return 'Test email sent'; }
    default: throw new Error('Unknown action');
  }
}

/* ---------------- people, visitor stats and SEO for HQ ---------------- */
const BUILT = (() => { try { return fs.statSync(path.join(PUB, 'landing.js')).mtimeMs; } catch (_) { return Date.now(); } })();
function loggedIn(usr, via, vid) { usr.lastLogin = Date.now(); usr.logins = (usr.logins || 0) + 1; usr.lastVia = via; if (via === 'google') usr.google = true; vid = String(vid || '').replace(/[^\w-]/g, '').slice(0, 24); if (vid && !usr.vid) usr.vid = vid; if (vid) A.server(vid, 'login', { n: usr.name, x: usr.email, id: usr.id }); save(); }
function hqUsers() {
  const now = Date.now(); const out = [];
  for (const u of Object.values(db.users)) {
    const ms = db.mem.filter(m => m.uid === u.id);
    const roles = ms.map(m => { const ac = db.academies[m.aid] || {}; return { role: m.role, aid: m.aid, academy: ac.name || '', plan: ac.plan ? ac.plan.type : '', until: ac.plan ? ac.plan.until : 0, active: ac.plan ? C.planActive(ac, now) && !ac.suspended : false }; });
    const ft = u.vid ? A.first(u.vid) : null;
    out.push({ id: u.id, name: u.name, email: u.email, phone: u.phone || '', createdAt: u.createdAt, lastLogin: u.lastLogin || 0, seen: Math.max(u.seen || 0, u.lastLogin || 0), logins: u.logins || 0, signIn: u.google ? (u.lastVia === 'email' ? 'Google + email' : 'Google') : 'Email', roles, source: ft ? { src: ft.src, ref: ft.ref, utm: ft.utm, city: ft.ct, device: ft.dv, page: ft.p, first: ft.f } : null });
  }
  (db.hq.leads || []).forEach((l, i) => { if (!l.email || !userByEmail(l.email)) out.push({ id: 'lead-' + (l.email || i), name: l.name, email: l.email || '', phone: l.phone || '', createdAt: l.at, lastLogin: 0, seen: l.at, logins: 0, signIn: l.via === 'Enquiry' ? 'Enquiry form' + (l.academy ? ' · ' + l.academy : '') + (l.sport ? ' · ' + l.sport : '') : 'Google · sign-up not finished', roles: [], lead: true, source: null }); });
  return { users: out.sort((a, b) => b.createdAt - a.createdAt) };
}
function seoState() {
  const S = db.hq.settings.seo; const html = page('live');
  return { connected: { google: !!S.gsc.sa, bing: !!S.bing.key, psiKey: !!S.psi.key }, clientEmail: seo.clientEmail(), site: S.gsc.sa ? seo.site() : '', base: BASE, host: HOST_NAME, verify: S.verify,
    check: seo.check(html, SEO_WORDS), last: seo.last(), geo: A.geoReady() };
}
async function seoRun(b) {
  const S = db.hq.settings.seo;
  switch (b.what) {
    case 'save': {
      if (b.sa != null && String(b.sa).trim()) { let j; try { j = JSON.parse(b.sa); } catch (_) { throw new Error('That is not the JSON key file. Open the downloaded .json file and copy all of it.'); } if (!j.client_email || !j.private_key) throw new Error('This JSON has no client_email or private_key. Download a key for the service account (Keys > Add key > JSON).'); S.gsc.sa = JSON.stringify({ client_email: j.client_email, private_key: j.private_key }); }
      if (b.clearGoogle) S.gsc.sa = '';
      if (b.site != null) S.gsc.site = String(b.site).trim().slice(0, 200);
      if (b.bing != null && String(b.bing).trim()) S.bing.key = String(b.bing).trim().slice(0, 100); if (b.clearBing) S.bing.key = '';
      if (b.psi != null && String(b.psi).trim()) S.psi.key = String(b.psi).trim().slice(0, 100);
      if (b.vGoogle != null) S.verify.google = String(b.vGoogle).replace(/.*content="([^"]+)".*/, '$1').trim().slice(0, 100);
      if (b.vBing != null) S.verify.bing = String(b.vBing).replace(/.*content="([^"]+)".*/, '$1').trim().slice(0, 100);
      hqLog('SEO settings changed'); return { msg: 'Saved' };
    }
    case 'sites': return { sites: await seo.sites() };
    case 'google': return { google: await seo.google(b.days, b.force) };
    case 'sitemap': { const m = await seo.submitSitemap(); hqLog(m); return { msg: m }; }
    case 'inspect': return { inspect: await seo.inspect(b.url) };
    case 'backlinks': return { backlinks: await seo.backlinks(b.force) };
    case 'pagespeed': { const ps = await seo.pagespeed(b.strategy); return { pagespeed: ps, msg: ps.note || (Date.now() - ps.at > 120e3 ? 'Showing the last test from the past 12 hours, to save Google\'s daily limit.' : undefined) }; }
    default: throw new Error('Unknown action');
  }
}
function privacyPage() {
  return `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Privacy policy | Veyra Academy</title><meta name="description" content="How Veyra Academy handles academy, coach, parent and visitor data. No data is sold. Contact marketing@veyracreatives.com."><link rel="canonical" href="${BASE}/privacy"><link rel="icon" href="/icon.svg?v=2" type="image/svg+xml"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,500..900&family=Inter:wght@400;600;700&display=swap"><link rel="stylesheet" href="/style.css?v=${VERSION}"><style>.doc{max-width:760px;margin:0 auto;padding:40px 16px 80px;display:grid;gap:18px;line-height:1.65}.doc h1{font:900 clamp(32px,6vw,48px)/1 var(--f-display);text-transform:uppercase;font-stretch:75%}.doc h2{font:700 19px/1.3 var(--f-body);margin-top:10px}.doc ul{padding-left:20px;display:grid;gap:6px}</style><script src="/va.js?v=${VERSION}" defer></script></head><body><main class="doc">
<a href="/" style="font-weight:600;color:var(--brand)">← Veyra Academy</a><h1>Privacy policy</h1><p class="muted">Last updated ${new Date(BUILT).toISOString().slice(0, 10)}. Veyra Academy is made by Veyra Creatives, India.</p>
<h2>What academies put in the app</h2><p>Academy owners add batches, players, parents, coaches, attendance, fees and documents. This data belongs to the academy. We store it on our server in India to run the app, keep daily backups, and never sell it or use it for ads.</p>
<h2>Accounts</h2><p>For each login we keep the name, email, an optional phone number, a scrambled (hashed) password, when you signed up and when you last logged in. If you use Sign in with Google we only receive your name and email from Google.</p>
<h2>Website visit statistics</h2><p>To learn which parts of this website help academies, our own server counts visits. We do not use Google Analytics, Facebook Pixel or advertising cookies. What we record:</p>
<ul><li>a random visitor number kept in your browser (not a cookie, not linked to your name unless you sign up)</li><li>pages and sections viewed, buttons clicked, how long you stayed</li><li>the website that sent you (for example Google or Instagram)</li><li>phone, tablet or computer, the browser, and your approximate city, worked out from your internet address. The address itself is not saved.</li></ul>
<p>We never record what you type into forms. If you create an account, your visit history is linked to that account so we can see how academies found us. Visit records are deleted after 400 days. To stop being counted on a device, open <a href="/?notrack">${HOST_NAME}/?notrack</a> once.</p>
<h2>Payments</h2><p>Plan payments go through Razorpay. We do not see or store card or bank details. Parent fee payments go straight to each academy's own UPI ID.</p>
<h2>Emails</h2><p>We send emails needed to run your account, such as receipts, reminders and password resets.</p>
<h2>Your choices</h2><p>Academy owners can download all their data from Settings. To correct or delete your data, email <a href="mailto:marketing@veyracreatives.com">marketing@veyracreatives.com</a>.</p>
<p class="muted">City data: IP Geolocation by <a href="https://db-ip.com">DB-IP</a>.</p></main></body></html>`;
}

/* ---------------- routes ---------------- */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, BASE); const p = u.pathname; const M = req.method;
  try {
    if (p === '/' || p === '/index.html') return send(res, 200, page('live'), MIME['.html'], { 'cache-control': 'no-cache' });
    if (p === '/demo' || p === '/demo/') return send(res, 200, page('demo'), MIME['.html'], { 'cache-control': 'no-cache', 'x-robots-tag': 'noindex' });
    /* Veyra HQ is a Windows app only (user, 2026-11-25). The website never serves it. */
    if (p === '/sw.js') return send(res, 200, fs.readFileSync(path.join(PUB, 'sw.js'), 'utf8').replace('__VERSION__', VERSION), MIME['.js'], { 'cache-control': 'no-cache' });
    if (p === '/robots.txt') return send(res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /demo\nSitemap: ${BASE}/sitemap.xml\n`, MIME['.txt']);
    if (p === '/sitemap.xml') { const lm = new Date(BUILT).toISOString().slice(0, 10); return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${BASE}/</loc><lastmod>${lm}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url><url><loc>${BASE}/privacy</loc><lastmod>${lm}</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url></urlset>`, 'application/xml', { 'cache-control': 'public, max-age=3600' }); }
    if (p === '/privacy' || p === '/privacy/') return send(res, 200, privacyPage(), MIME['.html'], { 'cache-control': 'public, max-age=3600' });
    if (p === '/api/va' && M === 'POST') { try { A.track(req, await body(req, 3e4)); } catch (_) {} res.writeHead(204, { 'cache-control': 'no-store' }); return res.end(); }
    if (p === '/healthz') return send(res, 200, { ok: true, version: VERSION });

    if (p.startsWith('/api/')) {
      if (p === '/api/events') { const s = session(req); if (!s) return bad(res, 'Log in', 401); res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' }); res.write(': hi\n\n'); sub(s.aid, res); req.on('close', () => subs.get(s.aid) && subs.get(s.aid).delete(res)); return; }
      if (p === '/api/boot' && M === 'GET') { const s = session(req); if (!s) return bad(res, 'Log in', 401); const U = db.users[s.uid]; if (!U.seen || Date.now() - U.seen > 600e3) { U.seen = Date.now(); save(); } return send(res, 200, { boot: bootFor(s) }); }
      if (p.startsWith('/api/file/') && M === 'GET') {
        const s = session(req); const f = own(db.files, p.slice(10)); if (!s || !f) return bad(res, 'Not found', 404);
        const ac = db.academies[f.aid]; const pl = ac && ac.players.find(x => x.id === f.pid);
        if (f.aid !== s.aid || (s.role === 'parent' && (!pl || pl.parentUid !== s.uid))) return bad(res, 'Not allowed', 403);
        return send(res, 200, fs.readFileSync(path.join(DATA, 'files', f.id)), f.type, { 'content-disposition': `inline; filename="${f.name.replace(/[^\w. -]/g, '')}"`, 'cache-control': 'private, max-age=3600' });
      }
      if (p === '/api/export' && M === 'GET') { const s = session(req); if (!s || s.role !== 'admin') return bad(res, 'Only the academy admin can download all data', 403); const ac = db.academies[s.aid]; return send(res, 200, JSON.stringify(ac, null, 2), 'application/json', { 'content-disposition': `attachment; filename="veyra-academy-${C.T.date()}.json"` }); }
      if (p === '/api/razorpay/webhook' && M === 'POST') {
        await body(req, 2e5); const sec = db.hq.settings.razorpay.webhookSecret; const sig = req.headers['x-razorpay-signature'];
        if (!sec || !sig || !safeEq(crypto.createHmac('sha256', sec).update(req.raw).digest('hex'), sig)) return bad(res, 'Bad signature', 400);
        const ev = JSON.parse(req.raw.toString()); const pay = ev.payload && ev.payload.payment && ev.payload.payment.entity;
        if ((ev.event === 'payment.captured' || ev.event === 'order.paid') && pay && pay.notes && pay.notes.aid && pay.notes.plan) applyPaid(pay.notes.aid, pay.notes.plan, Math.round(pay.amount / 100), pay.id, pay.order_id);
        return send(res, 200, { ok: true });
      }
      const hqGet = M === 'GET' && /^\/api\/hq\/(state|needs-setup|backup|analytics|users|seo)$/.test(p);
      if (M !== 'POST' && !hqGet) return bad(res, 'Not found', 404);
      const b = hqGet ? {} : await body(req, p === '/api/upload' ? 7e6 : 2e5);

      if (p === '/api/signup') {
        if (limited(req, 'su', 8, 3600e3)) return bad(res, 'Too many tries. Wait a bit.', 429);
        const gp = b.gtoken ? GPEND.get(String(b.gtoken)) : null; if (b.gtoken && (!gp || gp.exp < Date.now())) return bad(res, 'Google sign-in timed out. Tap Continue with Google again.');
        const email = gp ? gp.email : lc(b.email); if (!/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Enter your email');
        if (!gp && String(b.pw || '').length < 8) return bad(res, 'Use at least 8 characters for the password');
        if (!String(b.academy || '').trim() || !String(b.name || '').trim()) return bad(res, 'Add the academy name and your name');
        if (userByEmail(email)) return bad(res, 'This email already has an account. Log in instead.');
        const usr = env.ensureUser({ email, name: b.name, pw: gp ? tok() : b.pw }); const U = db.users[usr.uid]; const vid = String(b.vid || '').replace(/[^\w-]/g, '').slice(0, 24);
        Object.assign(U, { phone: String(b.phone || '').replace(/[^\d+ -]/g, '').slice(0, 20), via: gp ? 'google' : 'email', vid, lastLogin: Date.now(), logins: 1 }); if (gp) { U.google = true; U.lastVia = 'google'; GPEND.delete(String(b.gtoken)); }
        if (db.hq.leads) db.hq.leads = db.hq.leads.filter(x => x.email !== email);
        const ac = C.newAcademy({ name: String(b.academy).slice(0, 80), place: String(b.city || '').slice(0, 80), sport: String(b.sport || ''), now: Date.now(), trialDays: db.hq.plans.trial });
        ac.admins.push(usr.uid); ac.vid = vid; db.academies[ac.id] = ac; env.link(usr.uid, ac.id, 'admin'); A.server(vid, 'signup', { n: ac.name, x: email, id: ac.id });
        hqLog(`New trial: ${ac.name} (${email})`); startSession(res, usr.uid);
        mail(email, 'Welcome to Veyra Academy', `Hi ${b.name},\n\n${ac.name} is set up with a ${db.hq.plans.trial}-day free trial.\nOpen: ${BASE}/#admin\n\nStart by adding your batches, coaches and players.\n`);
        return send(res, 200, { ok: true, created: true });
      }
      if (p === '/api/enquiry') {
        if (b.website) return send(res, 200, { ok: true });
        if (limited(req, 'eq', 5, 60 * 60e3)) return bad(res, 'Too many requests. Try again in an hour.', 429);
        const s = (v, n) => String(v || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);
        const name = s(b.name, 80), email = lc(s(b.email, 120)), phone = s(b.phone, 20).replace(/[^\d+ -]/g, '');
        if (!name) return bad(res, 'Add your name');
        if (!(email && /^\S+@\S+\.\S+$/.test(email)) && phone.replace(/\D/g, '').length < 10) return bad(res, 'Add a phone number or email so we can reach you');
        db.hq.leads = db.hq.leads || [];
        db.hq.leads.unshift({ email: email && /^\S+@\S+\.\S+$/.test(email) ? email : '', phone, name, academy: s(b.academy, 80), sport: own(C.SPORTS, b.sport) ? C.SPORTS[b.sport].name : '', at: Date.now(), via: 'Enquiry', vid: String(b.vid || '').replace(/[^\w-]/g, '').slice(0, 24) });
        db.hq.leads.length = Math.min(db.hq.leads.length, 500);
        hqLog(`Enquiry from ${name}${b.academy ? ' (' + s(b.academy, 80) + ')' : ''}`); save();
        mail('marketing@veyracreatives.com', 'New Veyra Academy enquiry', `${name}\n${s(b.academy, 80)}\n${phone}\n${email}\n\nOpen Veyra Academy HQ > Users > Enquiries.`);
        return send(res, 200, { ok: true });
      }
      if (p === '/api/login') {
        if (limited(req, 'li', 20, 15 * 60e3)) return bad(res, 'Too many tries. Wait 15 minutes.', 429);
        const usr = userByEmail(b.email); if (!usr || !checkPw(b.pw, usr.pw)) return bad(res, 'That email and password do not match', 401);
        if (!startSession(res, usr.id)) return bad(res, 'Your academy has not added you yet, or removed you.', 403);
        loggedIn(usr, 'email', b.vid); return send(res, 200, { ok: true });
      }
      if (p === '/api/google') {
        if (!db.hq.settings.googleClientId) return bad(res, 'Google sign-in is not set up yet');
        const g = await googleCheck(b.credential); const usr = userByEmail(g.email);
        if (!usr) {
          // new person: remember them (so HQ sees the lead) and send them to the 'finish sign-up' page
          const t = tok(); GPEND.set(t, { email: lc(g.email), name: String(g.name || '').slice(0, 80), exp: Date.now() + 30 * 60e3 });
          for (const [k, v] of GPEND) if (v.exp < Date.now()) GPEND.delete(k);
          db.hq.leads = db.hq.leads || []; const ld = db.hq.leads.find(x => x.email === lc(g.email));
          if (ld) ld.at = Date.now(); else { db.hq.leads.unshift({ email: lc(g.email), name: String(g.name || '').slice(0, 80), at: Date.now(), via: 'Google', vid: String(b.vid || '').replace(/[^\w-]/g, '').slice(0, 24) }); db.hq.leads.length = Math.min(db.hq.leads.length, 2000); hqLog(`Google sign-up started: ${String(g.name || '').slice(0, 80)} (${lc(g.email)})`); }
          save(); return send(res, 200, { needSignup: true, gtoken: t, email: lc(g.email), name: String(g.name || '').slice(0, 80) });
        }
        if (!startSession(res, usr.id)) return bad(res, 'Your academy has not added you yet.', 403);
        loggedIn(usr, 'google', b.vid); return send(res, 200, { ok: true });
      }
      if (p === '/api/logout') { const t = cookies(req).vfs; if (t) delete db.sessions[t]; setCookie(res, 'vfs', '', 0); save(); return send(res, 200, { ok: true }); }
      if (p === '/api/forgot') {
        if (limited(req, 'fg', 5, 3600e3)) return bad(res, 'Too many tries. Wait a bit.', 429);
        const usr = userByEmail(b.email); const msg = mailOn() ? 'If this email has an account, a reset link is on its way.' : 'Ask your academy admin to make you a new password. Academy owners can email marketing@veyracreatives.com.';
        if (usr && mailOn()) { const t = tok(); db.resets[t] = { uid: usr.id, exp: Date.now() + 3600e3 }; save(); mail(usr.email, 'Reset your Veyra Academy password', `Hi ${usr.name},\n\nMake a new password here (works for 1 hour):\n${BASE}/#reset-${t}\n\nIf you did not ask for this, ignore this email.\n`); }
        return send(res, 200, { ok: true, msg });
      }
      if (p === '/api/reset') { const r = own(db.resets, b.token); if (!r || r.exp < Date.now()) return bad(res, 'This link has expired. Ask for a new one.'); if (String(b.pw || '').length < 8) return bad(res, 'Use at least 8 characters'); db.users[r.uid].pw = hashPw(b.pw); delete db.resets[b.token]; save(); return send(res, 200, { ok: true }); }

      if (p.startsWith('/api/hq/')) {
        if (p === '/api/hq/login') {
          if (limited(req, 'hq', 10, 15 * 60e3)) return bad(res, 'Too many tries. Wait 15 minutes.', 429);
          if (!db.hq.pw) { const code = fs.readFileSync(path.join(DATA, 'hq-setup-code.txt'), 'utf8').trim(); if (String(b.code || '').trim().toUpperCase() !== code) return bad(res, 'Wrong setup code', 401); if (String(b.pw || '').length < 10) return bad(res, 'Use at least 10 characters'); db.hq.pw = hashPw(b.pw); fs.unlinkSync(path.join(DATA, 'hq-setup-code.txt')); hqLog('HQ password set'); }
          else if (!checkPw(b.pw, db.hq.pw)) return bad(res, 'Wrong password', 401);
          const t = tok(); db.hq.hqSessions[t] = { exp: Date.now() + 30 * 60 * 1000 }; res.setHeader('Set-Cookie', `vfhq=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${SECURE ? '; Secure' : ''}`); save(); return send(res, 200, { ok: true, token: t });
        }
        if (p === '/api/hq/needs-setup') return send(res, 200, { setup: !db.hq.pw });
        if (!hqSession(req)) return bad(res, 'Log in to HQ', 401);
        if (p === '/api/hq/state') return send(res, 200, hqState());
        if (p === '/api/hq/analytics') return send(res, 200, A.report({ days: u.searchParams.get('days') }));
        if (p === '/api/hq/users') return send(res, 200, hqUsers());
        if (p === '/api/hq/seo') return send(res, 200, seoState());
        if (p === '/api/hq/seo-run') { const r = await seoRun(b); save(); return send(res, 200, Object.assign({ seo: seoState() }, r)); }
        if (p === '/api/hq/logout') { delete db.hq.hqSessions[hqToken(req)]; save(); return send(res, 200, { ok: true }); }
        if (p === '/api/hq/act') { const r = hqAct(b); save(); return send(res, 200, Object.assign(typeof r === 'string' ? { msg: r } : r, { state: hqState() })); }
        if (p === '/api/hq/backup') { saveNow(); return send(res, 200, fs.readFileSync(DBF), 'application/json', { 'content-disposition': `attachment; filename="veyra-academy-db-${C.T.date()}.json"` }); }
        return bad(res, 'Not found', 404);
      }

      const s = session(req); if (!s) return bad(res, 'Please log in again', 401);
      const ac = db.academies[s.aid];
      if (p === '/api/act') {
        if (limited(req, 'act', 240, 60e3)) return bad(res, 'Slow down a little', 429);
        const ctx = Object.assign(me(s), { now: Date.now() });
        try { const r = C.act(ac, ctx, String(b.type), b.p || {}, env); save(); ping(ac.id); return send(res, 200, { msg: r.msg, data: r.data, boot: bootFor(s) }); }
        catch (e) { return bad(res, e.message, e.code && e.code >= 400 && e.code < 600 ? e.code : 400); }
      }
      if (p === '/api/switch') { const m = db.mem.find(x => x.uid === s.uid && x.aid === b.aid && x.role === b.role); if (!m) return bad(res, 'Not allowed', 403); Object.assign(s, { aid: m.aid, role: m.role, sid: m.sid }); save(); return send(res, 200, { ok: true }); }
      if (p === '/api/password') { const usr = db.users[s.uid]; if (!checkPw(b.oldPw, usr.pw)) return bad(res, 'Your current password is wrong'); if (String(b.newPw || '').length < 8) return bad(res, 'Use at least 8 characters'); usr.pw = hashPw(b.newPw); save(); return send(res, 200, { msg: 'Password changed' }); }
      if (p === '/api/upload') {
        const pl = ac.players.find(x => x.id === b.pid && !x.left); if (!pl) return bad(res, 'Player not found');
        if (!(s.role === 'admin' || s.role === 'manager' || (s.role === 'parent' && pl.parentUid === s.uid))) return bad(res, 'Not allowed', 403);
        if (!/^(image\/(png|jpe?g|webp|heic)|application\/pdf)$/.test(b.type || '')) return bad(res, 'Use a photo or a PDF');
        const buf = Buffer.from(String(b.data || ''), 'base64'); if (!buf.length || buf.length > 5 * 1024 * 1024) return bad(res, 'Please pick a file under 4 MB');
        const id = crypto.randomBytes(12).toString('hex'); fs.writeFileSync(path.join(DATA, 'files', id), buf);
        db.files[id] = { id, aid: ac.id, pid: pl.id, key: String(b.key || '').slice(0, 40), name: String(b.name || 'file').slice(0, 80), type: b.type, size: buf.length, at: Date.now() }; save();
        return send(res, 200, { id });
      }
      if (p === '/api/plan/key') {
        if (s.role !== 'admin') return bad(res, 'Only the academy admin can do this', 403);
        const code = String(b.code || '').toUpperCase().trim(); const k = db.hq.keys.find(x => x.code === code);
        if (!k) return bad(res, 'This key is not valid. Keys look like VFB-XXXX-XXXX-XXXX'); if (k.used) return bad(res, 'This key was already used'); if (k.stopped) return bad(res, 'This key was stopped by Veyra');
        C.applyPlan(ac, k.plan, Date.now()); k.used = { aid: ac.id, name: ac.name, at: Date.now() }; A.server(ac.vid, 'paid', { n: ac.name, id: ac.id, amt: 0 }); hqLog(`${ac.name} used key ${code}`); save(); ping(ac.id);
        return send(res, 200, { msg: 'Key activated. Your plan is on.' });
      }
      if (p === '/api/plan/order') {
        if (s.role !== 'admin') return bad(res, 'Only the academy admin can buy a plan', 403);
        const R = db.hq.settings.razorpay; if (!R.keyId || !R.keySecret) return bad(res, 'Online payment is not switched on yet. Email marketing@veyracreatives.com for a licence key.');
        const plan = b.plan === 'monthly' ? 'monthly' : 'yearly'; const amt = db.hq.plans[plan]; const usr = db.users[s.uid];
        const o = await rzp('POST', '/orders', { amount: amt * 100, currency: 'INR', receipt: 'vf-' + Date.now(), notes: { aid: ac.id, plan, academy: ac.name } });
        return send(res, 200, { orderId: o.id, amount: o.amount, keyId: R.keyId, description: `${plan === 'yearly' ? 'Yearly' : 'Monthly'} plan · ${ac.name}`, name: usr.name, email: usr.email });
      }
      if (p === '/api/plan/verify') {
        const R = db.hq.settings.razorpay; const exp = crypto.createHmac('sha256', R.keySecret).update(b.razorpay_order_id + '|' + b.razorpay_payment_id).digest('hex');
        if (!safeEq(exp, b.razorpay_signature)) return bad(res, 'Payment could not be checked. If money left your account, email marketing@veyracreatives.com.');
        const o = await rzp('GET', '/orders/' + encodeURIComponent(b.razorpay_order_id));
        if (o.notes.aid !== ac.id) return bad(res, 'This payment is for another academy');
        applyPaid(ac.id, o.notes.plan, Math.round(o.amount / 100), b.razorpay_payment_id, o.id);
        return send(res, 200, { msg: `Payment received. ${o.notes.plan === 'yearly' ? 'Yearly' : 'Monthly'} plan is on.` });
      }
      return bad(res, 'Not found', 404);
    }
    if (M === 'GET' && staticFile(res, decodeURIComponent(p.slice(1)))) return;
    send(res, 404, 'Not found', MIME['.txt']);
  } catch (e) { console.error(M, p, e.message); if (!res.headersSent) bad(res, e.code === 413 ? 'That is too big' : e.message || 'Server error', e.code === 413 ? 413 : 500); }
});
server.listen(PORT, HOST, () => console.log(`Veyra Academy ${VERSION} on ${HOST}:${PORT} · ${BASE}`));
