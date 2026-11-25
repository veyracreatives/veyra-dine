/* Veyra Academy server. Node 18+, no framework.
   Data lives in ./data (db.json + daily backups + uploaded files). It is never wiped by an update. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), https = require('https');
const C = require('./public/core.js');
require('./public/icons.js'); const L = require('./public/landing.js');

const ROOT = __dirname, PUB = path.join(ROOT, 'public'), DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = +process.env.PORT || 3100, HOST = process.env.HOST || '127.0.0.1';
const BASE = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SECURE = BASE.startsWith('https');
const DAY = 864e5;
fs.mkdirSync(path.join(DATA, 'backups'), { recursive: true }); fs.mkdirSync(path.join(DATA, 'files'), { recursive: true });

/* ---------------- storage ---------------- */
const DBF = path.join(DATA, 'db.json');
let db;
function fresh() { return { users: {}, mem: [], academies: {}, sessions: {}, resets: {}, files: {}, payments: {}, hq: { pw: null, plans: { monthly: 999, yearly: 7999, trial: 10 }, sales: [], keys: [], activity: [], seq: 0, settings: { razorpay: { keyId: '', keySecret: '', webhookSecret: '' }, googleClientId: '', smtp: { host: '', port: 465, user: '', pass: '', from: '' } }, hqSessions: {} } }; }
try { db = JSON.parse(fs.readFileSync(DBF, 'utf8')); } catch (e) { if (fs.existsSync(DBF)) { console.error('db.json could not be read. Not starting, so nothing is overwritten. Restore from data/backups.'); process.exit(1); } db = fresh(); }
const F0 = fresh(); for (const k of Object.keys(F0)) if (db[k] == null) db[k] = F0[k]; for (const k of Object.keys(F0.hq)) if (db.hq[k] == null) db.hq[k] = F0.hq[k];
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
function send(res, code, body, type, extra) { res.writeHead(code, Object.assign({ 'content-type': type || 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'same-origin' }, extra || {})); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); }
const bad = (res, msg, code) => send(res, code || 400, { error: msg });
function body(req, limit) { return new Promise((ok, no) => { let n = 0; const ch = []; req.on('data', c => { n += c.length; if (n > (limit || 1e6)) { no(Object.assign(new Error('Too big'), { code: 413 })); req.destroy(); } else ch.push(c); }); req.on('end', () => { const raw = Buffer.concat(ch); req.raw = raw; try { ok(raw.length ? JSON.parse(raw) : {}); } catch (e) { no(Object.assign(new Error('Bad JSON'), { code: 400 })); } }); req.on('error', no); }); }
const hits = new Map();
function limited(req, key, max, win) { const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); const k = key + ip; const now = Date.now(); const h = (hits.get(k) || []).filter(t => now - t < win); h.push(now); hits.set(k, h); return h.length > max; }
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
function session(req) { const t = cookies(req).vfs; const s = t && db.sessions[t]; if (!s || s.exp < Date.now()) return null; const ok = db.mem.some(m => m.uid === s.uid && m.aid === s.aid && m.role === s.role); if (!ok || !db.users[s.uid] || !db.academies[s.aid]) return null; s.t = t; return s; }
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
  if (db.payments[paymentId]) return db.payments[paymentId];
  const ac = db.academies[aid]; if (!ac) return null;
  C.applyPlan(ac, plan, Date.now());
  const sale = recordSale(ac, plan, amt, 'Razorpay', paymentId);
  db.payments[paymentId] = { aid, plan, amt, orderId, at: Date.now(), sale: sale.id };
  hqLog(`${ac.name} paid ₹${amt.toLocaleString('en-IN')} for ${plan} (Razorpay ${paymentId})`);
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
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };
const VERSION = require('./package.json').version;
function cfg(mode) { const p = db.hq.plans; return { mode, plans: p, googleClientId: mode === 'live' ? db.hq.settings.googleClientId : '', razorpayKeyId: db.hq.settings.razorpay.keyId, mail: mailOn(), demoBase: mode === 'live' ? '/demo' : '', hosted: true, version: VERSION }; }
function page(mode) {
  const p = db.hq.plans; const c = cfg(mode);
  let h = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  h = h.replace(/{{TRIAL}}/g, p.trial).replace(/{{MONTHLY_F}}/g, p.monthly.toLocaleString('en-IN')).replace(/{{YEARLY_F}}/g, p.yearly.toLocaleString('en-IN')).replace(/{{MONTHLY}}/g, p.monthly).replace(/{{YEARLY}}/g, p.yearly).replace(/{{URL}}/g, BASE);
  h = h.replace('<!--CFG-->', `<script>window.VF_CFG=${JSON.stringify(c).replace(/</g, '\\u003c')}</script>`);
  h = h.replace(/(href|src)="(style\.css|app\.css|core\.js|icons\.js|landing\.js|app\.js)"/g, `$1="/$2?v=${VERSION}"`);
  if (mode === 'live') h = h.replace('<!--LANDING-->', L.render(c, globalThis.IC));
  else h = h.replace('<meta name="description"', '<meta name="robots" content="noindex"><meta name="description"');
  return h;
}
function staticFile(res, rel) {
  if (rel === 'hq.html' || rel === 'index.html') return false;
  const f = path.normalize(path.join(PUB, rel)); if (!f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return false;
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
function hqSession(req) { const t = cookies(req).vfhq; const s = t && db.hq.hqSessions[t]; if (!s || s.exp < Date.now()) return null; s.exp = Date.now() + 30 * 60 * 1000; return s; }
function hqState() {
  const now = Date.now();
  const acs = Object.values(db.academies).map(ac => { const owner = db.users[(ac.admins || [])[0]] || {}; return { id: ac.id, name: ac.name, place: ac.place, plan: ac.plan.type, until: ac.plan.until, active: C.planActive(ac, now), suspended: !!ac.suspended, players: ac.players.filter(p => !p.left).length, staff: ac.staff.length, batches: ac.batches.length, createdAt: ac.createdAt, owner: owner.name || '', email: owner.email || '', lastActive: ac.updatedAt || ac.createdAt }; }).sort((a, b) => b.createdAt - a.createdAt);
  const s = db.hq.settings;
  return { academies: acs, sales: db.hq.sales.slice(0, 500), keys: db.hq.keys, plans: db.hq.plans, activity: db.hq.activity.slice(0, 100), users: Object.keys(db.users).length,
    settings: { razorpay: { keyId: s.razorpay.keyId, hasSecret: !!s.razorpay.keySecret, hasWebhook: !!s.razorpay.webhookSecret, webhookUrl: BASE + '/api/razorpay/webhook' }, googleClientId: s.googleClientId, smtp: { host: s.smtp.host, port: s.smtp.port, user: s.smtp.user, from: s.smtp.from, hasPass: !!s.smtp.pass } }, base: BASE, version: VERSION };
}
function hqAct(p) {
  const T = C.T; const ac = p.aid && db.academies[p.aid];
  switch (p.type) {
    case 'plans.save': { const m = +p.monthly, y = +p.yearly, t = +p.trial; if (!(m > 0 && y > 0 && t >= 1 && t <= 60)) throw new Error('Check the prices'); db.hq.plans = { monthly: Math.round(m), yearly: Math.round(y), trial: Math.round(t) }; hqLog(`Prices changed: ₹${m}/month, ₹${y}/year, ${t}-day trial`); return 'Prices saved. The website shows them now.'; }
    case 'key.make': { if (!C.PLAN_DAYS[p.plan]) throw new Error('Pick a plan'); const code = C.mkKey(); db.hq.keys.unshift({ code, plan: p.plan, made: Date.now(), note: String(p.note || '').slice(0, 120), forName: String(p.forName || '').slice(0, 80), paidBy: p.paidBy || '' });
      if (p.paidBy && p.paidBy !== 'Free') recordSale(null, p.plan, Math.round(+p.amount || db.hq.plans[p.plan]), 'Licence key · ' + p.paidBy, code), db.hq.sales[0].academy = String(p.forName || 'Key ' + code);
      hqLog(`Licence key ${code} made (${p.plan})`); return { msg: 'Key made', code }; }
    case 'key.stop': { const k = db.hq.keys.find(x => x.code === p.code); if (!k) throw new Error('Key not found'); k.stopped = !k.stopped; hqLog(`Key ${k.code} ${k.stopped ? 'stopped' : 'restarted'}`); return k.stopped ? 'Key stopped. It cannot be used now.' : 'Key works again'; }
    case 'academy.extend': { if (!ac) throw new Error('Academy not found'); const d = Math.max(1, Math.min(365, +p.days || 10)); ac.plan.until = Math.max(Date.now(), ac.plan.until) + d * DAY; ac.v++; hqLog(`${ac.name}: added ${d} days`); ping(ac.id); return `Added ${d} days to ${ac.name}`; }
    case 'academy.paid': { if (!ac) throw new Error('Academy not found'); if (!C.PLAN_DAYS[p.plan]) throw new Error('Pick a plan'); C.applyPlan(ac, p.plan, Date.now()); recordSale(ac, p.plan, Math.round(+p.amount || db.hq.plans[p.plan]), 'Manual · ' + (p.via || 'UPI')); hqLog(`${ac.name} marked paid (${p.plan})`); ping(ac.id); return `${ac.name} is on the ${p.plan} plan`; }
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

/* ---------------- routes ---------------- */
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, BASE); const p = u.pathname; const M = req.method;
  try {
    if (p === '/' || p === '/index.html') return send(res, 200, page('live'), MIME['.html'], { 'cache-control': 'no-cache' });
    if (p === '/demo' || p === '/demo/') return send(res, 200, page('demo'), MIME['.html'], { 'cache-control': 'no-cache', 'x-robots-tag': 'noindex' });
    if (p === '/hq' || p === '/hq/') return send(res, 200, fs.readFileSync(path.join(PUB, 'hq.html'), 'utf8').replace('<!--CFG-->', `<script>window.HQ_CFG={mode:'live'}</script>`).replace(/(href|src)="(style\.css|app\.css|core\.js|icons\.js|hq\.js)"/g, `$1="/$2?v=${VERSION}"`), MIME['.html'], { 'cache-control': 'no-cache', 'x-robots-tag': 'noindex' });
    if (p === '/sw.js') return send(res, 200, fs.readFileSync(path.join(PUB, 'sw.js'), 'utf8').replace('__VERSION__', VERSION), MIME['.js'], { 'cache-control': 'no-cache' });
    if (p === '/robots.txt') return send(res, 200, `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /hq\nDisallow: /demo\nSitemap: ${BASE}/sitemap.xml\n`, MIME['.txt']);
    if (p === '/sitemap.xml') return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${BASE}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>`, 'application/xml');
    if (p === '/healthz') return send(res, 200, { ok: true, version: VERSION });

    if (p.startsWith('/api/')) {
      if (p === '/api/events') { const s = session(req); if (!s) return bad(res, 'Log in', 401); res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' }); res.write(': hi\n\n'); sub(s.aid, res); req.on('close', () => subs.get(s.aid) && subs.get(s.aid).delete(res)); return; }
      if (p === '/api/boot' && M === 'GET') { const s = session(req); if (!s) return bad(res, 'Log in', 401); return send(res, 200, { boot: bootFor(s) }); }
      if (p.startsWith('/api/file/') && M === 'GET') {
        const s = session(req); const f = db.files[p.slice(10)]; if (!s || !f) return bad(res, 'Not found', 404);
        const ac = db.academies[f.aid]; const pl = ac && ac.players.find(x => x.id === f.pid);
        if (f.aid !== s.aid || (s.role === 'parent' && (!pl || pl.parentUid !== s.uid))) return bad(res, 'Not allowed', 403);
        return send(res, 200, fs.readFileSync(path.join(DATA, 'files', f.id)), f.type, { 'content-disposition': `inline; filename="${f.name.replace(/[^\w. -]/g, '')}"`, 'cache-control': 'private, max-age=3600' });
      }
      if (p === '/api/export' && M === 'GET') { const s = session(req); if (!s || s.role !== 'admin') return bad(res, 'Only the academy admin can download all data', 403); const ac = db.academies[s.aid]; return send(res, 200, JSON.stringify(ac, null, 2), 'application/json', { 'content-disposition': `attachment; filename="veyra-academy-${C.T.date()}.json"` }); }
      if (p === '/api/razorpay/webhook' && M === 'POST') {
        await body(req, 2e5); const sec = db.hq.settings.razorpay.webhookSecret; const sig = req.headers['x-razorpay-signature'];
        if (!sec || !sig || crypto.createHmac('sha256', sec).update(req.raw).digest('hex') !== sig) return bad(res, 'Bad signature', 400);
        const ev = JSON.parse(req.raw.toString()); const pay = ev.payload && ev.payload.payment && ev.payload.payment.entity;
        if ((ev.event === 'payment.captured' || ev.event === 'order.paid') && pay && pay.notes && pay.notes.aid && pay.notes.plan) applyPaid(pay.notes.aid, pay.notes.plan, Math.round(pay.amount / 100), pay.id, pay.order_id);
        return send(res, 200, { ok: true });
      }
      const hqGet = M === 'GET' && /^\/api\/hq\/(state|needs-setup|backup)$/.test(p);
      if (M !== 'POST' && !hqGet) return bad(res, 'Not found', 404);
      const b = hqGet ? {} : await body(req, p === '/api/upload' ? 7e6 : 2e5);

      if (p === '/api/signup') {
        if (limited(req, 'su', 8, 3600e3)) return bad(res, 'Too many tries. Wait a bit.', 429);
        const email = lc(b.email); if (!/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Enter your email');
        if (String(b.pw || '').length < 8) return bad(res, 'Use at least 8 characters for the password');
        if (!String(b.academy || '').trim() || !String(b.name || '').trim()) return bad(res, 'Add the academy name and your name');
        if (userByEmail(email)) return bad(res, 'This email already has an account. Log in instead.');
        const usr = env.ensureUser({ email, name: b.name, pw: b.pw });
        const ac = C.newAcademy({ name: String(b.academy).slice(0, 80), place: String(b.city || '').slice(0, 80), now: Date.now(), trialDays: db.hq.plans.trial });
        ac.admins.push(usr.uid); db.academies[ac.id] = ac; env.link(usr.uid, ac.id, 'admin');
        hqLog(`New trial: ${ac.name} (${email})`); startSession(res, usr.uid);
        mail(email, 'Welcome to Veyra Academy', `Hi ${b.name},\n\n${ac.name} is set up with a ${db.hq.plans.trial}-day free trial.\nOpen: ${BASE}/#admin\n\nStart by adding your batches, coaches and players.\n`);
        return send(res, 200, { ok: true, created: true });
      }
      if (p === '/api/login') {
        if (limited(req, 'li', 20, 15 * 60e3)) return bad(res, 'Too many tries. Wait 15 minutes.', 429);
        const usr = userByEmail(b.email); if (!usr || !checkPw(b.pw, usr.pw)) return bad(res, 'That email and password do not match', 401);
        if (!startSession(res, usr.id)) return bad(res, 'Your academy has not added you yet, or removed you.', 403);
        return send(res, 200, { ok: true });
      }
      if (p === '/api/google') {
        if (!db.hq.settings.googleClientId) return bad(res, 'Google sign-in is not set up yet');
        const g = await googleCheck(b.credential); const usr = userByEmail(g.email);
        if (!usr) return bad(res, `No account for ${g.email}. Ask your academy to add this email, or start a free trial.`, 404);
        if (!startSession(res, usr.id)) return bad(res, 'Your academy has not added you yet.', 403);
        return send(res, 200, { ok: true });
      }
      if (p === '/api/logout') { const t = cookies(req).vfs; if (t) delete db.sessions[t]; setCookie(res, 'vfs', '', 0); save(); return send(res, 200, { ok: true }); }
      if (p === '/api/forgot') {
        if (limited(req, 'fg', 5, 3600e3)) return bad(res, 'Too many tries. Wait a bit.', 429);
        const usr = userByEmail(b.email); const msg = mailOn() ? 'If this email has an account, a reset link is on its way.' : 'Ask your academy admin to make you a new password. Academy owners can email marketing@veyracreatives.com.';
        if (usr && mailOn()) { const t = tok(); db.resets[t] = { uid: usr.id, exp: Date.now() + 3600e3 }; save(); mail(usr.email, 'Reset your Veyra Academy password', `Hi ${usr.name},\n\nMake a new password here (works for 1 hour):\n${BASE}/#reset-${t}\n\nIf you did not ask for this, ignore this email.\n`); }
        return send(res, 200, { ok: true, msg });
      }
      if (p === '/api/reset') { const r = db.resets[b.token]; if (!r || r.exp < Date.now()) return bad(res, 'This link has expired. Ask for a new one.'); if (String(b.pw || '').length < 8) return bad(res, 'Use at least 8 characters'); db.users[r.uid].pw = hashPw(b.pw); delete db.resets[b.token]; save(); return send(res, 200, { ok: true }); }

      if (p.startsWith('/api/hq/')) {
        if (p === '/api/hq/login') {
          if (limited(req, 'hq', 10, 15 * 60e3)) return bad(res, 'Too many tries. Wait 15 minutes.', 429);
          if (!db.hq.pw) { const code = fs.readFileSync(path.join(DATA, 'hq-setup-code.txt'), 'utf8').trim(); if (String(b.code || '').trim().toUpperCase() !== code) return bad(res, 'Wrong setup code', 401); if (String(b.pw || '').length < 10) return bad(res, 'Use at least 10 characters'); db.hq.pw = hashPw(b.pw); fs.unlinkSync(path.join(DATA, 'hq-setup-code.txt')); hqLog('HQ password set'); }
          else if (!checkPw(b.pw, db.hq.pw)) return bad(res, 'Wrong password', 401);
          const t = tok(); db.hq.hqSessions[t] = { exp: Date.now() + 30 * 60 * 1000 }; res.setHeader('Set-Cookie', `vfhq=${t}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${SECURE ? '; Secure' : ''}`); save(); return send(res, 200, { ok: true });
        }
        if (p === '/api/hq/needs-setup') return send(res, 200, { setup: !db.hq.pw });
        if (!hqSession(req)) return bad(res, 'Log in to HQ', 401);
        if (p === '/api/hq/state') return send(res, 200, hqState());
        if (p === '/api/hq/logout') { delete db.hq.hqSessions[cookies(req).vfhq]; save(); return send(res, 200, { ok: true }); }
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
        db.files[id] = { id, aid: ac.id, pid: pl.id, key: b.key, name: String(b.name || 'file').slice(0, 80), type: b.type, size: buf.length, at: Date.now() }; save();
        return send(res, 200, { id });
      }
      if (p === '/api/plan/key') {
        if (s.role !== 'admin') return bad(res, 'Only the academy admin can do this', 403);
        const code = String(b.code || '').toUpperCase().trim(); const k = db.hq.keys.find(x => x.code === code);
        if (!k) return bad(res, 'This key is not valid. Keys look like VFB-XXXX-XXXX-XXXX'); if (k.used) return bad(res, 'This key was already used'); if (k.stopped) return bad(res, 'This key was stopped by Veyra');
        C.applyPlan(ac, k.plan, Date.now()); k.used = { aid: ac.id, name: ac.name, at: Date.now() }; hqLog(`${ac.name} used key ${code}`); save(); ping(ac.id);
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
        if (exp !== b.razorpay_signature) return bad(res, 'Payment could not be checked. If money left your account, email marketing@veyracreatives.com.');
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
