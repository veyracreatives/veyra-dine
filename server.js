// Veyra Dine In: QR table ordering for restaurants (white-label, multi-restaurant).
// Run: npm install && npm start   ->  http://localhost:3000
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const QRCode = require('qrcode');
const { verifyKey, PUBLIC_KEY: LICENSE_PUBLIC_KEY } = require('./lib/license');
const siteContent = require('./lib/site-content');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(ROOT, 'public');

// ---- Installer mirror: keeps a copy of the Windows installer from GitHub Pages in data/downloads ----
const DL_DIR = path.join(DATA_DIR, 'downloads');
const DL_REMOTE = process.env.DL_REMOTE || 'https://veyracreatives.github.io/dine-in/download';
function dlFetch(url, dest, cb, hops = 0) {
  require('https').get(url, r => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && hops < 5) { r.resume(); return dlFetch(new URL(r.headers.location, url).href, dest, cb, hops + 1); }
    if (r.statusCode !== 200) { r.resume(); return cb(new Error('HTTP ' + r.statusCode)); }
    const tmp = dest + '.part', out = fs.createWriteStream(tmp);
    r.pipe(out); out.on('finish', () => out.close(() => fs.rename(tmp, dest, cb))); r.on('error', cb); out.on('error', cb);
  }).on('error', cb);
}
function syncInstaller() {
  try { fs.mkdirSync(DL_DIR, { recursive: true }); } catch {}
  const yml = path.join(DL_DIR, 'latest.yml'), newYml = yml + '.new';
  dlFetch(DL_REMOTE + '/latest.yml', newYml, err => {
    if (err) return console.log('[download] check failed:', err.message);
    const fresh = fs.readFileSync(newYml, 'utf8'), old = fs.existsSync(yml) ? fs.readFileSync(yml, 'utf8') : '';
    if (fresh === old && fs.existsSync(path.join(DL_DIR, 'Veyra-Dine-In-Setup.exe'))) return fs.unlink(newYml, () => {});
    console.log('[download] fetching installer from GitHub Pages');
    dlFetch(DL_REMOTE + '/Veyra-Dine-In-Setup.exe', path.join(DL_DIR, 'Veyra-Dine-In-Setup.exe'), e1 => {
      if (e1) return console.log('[download] installer failed:', e1.message);
      dlFetch(DL_REMOTE + '/Veyra-Dine-In-Setup.exe.blockmap', path.join(DL_DIR, 'Veyra-Dine-In-Setup.exe.blockmap'), () => {
        fs.rename(newYml, yml, () => console.log('[download] installer ready'));
      });
    });
  });
}
if (process.env.DL_MIRROR !== '0' && !process.versions.electron) { setTimeout(syncInstaller, 5000); setInterval(syncInstaller, 6 * 3600 * 1000).unref(); }
// Plans and where the "Buy" buttons go. Change prices here.
const PLANS = { trialDays: 10, monthly: 799, yearly: 5999, lifetime: 24999 };
const TERM_PLANS = ['monthly', 'yearly']; // paid plans that run until a date
let siteCache = null; // landing page with HQ edits applied
const BUY_URL = process.env.BUY_URL || 'https://wa.me/918928246726?text=';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- tiny JSON database ----------
let db = { config: {}, restaurants: [], categories: [], items: [], tables: [], orders: [], requests: [], coupons: [] };
if (fs.existsSync(DB_FILE)) db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
if (db.siteContent && db.siteContent.prices) for (const k of ['lifetime', 'yearly', 'monthly']) if (Number(db.siteContent.prices[k]) > 0) PLANS[k] = Number(db.siteContent.prices[k]);
if (!db.coupons) db.coupons = [];
if (!db.guests) db.guests = [];
if (!db.config.secret) db.config.secret = crypto.randomBytes(32).toString('hex');
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
    fs.renameSync(tmp, DB_FILE);
  }, 150);
}
function saveNow() { clearTimeout(saveTimer); fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 1)); }

const id = (n = 10) => crypto.randomBytes(16).toString('base64url').replace(/[-_]/g, '').slice(0, n);
const now = () => new Date().toISOString();

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pw), salt, 32).toString('hex');
}
function checkPassword(pw, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}
// Platform (Veyra) password: env var, or generated once and printed at startup.
if (!db.config.platformHash) {
  const pw = process.env.PLATFORM_PASSWORD || id(10);
  db.config.platformHash = hashPassword(pw);
  db.config.platformFirstPassword = pw;
}
saveNow();

// ---------- sessions (signed cookies) ----------
function sign(value) { return value + '.' + crypto.createHmac('sha256', db.config.secret).update(value).digest('base64url'); }
function unsign(signed) {
  if (!signed) return null;
  const i = signed.lastIndexOf('.');
  const value = signed.slice(0, i);
  return sign(value) === signed ? value : null;
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(c => { const i = c.indexOf('='); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); });
  return out;
}
function setCookie(res, name, value, maxAge = 60 * 60 * 24 * 30) {
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
}

// ---------- helpers ----------
function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const data = isBuf || typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign({ 'Content-Type': isBuf ? 'application/octet-stream' : (typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8'), 'Cache-Control': 'no-store' }, headers));
  res.end(data);
}
const fail = (res, status, msg) => send(res, status, { error: msg });
function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('Body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}
const str = (v, max = 200) => String(v == null ? '' : v).trim().slice(0, max);
const money = v => Math.max(0, Math.round(Number(v) * 100) / 100 || 0);
const slugify = s => str(s, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'restaurant';

const SOCIAL_KEYS = ['instagram', 'facebook', 'whatsapp', 'google', 'website', 'youtube', 'zomato', 'swiggy'];
function publicRestaurant(r) {
  return {
    id: r.id, slug: r.slug, name: r.name, tagline: r.tagline, logo: r.logo, cover: r.cover,
    brandColor: r.brandColor, currency: r.currency, phone: r.phone, address: r.address,
    socials: r.socials || {}, acceptingOrders: r.acceptingOrders !== false && access(r).active, footerNote: r.footerNote || '',
    poweredBy: r.poweredBy !== false,
    guestLogin: r.guestLogin !== false,
    upi: r.upiId ? { id: r.upiId, name: r.upiName || r.name } : null,
    payFirst: !!(r.service && r.service.payFirst && r.upiId),
    wifi: r.wifi && r.wifi.on && r.wifi.ssid ? { ssid: r.wifi.ssid, pass: r.wifi.pass || '', open: !r.wifi.pass } : null,
    loyalty: loyaltyOn(r) ? { spend: r.loyalty.spend, value: r.loyalty.value, min: r.loyalty.min } : null,
    games: gamesOn(r) ? { reward: r.games.reward || '', points: loyaltyOn(r) ? (r.games.points || 0) : 0 } : null,
  };
}

// ---------- mini games for guests (owner turns them on in Settings) ----------
// Free to play. Scores need a table QR and a server-timed session, and are checked against the fastest
// a real player could score, so a typed-in score is refused. Weeks run Monday to Sunday, India time.
const GAMES_DEFAULT = { on: false, reward: '', points: 0 };
const gamesOn = r => !!(r.games && r.games.on);
const GAME_RULES = { stack: { name: 'Chai Stack', msPer: 230, max: 600 }, catch: { name: 'Roti Catch', msPer: 110, max: 4000 }, tap: { name: 'Spice Rush', msPer: 140, max: 800 } };
const gameRuns = new Map(); // sid -> { rid, game, at, table }
const weekKey = (t = Date.now()) => { const d = new Date(t + 330 * 60000); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); };
const BAD_WORDS = /(fuck|shit|bitch|chut|bhosd|madarch|behench|bhench|lund|gaand|randi|harami|kutt[ae]|cunt|dick|porn|sex)/i;
function gameName(v) { const n = String(v || '').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14); return !n || BAD_WORDS.test(n) ? '' : n; }
function topScores(list, n = 10) { // best score per player name, highest first
  const best = new Map(); for (const x of list) { const k = x.name.toLowerCase(); const b = best.get(k); if (!b || x.score > b.score || (x.score === b.score && x.at < b.at)) best.set(k, x); }
  return [...best.values()].sort((a, b) => b.score - a.score || a.at.localeCompare(b.at)).slice(0, n);
}
const pubScore = x => ({ name: x.name, score: x.score, at: x.at });
// ---------- loyalty points by phone number (owner turns it on in Settings) ----------
const LOYALTY_DEFAULT = { on: false, spend: 100, value: 1, min: 50 };
const loyaltyOn = r => !!(r.loyalty && r.loyalty.on);
function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2); else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : '';
}
function customerOf(r, phone, create, name) {
  if (!db.customers) db.customers = [];
  let c = db.customers.find(x => x.restaurantId === r.id && x.phone === phone);
  if (!c && create) { c = { id: id(12), restaurantId: r.id, phone, name: '', points: 0, spent: 0, visits: 0, createdAt: now(), lastAt: now(), history: [] }; db.customers.push(c); }
  if (c && name && !c.name) c.name = str(name, 60);
  return c;
}
function pointsLog(c, type, points, note, orderId) { c.history = [{ at: now(), type, points, note: note || '', ...(orderId ? { orderId } : {}) }, ...(c.history || [])].slice(0, 100); c.lastAt = now(); }
function earnFor(r, o) { // points are added once, when the order is served or the table is cleared
  if (!loyaltyOn(r) || !o.loyaltyPhone || o.pointsAt || o.status === 'cancelled') return 0;
  const c = customerOf(r, o.loyaltyPhone, true, o.customerName && !/,/.test(o.customerName) ? o.customerName : '');
  const pts = Math.floor(o.total / Math.max(1, r.loyalty.spend));
  o.pointsAt = now(); o.points = pts; c.points += pts; c.spent = money(c.spent + o.total); c.visits++;
  pointsLog(c, 'earn', pts, `Order #${o.number}`, o.id);
  return pts;
}
const customerView = c => ({ phone: c.phone, name: c.name, points: c.points, spent: c.spent, visits: c.visits, lastAt: c.lastAt, createdAt: c.createdAt, history: (c.history || []).slice(0, 20) });
const DAY = 86400000;
// guest accounts: phone (10 digits, Indian numbers) or email
function normLogin(v) {
  v = String(v || '').trim();
  if (v.includes('@')) { v = v.toLowerCase(); return /^[^\s@]{1,64}@[^\s@]{1,120}\.[a-z]{2,}$/.test(v) ? { type: 'email', value: v } : null; }
  let d = v.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2); else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? { type: 'phone', value: d } : null;
}
function guestOf(req, r) {
  const v = unsign(cookies(req)['vd_guest_' + r.id]); if (!v) return null;
  const [gid, ver] = v.split('|');
  const g = db.guests.find(x => x.id === gid && x.restaurantId === r.id);
  return g && String(g.ver || 0) === ver ? g : null;
}
const publicGuest = g => ({ name: g.name, phone: g.phone ? g.phone.replace(/^(\d{2})\d{5}(\d{3})$/, '$1•••••$2') : '', email: g.email });
const tries = new Map();
function tooMany(key) { const t = tries.get(key); return t && t.n >= 8 && Date.now() - t.at < 10 * 60000; }
function failCount(key) { const t = tries.get(key) || { n: 0, at: 0 }; if (Date.now() - t.at > 10 * 60000) t.n = 0; t.n++; t.at = Date.now(); tries.set(key, t); }
// ---- Short license keys: VEYRA-XXXX-XXXX-XXXX ----
// Veyra HQ makes a normal signed key that carries the short code (payload.s) and registers it on the online
// server. Restaurants type the short code; the server (or the local app, through the online server) swaps it
// for the signed key and records which restaurant activated it. Old VD1- keys keep working as before.
const LICENSE_SERVER = (process.env.LICENSE_SERVER || 'https://dinein.veyracreatives.com').replace(/\/$/, '');
const SHORT_RE = /^VEYRA-?([0-9A-HJKMNP-TV-Z]{4})-?([0-9A-HJKMNP-TV-Z]{4})-?([0-9A-HJKMNP-TV-Z]{4})$/;
function normShort(raw) {
  const k = String(raw || '').toUpperCase().replace(/[\s‐-―]+/g, m => /\s/.test(m) ? '' : '-').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/^VEYRA(?=[0-9A-Z])/, 'VEYRA-');
  const m = SHORT_RE.exec(k);
  return m ? `VEYRA-${m[1]}-${m[2]}-${m[3]}` : null;
}
function hqSigned(msg, sig) { // requests from Veyra HQ are signed with the private license key
  try { return crypto.verify(null, Buffer.from(msg), LICENSE_PUBLIC_KEY, Buffer.from(String(sig || ''), 'base64url')); } catch { return false; }
}
function claimLocal(code, rid, name, via, ip) {
  db.licenseCodes = db.licenseCodes || {};
  const L = db.licenseCodes[code];
  if (L && L.revoked) { const e = new Error('This license key has been stopped. Please contact Veyra on WhatsApp +91 89282 46726.'); e.status = 403; throw e; }
  if (!L) { const e = new Error('This license key was not found. Please check it, or ask Veyra on WhatsApp +91 89282 46726.'); e.status = 404; throw e; }
  L.activations = L.activations || [];
  const other = L.activations.find(a => a.rid !== rid);
  if (other) { const e = new Error('This license key is already used by another restaurant. Ask Veyra on WhatsApp +91 89282 46726 if you moved to a new computer.'); e.status = 409; throw e; }
  const a = L.activations.find(x => x.rid === rid);
  if (a) { a.lastAt = now(); a.name = name; } else L.activations.push({ rid, name: str(name, 80), via, ip: ip || '', at: now(), lastAt: now() });
  save();
  return L.key;
}
function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data), u = new URL(url);
    const rq = require(u.protocol === 'http:' ? 'http' : 'https').request(u, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, r => {
      let s = ''; r.on('data', c => s += c); r.on('end', () => { let j = {}; try { j = JSON.parse(s); } catch {} if (r.statusCode >= 400) { const e = new Error(j.error || 'The license server answered ' + r.statusCode); e.status = r.statusCode; return reject(e); } resolve(j); });
    });
    rq.on('error', () => { const e = new Error('Could not reach the Veyra license server. Check the internet and try again.'); e.status = 503; reject(e); });
    rq.setTimeout(15000, () => rq.destroy(new Error('timeout')));
    rq.end(body);
  });
}
async function claimShort(code, r, req) {
  db.licenseCodes = db.licenseCodes || {};
  const central = db.licenseCodes[code] || baseUrl(req).replace(/\/$/, '') === LICENSE_SERVER;
  if (central) return claimLocal(code, r.id, r.name, 'online', clientIp(req));
  const j = await postJson(LICENSE_SERVER + '/api/licenses/claim', { code, rid: (db.config.installId || (db.config.installId = id())) + ':' + r.id, name: r.name });
  return j.key;
}
// Is this restaurant allowed to take orders? (trial running, or paid)
function access(r) {
  if (r.suspended) return { plan: 'suspended', active: false, daysLeft: 0 };
  const plan = r.plan || 'lifetime'; // restaurants made before plans existed keep working
  if (plan === 'lifetime') return { plan, active: true };
  const until = plan === 'trial' ? r.trialEnds : r.paidUntil;
  const daysLeft = until ? Math.ceil((Date.parse(until) - Date.now()) / DAY) : 0;
  return { plan, active: daysLeft > 0, daysLeft: Math.max(0, daysLeft), until };
}
// Lifetime keys include 1 year of updates (payload.u, or 1 year from the issue date for older keys). Yearly plans get updates while paid.
function updatesUntilOf(pl) {
  if (!pl) return null;
  if (pl.u) return pl.u;
  if (TERM_PLANS.includes(pl.p)) return pl.exp || null;
  const d = new Date((pl.iat || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z'); d.setUTCFullYear(d.getUTCFullYear() + 1); return d.toISOString().slice(0, 10);
}
const BILL_DEFAULT = { width: '80', gstin: '', fssai: '', footer: 'Thank you! Please visit again.', autoKot: false, showUpi: true };
function adminRestaurant(r) { return { ...publicRestaurant(r), upiId: r.upiId || '', upiName: r.upiName || '', email: r.email || '', ownerName: r.ownerName || '', access: access(r), license: r.licenseKey ? { code: r.licenseCode || null, key: r.licenseKey, to: r.licensedTo || '', at: r.activatedAt || null, updatesUntil: r.updatesUntil || (r.licenseKey && verifyKey(r.licenseKey).ok ? updatesUntilOf(verifyKey(r.licenseKey).payload) : null) } : null, bill: Object.assign({}, BILL_DEFAULT, r.bill || {}), service: Object.assign({ autoAccept: false, payFirst: false }, r.service || {}), loyaltyCfg: Object.assign({}, LOYALTY_DEFAULT, r.loyalty || {}), wifiCfg: Object.assign({ on: false, ssid: '', pass: '' }, r.wifi || {}), gamesCfg: Object.assign({}, GAMES_DEFAULT, r.games || {}) }; }
function newRestaurant({ name, slug, password, email, ownerName, phone, plan = 'trial' }) {
  let s = slugify(slug || name), n = 2;
  while (db.restaurants.some(r => r.slug === s)) s = slugify(slug || name) + '-' + n++;
  const r = {
    id: id(), slug: s, name: str(name, 80) || 'My Restaurant', tagline: '', logo: '', cover: '',
    brandColor: '#E4572E', currency: '₹', phone: '', address: '', socials: {}, acceptingOrders: true,
    footerNote: '', poweredBy: true, passwordHash: hashPassword(password), orderSeq: 100, createdAt: now(),
    email: str(email, 120).toLowerCase(), ownerName: str(ownerName, 80), ownerPhone: str(phone, 30), plan,
    trialEnds: plan === 'trial' ? new Date(Date.now() + PLANS.trialDays * DAY).toISOString() : null, paidUntil: null,
  };
  db.restaurants.push(r);
  return r;
}

// ---------- live events (Server-Sent Events) ----------
const streams = new Map(); // restaurantId -> Set(res)
function emit(rid, type, data) {
  const set = streams.get(rid); if (!set) return;
  const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) res.write(msg);
}
const orderStreams = new Map(); // orderId -> Set(res)
function emitOrder(order) {
  const set = orderStreams.get(order.id); if (!set) return;
  const msg = `event: order\ndata: ${JSON.stringify(publicOrder(order))}\n\n`;
  for (const res of set) res.write(msg);
}
// ---------- Table Together: everyone at a table adds to one shared order, then splits the bill ----------
const tableCarts = new Map();   // tableId -> { lines: [{ gid, name, itemId, qty }] }
const tableStreams = new Map(); // tableId -> Set(res)
const tableShares = new Map();  // tableId -> Set(lineKey) dishes the table shares equally
const BILL_WINDOW = 8 * 3600e3;
const gidOk = g => /^[A-Za-z0-9_-]{6,40}$/.test(g || '');
function cartOf(tableId) { if (!tableCarts.has(tableId)) tableCarts.set(tableId, { lines: [] }); return tableCarts.get(tableId); }
function cartView(table) {
  const c = cartOf(table.id);
  c.lines = c.lines.filter(l => { const it = db.items.find(i => i.id === l.itemId && i.restaurantId === table.restaurantId && !i.hidden); return it && it.available !== false && l.qty > 0; });
  const people = []; for (const l of c.lines) if (!people.some(x => x.gid === l.gid)) people.push({ gid: l.gid, name: l.name });
  return { lines: c.lines.map(l => ({ gid: l.gid, name: l.name, itemId: l.itemId, qty: l.qty })), people };
}
function billView(r, table) {
  const since = Date.now() - BILL_WINDOW;
  const orders = db.orders.filter(o => o.tableId === table.id && o.status !== 'cancelled' && !o.settled && Date.parse(o.createdAt) > since).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const shared = tableShares.get(table.id) || new Set();
  const lines = [];
  for (const o of orders) o.items.forEach((l, i) => {
    const gid = l.gid || ('o-' + o.id), key = o.id + ':' + i, scale = o.subtotal ? o.total / o.subtotal : 1;
    lines.push({ key, name: l.name, qty: l.qty, price: l.price, amount: money(l.qty * l.price * scale), gid, by: l.by || o.customerName || 'Order #' + o.number, shared: shared.has(key) });
  });
  const people = [];
  for (const l of lines) if (!l.shared && !people.some(x => x.gid === l.gid)) people.push({ gid: l.gid, name: l.by, own: 0 });
  if (!people.length && lines.length) people.push({ gid: 'table', name: 'Table', own: 0 });
  const sharedTotal = money(lines.filter(l => l.shared).reduce((a, l) => a + l.amount, 0));
  for (const l of lines) if (!l.shared) people.find(x => x.gid === l.gid).own += l.amount;
  for (const x of people) { x.sharedPart = money(sharedTotal / people.length); x.amount = Math.round(x.own + sharedTotal / people.length); x.own = money(x.own); }
  const first = orders[0] ? orders[0].createdAt : now();
  const paid = db.requests.filter(q => q.tableId === table.id && q.type === 'paid' && q.createdAt >= first && !q.settled).map(q => ({ gid: q.gid, name: q.name, amount: q.amount, method: q.method || 'upi', counter: !!q.counter, at: q.createdAt }));
  const discount = money(orders.reduce((a, o) => a + (o.discount || 0), 0));
  return { total: money(orders.reduce((a, o) => a + o.total, 0)), discount, coupons: [...new Set(orders.map(o => o.coupon).filter(Boolean))], lines, people, paid, orders: orders.map(o => ({ id: o.id, number: o.number, status: o.status })), upi: r.upiId ? { id: r.upiId, name: r.upiName || r.name } : null };
}
function emitTable(tableId, type, data) {
  const set = tableStreams.get(tableId); if (!set) return;
  const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) res.write(msg);
}
function tableChanged(r, table, cart = true) {
  if (cart) emitTable(table.id, 'cart', cartView(table));
  emitTable(table.id, 'bill', billView(r, table));
}
function upiLink(r, amount, note) {
  return 'upi://pay?' + new URLSearchParams({ pa: r.upiId, pn: r.upiName || r.name, am: Number(amount).toFixed(2), cu: 'INR', tn: note.slice(0, 50) }).toString();
}

setInterval(() => {
  for (const set of [...streams.values(), ...orderStreams.values(), ...tableStreams.values()]) for (const res of set) res.write(': ping\n\n');
}, 25000).unref();
function openStream(req, res, map, key) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n');
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(res);
  req.on('close', () => { const s = map.get(key); if (s) { s.delete(res); if (!s.size) map.delete(key); } });
}

const adminOrder = o => ({ ...publicOrder(o), tableId: o.tableId || null, source: o.source || 'qr', offline: !!o.offline, points: o.points || 0, phone: o.loyaltyPhone || '' }); // the counter needs the table to open its bill
const publicOrder = o => ({ id: o.id, number: o.number, tableName: o.tableName, items: o.items, note: o.note, customerName: o.customerName, total: o.total, subtotal: o.subtotal || o.total, discount: o.discount || 0, coupon: o.coupon || '', status: o.status, createdAt: o.createdAt, updatedAt: o.updatedAt, readyBy: o.readyBy || null, readyAt: o.readyAt || null });

// ---------- wait-time promise: learn how long each dish really takes in this kitchen ----------
const DEFAULT_PREP = 15; // minutes, until the kitchen has history
function prepMinutes(restaurantId) {
  // median minutes from order placed to "ready", per dish, from the last 60 days
  const since = Date.now() - 60 * DAY, per = {};
  for (const o of db.orders) {
    if (o.restaurantId !== restaurantId || !o.readyAt || Date.parse(o.createdAt) < since) continue;
    const mins = (Date.parse(o.readyAt) - Date.parse(o.createdAt)) / 60000;
    if (mins <= 0 || mins > 120) continue;
    for (const l of o.items) (per[l.itemId] = per[l.itemId] || []).push(mins);
  }
  const out = {};
  for (const [k, list] of Object.entries(per)) { list.sort((a, b) => a - b); out[k] = { mins: Math.max(3, Math.round(list[Math.floor(list.length / 2)])), n: list.length }; }
  return out;
}
function estimateReady(r, items) {
  const prep = prepMinutes(r.id);
  const longest = Math.max(...items.map(l => (prep[l.itemId] && prep[l.itemId].n >= 3 ? prep[l.itemId].mins : DEFAULT_PREP)));
  const queue = db.orders.filter(o => o.restaurantId === r.id && (o.status === 'new' || o.status === 'preparing')).length;
  const mins = Math.round(longest + Math.min(15, queue * 1.5)); // a busy kitchen adds a little time
  return new Date(Date.now() + mins * 60000).toISOString();
}

// ---------- coupons ----------
function couponCheck(r, code, subtotal) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return { error: 'Please type a coupon code' };
  const c = db.coupons.find(x => x.restaurantId === r.id && x.code === code);
  if (!c || !c.active) return { error: 'This coupon code is not valid' };
  const today = new Date().toISOString().slice(0, 10);
  if (c.expires && c.expires < today) return { error: 'This coupon has expired' };
  if (c.maxUses && (c.uses || 0) >= c.maxUses) return { error: 'This coupon has been fully used' };
  if (c.minOrder && subtotal < c.minOrder) return { error: `Add ${r.currency || '₹'}${money(c.minOrder - subtotal)} more to use ${c.code} (minimum order ${r.currency || '₹'}${c.minOrder})` };
  let off = c.type === 'percent' ? subtotal * c.value / 100 : c.value;
  if (c.maxOff) off = Math.min(off, c.maxOff);
  off = Math.round(Math.min(off, subtotal));
  return { coupon: c, discount: off, label: couponLabel(c, r) };
}
function couponLabel(c, r) {
  const cur = r.currency || '₹';
  return (c.type === 'percent' ? `${c.value}% off` : `${cur}${c.value} off`) + (c.maxOff && c.type === 'percent' ? ` up to ${cur}${c.maxOff}` : '') + (c.minOrder ? ` on orders above ${cur}${c.minOrder}` : '');
}
const publicCoupon = (c, r) => ({ code: c.code, label: couponLabel(c, r), note: c.note || '' });

// ---------- base URL for QR codes ----------
function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}
// ---- Sign in with Google: the browser gets an ID token from Google, we check it with Google and read the email ----
// Veyra's Google sign-in client (public id, works only on https://dinein.veyracreatives.com). /platform > Google sign-in can replace it.
const DEFAULT_GOOGLE_CLIENT_ID = '726577267171-aot0ttr7q8e636cug5jnbe5jacu0af1c.apps.googleusercontent.com';
const googleClientId = req => (process.env.GOOGLE_CLIENT_ID || (db.config && db.config.googleClientId) || (!req || /(^|\.)dinein\.veyracreatives\.com$/.test(String(req.headers.host || '').split(':')[0])) && !process.versions.electron && DEFAULT_GOOGLE_CLIENT_ID || '').trim();
function verifyGoogle(credential) {
  return new Promise((resolve, reject) => {
    const cid = googleClientId(); if (!cid) return reject(Object.assign(new Error('Google sign-in is not set up yet.'), { status: 400 }));
    require('https').get('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(credential || '')), r => {
      let s = ''; r.on('data', c => s += c); r.on('end', () => {
        let j = {}; try { j = JSON.parse(s); } catch {}
        const ok = r.statusCode === 200 && j.aud === cid && /accounts\.google\.com$/.test(j.iss || '') && (j.email_verified === true || j.email_verified === 'true') && Number(j.exp) * 1000 > Date.now();
        ok ? resolve({ email: String(j.email).toLowerCase(), name: j.name || j.given_name || '' }) : reject(Object.assign(new Error('Google sign-in failed. Please try again.'), { status: 401 }));
      });
    }).on('error', () => reject(Object.assign(new Error('Could not reach Google. Check the internet.'), { status: 503 })));
  });
}
// ---- Website stats (our own, privacy-friendly): daily totals only. No cookies; visitors are counted with a
// hash of IP + browser + a salt that changes every day, so nobody can be followed from one day to the next.
const BOT_RE = /bot|crawl|spider|slurp|headless|preview|facebookexternalhit|whatsapp|curl|wget|python|monitor/i;
const statSalt = { day: '', salt: '', seen: new Set() };
function statDay() {
  const d = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10); // days in India time
  const A = db.analytics = db.analytics || {};
  if (!A[d]) { A[d] = { views: 0, visitors: 0, pages: {}, refs: {}, src: {}, dev: {}, events: {} }; for (const k of Object.keys(A).sort().slice(0, -400)) delete A[k]; }
  if (statSalt.day !== d) { statSalt.day = d; statSalt.salt = crypto.randomBytes(16).toString('hex'); statSalt.seen = new Set(); }
  return A[d];
}
const bump = (o, k, n = 1) => { if (!k) return; k = String(k).slice(0, 120); if (!(k in o) && Object.keys(o).length >= 300) k = '(other)'; o[k] = (o[k] || 0) + n; };
function trackEvent(name) { bump(statDay().events, name); }
function trackView(req, b) {
  const ua = String(req.headers['user-agent'] || ''); if (BOT_RE.test(ua)) return;
  const D = statDay(), page = String(b.p || '/').replace(/\/(m|admin)\/[^/]+.*/, '/$1/…').slice(0, 80);
  if (b.e) return bump(D.events, String(b.e).replace(/[^a-z_]/g, '').slice(0, 30));
  D.views++; bump(D.pages, page);
  const h = crypto.createHash('sha256').update(statSalt.salt + clientIp(req) + ua).digest('hex').slice(0, 16);
  if (!statSalt.seen.has(h)) {
    statSalt.seen.add(h); D.visitors++;
    let ref = ''; try { ref = b.r ? new URL(b.r).hostname.replace(/^www\./, '') : ''; } catch {}
    const host = String(req.headers.host || '').replace(/:\d+$/, '');
    bump(D.refs, !ref || ref === host ? (b.s ? '' : 'Direct') : ref);
    if (b.s) bump(D.src, String(b.s).toLowerCase().slice(0, 40));
    bump(D.dev, /Mobi|Android|iPhone/i.test(ua) ? 'Phone' : /iPad|Tablet/i.test(ua) ? 'Tablet' : 'Computer');
  }
}
let statSaveT = null; const saveSoon = () => { if (!statSaveT) statSaveT = setTimeout(() => { statSaveT = null; save(); }, 15000); };
const clientIp = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}
const tableUrl = (req, r, t) => `${baseUrl(req)}/m/${r.slug}?t=${t.token}`;

// ---------- static files ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
function serveFile(res, file, cache = 'no-cache') {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return fail(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': cache });
    fs.createReadStream(file).pipe(res);
  });
}
// Public menu page with search-friendly title, description, share preview and Restaurant + Menu structured data.
// Table links (?t=...) are kept out of search results; the plain /m/<slug> link is the one Google should show.
function serveMenuPage(req, res, url, slug) {
  const r = db.restaurants.find(x => x.slug === slug);
  let page = fs.readFileSync(path.join(PUBLIC_DIR, 'menu.html'), 'utf8');
  if (r) {
    const e = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const base = baseUrl(req), canon = `${base}/m/${r.slug}`, abs = u => !u ? '' : /^https?:/.test(u) ? u : base + u;
    const items = db.items.filter(i => i.restaurantId === r.id && !i.hidden);
    const cats = db.categories.filter(c => c.restaurantId === r.id).sort((a, b) => a.sort - b.sort);
    const top = items.filter(i => i.bestseller).concat(items.filter(i => !i.bestseller)).slice(0, 4).map(i => i.name);
    const title = `${r.name}${r.address ? ' · ' + r.address.split(',').slice(-2).join(',').trim() : ''} · Menu & Order Online`;
    const desc = (r.tagline ? r.tagline + '. ' : '') + `See the full menu of ${r.name} with photos and prices${top.length ? ': ' + top.join(', ') : ''}. Scan the QR on your table to order.`;
    const img = abs(r.cover || r.logo);
    const ld = { '@context': 'https://schema.org', '@type': 'Restaurant', name: r.name, url: canon, ...(r.tagline ? { description: r.tagline } : {}), ...(r.phone ? { telephone: r.phone } : {}),
      ...(r.address ? { address: { '@type': 'PostalAddress', streetAddress: r.address, addressCountry: 'IN' } } : {}), ...(img ? { image: img } : {}), ...(r.logo ? { logo: abs(r.logo) } : {}),
      priceRange: '₹₹', currenciesAccepted: 'INR', paymentAccepted: r.upiId ? 'Cash, UPI' : 'Cash',
      sameAs: Object.values(r.socials || {}).filter(v => /^https?:/.test(v)),
      hasMenu: { '@type': 'Menu', name: `${r.name} menu`, hasMenuSection: cats.map(c => ({ '@type': 'MenuSection', name: c.name,
        hasMenuItem: items.filter(i => i.categoryId === c.id).slice(0, 60).map(i => ({ '@type': 'MenuItem', name: i.name, ...(i.description ? { description: i.description } : {}), ...(i.photo ? { image: abs(i.photo) } : {}),
          ...(i.diet === 'veg' ? { suitableForDiet: 'https://schema.org/VegetarianDiet' } : {}), offers: { '@type': 'Offer', price: String(i.price), priceCurrency: 'INR' } })) })) } };
    const head = `<title>${e(title)}</title>
<meta name="description" content="${e(desc.slice(0, 300))}">
<link rel="canonical" href="${e(canon)}">
<meta name="robots" content="${url.searchParams.get('t') || !access(r).active ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
<meta property="og:type" content="restaurant.restaurant"><meta property="og:url" content="${e(canon)}"><meta property="og:title" content="${e(r.name + ' · Menu')}"><meta property="og:description" content="${e(desc.slice(0, 200))}">${img ? `<meta property="og:image" content="${e(img)}"><meta name="twitter:card" content="summary_large_image">` : ''}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
    page = page.replace('<title>Menu</title>', head).replace('<html lang="en">', '<html lang="en-IN">')
      .replace('<div id="app" class="app"><div class="loading"><div class="spinner"></div></div></div>', `<div id="app" class="app"><div class="loading"><div class="spinner"></div><noscript><h1>${e(r.name)} menu</h1>${cats.map(c => `<h2>${e(c.name)}</h2><ul>${items.filter(i => i.categoryId === c.id).map(i => `<li>${e(i.name)} · ₹${e(i.price)}</li>`).join('')}</ul>`).join('')}</noscript></div></div>`);
  }
  res.writeHead(r ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(page);
}
function safeJoin(base, p) {
  const full = path.normalize(path.join(base, p));
  return full.startsWith(base) ? full : null;
}

// ---------- image upload ----------
function saveImage(dataUrl) {
  const m = /^data:image\/(png|jpe?g|webp|svg\+xml);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new Error('Please choose a PNG, JPG, WEBP or SVG image');
  const ext = m[1] === 'svg+xml' ? 'svg' : (m[1] === 'jpeg' ? 'jpg' : m[1]);
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) throw new Error('Image is larger than 5 MB');
  const name = id(14) + '.' + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return '/uploads/' + name;
}

// ---------- auth guards ----------
function adminOf(req) {
  const v = unsign(cookies(req).vd_admin);
  if (!v) return null;
  const [rid, ver] = v.split('|');
  const r = db.restaurants.find(x => x.id === rid);
  return r && String(r.sessionVer || 0) === ver ? r : null;
}
function isPlatform(req) { return unsign(cookies(req).vd_platform) === 'platform|' + (db.config.platformVer || 0); }

// ---------- routes ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const m = req.method;

  // ---- pages ----
  // product website (landing page) at the root; restaurants use /admin and /signup
  const SITE_DIR = path.join(PUBLIC_DIR, 'site');
  if (m === 'GET' && (p === '/' || p === '/index.html')) {
    if (!db.siteContent) return serveFile(res, path.join(SITE_DIR, 'index.html'));
    if (!siteCache) { const stockFile = path.join(SITE_DIR, 'content.json'); siteCache = siteContent.render(fs.readFileSync(path.join(SITE_DIR, 'index.html'), 'utf8'), db.siteContent, fs.existsSync(stockFile) ? JSON.parse(fs.readFileSync(stockFile, 'utf8')) : null); }
    return send(res, 200, siteCache, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  }
  if (m === 'GET' && /^\/(privacy|terms|refund|contact)\/?$/.test(p)) return serveFile(res, path.join(SITE_DIR, p.replace(/\//g, ''), 'index.html'), 'no-cache');
  if (m === 'GET' && /^\/site-media\/[A-Za-z0-9]+\.(png|jpg|webp|svg)$/.test(p)) { const f = safeJoin(path.join(DATA_DIR, 'site-media'), p.slice(11)); return f ? serveFile(res, f, 'public, max-age=31536000, immutable') : fail(res, 404, 'Not found'); }
  if (m === 'GET' && (/^\/img\/[A-Za-z0-9._-]+$/.test(p) || /^\/(og\.jpg|favicon-32\.png|icon-180\.png|icon-192\.png|icon-512\.png)$/.test(p))) { const f = safeJoin(SITE_DIR, p); return f ? serveFile(res, f, 'public, max-age=86400') : fail(res, 404, 'Not found'); }
  // Windows installer: served from this server (fast in India, with a real file size) when the local copy is ready, else from GitHub Pages.
  if (m === 'GET' && /^\/download\/(Veyra-Dine-In-Setup\.exe|latest\.yml|Veyra-Dine-In-Setup\.exe\.blockmap)$/.test(p)) {
    const name = p.slice(10), f = path.join(DL_DIR, name);
    if (name.endsWith('.exe') && !/^bytes=[1-9]/.test(req.headers.range || '')) { const d = new Date().toISOString().slice(0, 10), D = db.config.downloads = db.config.downloads || {}; D[d] = (D[d] || 0) + 1; for (const k of Object.keys(D).sort().slice(0, -400)) delete D[k]; save(); }
    if (!fs.existsSync(f)) { res.writeHead(302, { Location: DL_REMOTE + '/' + name }); return res.end(); }
    if (name.endsWith('.exe')) res.setHeader('Content-Disposition', 'attachment; filename="' + name + '"');

    return serveFile(res, f, name.endsWith('.yml') ? 'no-cache' : 'public, max-age=3600');
  }
  // Restaurant admin as a phone app: web app manifest + a small service worker (needed for install and for order pop-ups on Android)
  if (m === 'GET' && p === '/admin.webmanifest') return send(res, 200, JSON.stringify({
    name: 'Veyra Dine In Admin', short_name: 'Dine In Admin', description: 'Live orders, bills, KOT and sales for your restaurant',
    id: '/admin', start_url: '/admin?app=1', scope: '/', display: 'standalone', orientation: 'any', background_color: '#FBF6EE', theme_color: '#E4572E',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
  }), { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-cache' });
  if (m === 'GET' && p === '/admin-sw.js') return send(res, 200, `// Veyra Dine In admin: shows order pop-ups and an offline page. It never stores orders or menus.
const C = 'vd-admin-v2', SHELL = ['/admin', '/assets/base.css', '/assets/admin.css', '/assets/shell.css', '/assets/admin.js', '/assets/icons.js', '/assets/google.js', '/icon-192.png', '/favicon-32.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith('vd-admin') && x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
// Network first, so updates show straight away. Without internet the admin still opens from the saved copy.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const shell = u.origin === location.origin && (u.pathname.startsWith('/assets/') || /^\\/(icon-192|favicon-32)\\.png$/.test(u.pathname));
  const font = /fonts\\.(googleapis|gstatic)\\.com$/.test(u.hostname);
  if (shell || font) { e.respondWith(fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') { const c2 = r.clone(); caches.open(C).then(c => c.put(e.request, c2)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }))); return; }
  if (e.request.mode !== 'navigate') return;
  const adminPage = u.pathname === '/admin' || u.pathname.startsWith('/admin/');
  e.respondWith(fetch(e.request).then(r => { if (adminPage && r.ok) { const c2 = r.clone(); caches.open(C).then(c => c.put('/admin', c2)); } return r; }).catch(async () => (adminPage && await caches.match('/admin')) || new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font:16px system-ui;padding:40px 24px;text-align:center;background:#FBF6EE;color:#2b211b"><h2>No internet</h2><p>Orders will show again when your phone is back online.</p><button onclick="location.reload()" style="font:inherit;padding:12px 22px;border:0;border-radius:12px;background:#E4572E;color:#fff">Try again</button>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(l => { const w = l.find(c => c.url.includes('/admin')); return w ? w.focus() : self.clients.openWindow('/admin'); }));
});
`, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' });
  if (m === 'GET' && p === '/favicon.ico') return serveFile(res, path.join(SITE_DIR, 'favicon-32.png'), 'public, max-age=86400');
  if (m === 'GET' && /^\/m\/[a-z0-9-]+\/?$/.test(p)) return serveMenuPage(req, res, url, p.split('/')[2]);
  if (m === 'GET' && p === '/robots.txt') return send(res, 200, `User-agent: *\nDisallow: /admin\nDisallow: /platform\nDisallow: /api/\nDisallow: /print-qr\nAllow: /m/\n\nSitemap: ${baseUrl(req)}/sitemap.xml\n`, { 'Content-Type': 'text/plain; charset=utf-8' });
  if (m === 'GET' && p === '/sitemap.xml') { const b = baseUrl(req), d = new Date().toISOString().slice(0, 10), u = (loc, freq, pri) => `  <url><loc>${b}${loc}</loc><lastmod>${d}</lastmod><changefreq>${freq}</changefreq><priority>${pri}</priority></url>`;
    return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[u('/', 'weekly', '1.0'), u('/signup', 'monthly', '0.8'), ...['contact', 'privacy', 'terms', 'refund'].map(x => u('/' + x, 'yearly', '0.3')), ...db.restaurants.filter(r => access(r).active).map(r => u('/m/' + r.slug, 'weekly', '0.6'))].join('\n')}\n</urlset>\n`, { 'Content-Type': 'application/xml; charset=utf-8' }); }
  if (m === 'GET' && p === '/signup') { // the sign-up page is public, so search engines may index it (the admin pages stay hidden)
    const b = baseUrl(req), h = fs.readFileSync(path.join(PUBLIC_DIR, 'admin.html'), 'utf8')
      .replace('<meta name="robots" content="noindex, nofollow">', `<meta name="robots" content="index, follow"><meta name="description" content="Start your free 10-day trial of Veyra Dine In, the QR code menu and table ordering system for restaurants, cafés and dhabas in India. No card needed."><link rel="canonical" href="${b}/signup"><meta property="og:title" content="Start your free trial · Veyra Dine In"><meta property="og:image" content="${b}/og.jpg">`)
      .replace(/<title>[^<]*<\/title>/, '<title>Free trial: QR Code Ordering for Restaurants · Veyra Dine In</title>');
    return send(res, 200, h, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  }
  if (m === 'GET' && /^\/admin(\/[a-z0-9-]+)?\/?$/.test(p)) return serveFile(res, path.join(PUBLIC_DIR, 'admin.html'));
  if (m === 'GET' && p === '/platform') return serveFile(res, path.join(PUBLIC_DIR, 'platform.html'));
  if (m === 'GET' && p === '/print-qr') return serveFile(res, path.join(PUBLIC_DIR, 'print-qr.html'));
  if (m === 'GET' && p.startsWith('/uploads/')) { const f = safeJoin(UPLOAD_DIR, p.slice(9)); return f ? serveFile(res, f, 'public, max-age=31536000, immutable') : fail(res, 404, 'Not found'); }
  if (m === 'GET' && p.startsWith('/assets/')) { const f = safeJoin(PUBLIC_DIR, p); return f ? serveFile(res, f) : fail(res, 404, 'Not found'); }

  if (!p.startsWith('/api/')) return fail(res, 404, 'Not found');
  let body = {};
  if (m === 'POST' || m === 'PUT' || m === 'PATCH') {
    try { body = await readBody(req); } catch (e) { return fail(res, 400, e.message); }
  }
  if (m === 'POST' && p === '/api/requests') { // "Suggest a feature" and "Custom build" from the website and the admin
    const ip = clientIp(req), tk = 'req|' + ip;
    if (tooMany(tk)) return fail(res, 429, 'Too many messages. Please try again later.');
    failCount(tk); // max 8 per 10 minutes from one address
    const type = body.type === 'custom' ? 'custom' : 'feature', ra = adminOf(req);
    const lead = { id: id(10), type, status: 'new', name: str(body.name, 60) || (ra && ra.ownerName) || '', restaurant: str(body.restaurant, 80) || (ra && ra.name) || '', phone: str(body.phone, 20) || (ra && (ra.ownerPhone || ra.phone)) || '', email: str(body.email, 120) || (ra && ra.email) || '', city: str(body.city, 60), message: str(body.message, 2000), budget: str(body.budget, 40), restaurantId: ra ? ra.id : null, from: ra ? 'admin' : 'website', createdAt: now(), note: '' };
    if (!lead.message) return fail(res, 400, 'Please write your message.');
    if (!lead.phone && !lead.email) return fail(res, 400, 'Please add your mobile number.');
    db.leads = db.leads || []; db.leads.push(lead); if (db.leads.length > 5000) db.leads = db.leads.slice(-5000);
    trackEvent(type === 'custom' ? 'custom_enquiry' : 'feature_idea'); save();
    return send(res, 201, { ok: true });
  }
  if (m === 'POST' && p === '/api/t') { trackView(req, body && typeof body === 'object' ? body : {}); saveSoon(); res.writeHead(204); return res.end(); }
  let mt;

  // ===== guest accounts (log in before ordering) =====
  if ((mt = /^\/api\/menu\/([a-z0-9-]+)\/guest\/(me|signup|login|logout|google)$/.exec(p))) {
    const r = db.restaurants.find(x => x.slug === mt[1]);
    if (!r) return fail(res, 404, 'Restaurant not found');
    const act = mt[2];
    if (m === 'GET' && act === 'me') { const g = guestOf(req, r); return send(res, 200, { guest: g ? publicGuest(g) : null }); }
    if (m !== 'POST') return fail(res, 404, 'Not found');
    if (act === 'logout') { setCookie(res, 'vd_guest_' + r.id, '', 0); return send(res, 200, { ok: true }); }
    if (act === 'google') {
      let gu; try { gu = await verifyGoogle(body.credential); } catch (e) { return fail(res, e.status || 400, e.message); }
      let g = db.guests.find(x => x.restaurantId === r.id && x.email === gu.email);
      if (!g) { g = { id: id(12), restaurantId: r.id, name: str(gu.name, 40) || gu.email.split('@')[0], phone: '', email: gu.email, passwordHash: hashPassword(crypto.randomBytes(12).toString('hex')), ver: 0, google: true, createdAt: now(), lastAt: now() }; db.guests.push(g); }
      g.lastAt = now(); save();
      setCookie(res, 'vd_guest_' + r.id, sign(g.id + '|' + (g.ver || 0)), 60 * 60 * 24 * 180);
      return send(res, 200, { guest: publicGuest(g) });
    }
    const login = normLogin(body.login);
    if (!login) return fail(res, 400, 'Enter a 10-digit mobile number or an email address.');
    const key = (req.socket.remoteAddress || '') + '|' + r.id + '|' + login.value;
    if (tooMany(key)) return fail(res, 429, 'Too many tries. Please wait 10 minutes or ask the staff.');
    const pw = String(body.password || '');
    let g = db.guests.find(x => x.restaurantId === r.id && x[login.type] === login.value);
    if (act === 'signup') {
      if (g) return fail(res, 409, `You already have an account with this ${login.type === 'phone' ? 'number' : 'email'}. Please log in.`);
      const name = str(body.name, 40);
      if (!name) return fail(res, 400, 'Please enter your name.');
      if (pw.length < 4) return fail(res, 400, 'Password needs at least 4 characters.');
      g = { id: id(12), restaurantId: r.id, name, phone: login.type === 'phone' ? login.value : '', email: login.type === 'email' ? login.value : '', passwordHash: hashPassword(pw), ver: 0, createdAt: now(), lastAt: now() };
      db.guests.push(g);
    } else {
      if (!g || !checkPassword(pw, g.passwordHash)) { failCount(key); return fail(res, 401, g ? 'Wrong password. Forgot it? Ask the staff to reset it.' : `No account with this ${login.type === 'phone' ? 'number' : 'email'} yet. Tap "Create account".`); }
      g.lastAt = now();
    }
    save();
    setCookie(res, 'vd_guest_' + r.id, sign(g.id + '|' + (g.ver || 0)), 60 * 60 * 24 * 180);
    return send(res, 200, { guest: publicGuest(g) });
  }

  // ===== customer (public) =====
  if (m === 'GET' && (mt = /^\/api\/menu\/([a-z0-9-]+)$/.exec(p))) {
    const r = db.restaurants.find(x => x.slug === mt[1]);
    if (!r) return fail(res, 404, 'Restaurant not found');
    const token = url.searchParams.get('t');
    const table = token ? db.tables.find(t => t.restaurantId === r.id && t.token === token && t.active !== false) : null;
    return send(res, 200, {
      restaurant: publicRestaurant(r),
      table: table ? { name: table.name, token: table.token } : null,
      offers: db.coupons.filter(c => c.restaurantId === r.id && c.active && c.showOnMenu && (!c.expires || c.expires >= new Date().toISOString().slice(0, 10)) && !(c.maxUses && (c.uses || 0) >= c.maxUses)).map(c => publicCoupon(c, r)),
      prep: (() => { const pm = prepMinutes(r.id), out = {}; for (const [k, v] of Object.entries(pm)) if (v.n >= 3) out[k] = v.mins; return out; })(),
      categories: db.categories.filter(c => c.restaurantId === r.id).sort((a, b) => a.sort - b.sort).map(c => ({ id: c.id, name: c.name })),
      items: db.items.filter(i => i.restaurantId === r.id && !i.hidden).sort((a, b) => a.sort - b.sort).map(i => ({ id: i.id, categoryId: i.categoryId, name: i.name, description: i.description, price: i.price, photo: i.photo, diet: i.diet, available: i.available !== false, bestseller: !!i.bestseller, spicy: !!i.spicy })),
    });
  }
  if (m === 'POST' && (mt = /^\/api\/menu\/([a-z0-9-]+)\/coupon$/.exec(p))) {
    const r = db.restaurants.find(x => x.slug === mt[1]);
    if (!r) return fail(res, 404, 'Restaurant not found');
    const v = couponCheck(r, body.code, Number(body.subtotal) || 0);
    if (v.error) return fail(res, 400, v.error);
    return send(res, 200, { code: v.coupon.code, discount: v.discount, label: v.label });
  }
  if ((mt = /^\/api\/menu\/([a-z0-9-]+)\/table(\/[a-z-]+)?$/.exec(p))) {
    const r = db.restaurants.find(x => x.slug === mt[1]);
    const token = m === 'GET' ? url.searchParams.get('t') : body.t;
    const table = r && db.tables.find(t => t.restaurantId === r.id && t.token === token && t.active !== false);
    if (!table) return fail(res, 400, 'Please scan the QR code on your table.');
    const sub = mt[2] || '';
    if (m === 'GET' && sub === '') return send(res, 200, { cart: cartView(table), bill: billView(r, table) });
    if (m === 'GET' && sub === '/stream') {
      openStream(req, res, tableStreams, table.id);
      res.write(`event: cart\ndata: ${JSON.stringify(cartView(table))}\n\n`);
      return res.write(`event: bill\ndata: ${JSON.stringify(billView(r, table))}\n\n`);
    }
    if (m === 'GET' && sub === '/upi-qr') {
      if (!r.upiId) return fail(res, 404, 'No UPI ID');
      const amount = Math.max(1, Math.min(500000, Number(url.searchParams.get('am')) || 0));
      const svg = await QRCode.toString(upiLink(r, amount, `${table.name} ${str(url.searchParams.get('n'), 30)}`.trim()), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' }); return res.end(svg);
    }
    if (m !== 'POST') return fail(res, 404, 'Not found');
    if (!gidOk(body.gid)) return fail(res, 400, 'Please reload the page.');
    const cart = cartOf(table.id);
    const name = str(body.name, 40);
    if (sub === '/cart') {
      if (r.acceptingOrders === false || !access(r).active) return fail(res, 409, 'Sorry, the restaurant is not taking orders right now. Please ask the staff.');
      const item = db.items.find(i => i.id === body.itemId && i.restaurantId === r.id && !i.hidden);
      if (!item) return fail(res, 404, 'Dish not found');
      if (item.available === false) return fail(res, 409, `${item.name} just sold out.`);
      const qty = Math.min(50, Math.max(0, parseInt(body.qty, 10) || 0));
      let line = cart.lines.find(l => l.gid === body.gid && l.itemId === item.id);
      const others = [...new Set(cart.lines.filter(l => l.gid !== body.gid).map(l => l.gid))].length;
      const myName = name || (cart.lines.find(l => l.gid === body.gid) || {}).name || `Guest ${others + 1}`;
      if (qty && !line) cart.lines.push(line = { gid: body.gid, name: myName, itemId: item.id, qty });
      else if (line) line.qty = qty;
      cart.lines.forEach(l => { if (l.gid === body.gid) l.name = myName; });
      cart.lines = cart.lines.filter(l => l.qty > 0);
      emitTable(table.id, 'cart', cartView(table));
      return send(res, 200, cartView(table));
    }
    if (sub === '/name') {
      if (!name) return fail(res, 400, 'Please type your name');
      cart.lines.forEach(l => { if (l.gid === body.gid) l.name = name; });
      emitTable(table.id, 'cart', cartView(table));
      return send(res, 200, cartView(table));
    }
    if (sub === '/share') {
      const set = tableShares.get(table.id) || new Set(); tableShares.set(table.id, set);
      if (body.shared) set.add(str(body.key, 40)); else set.delete(str(body.key, 40));
      tableChanged(r, table, false);
      return send(res, 200, billView(r, table));
    }
    if (sub === '/paid') {
      const amount = Math.round(Number(body.amount) || 0);
      if (amount <= 0) return fail(res, 400, 'Amount missing');
      const q = { id: id(12), restaurantId: r.id, tableId: table.id, tableName: table.name, type: 'paid', gid: body.gid, name: name || 'A guest', amount, done: false, createdAt: now() };
      db.requests.push(q); save();
      emit(r.id, 'request', q); tableChanged(r, table, false);
      return send(res, 201, billView(r, table));
    }
    return fail(res, 404, 'Not found');
  }
  if ((mt = /^\/api\/menu\/([a-z0-9-]+)\/games\/(start|score|top)$/.exec(p))) {
    const r = db.restaurants.find(x => x.slug === mt[1]); if (!r || !gamesOn(r)) return fail(res, 404, 'Games are off');
    if (!db.scores) db.scores = [];
    if (m === 'GET' && mt[2] === 'top') {
      const wk = weekKey(), mine = db.scores.filter(x => x.restaurantId === r.id && !x.hidden), out = {};
      for (const g of Object.keys(GAME_RULES)) { const l = mine.filter(x => x.game === g); out[g] = { week: topScores(l.filter(x => x.week === wk)).map(pubScore), all: topScores(l, 5).map(pubScore) }; }
      return send(res, 200, { games: out, reward: r.games.reward || '', points: loyaltyOn(r) ? (r.games.points || 0) : 0 });
    }
    if (m === 'POST' && mt[2] === 'start') {
      if (!GAME_RULES[body.game]) return fail(res, 400, 'Unknown game');
      const table = db.tables.find(t => t.restaurantId === r.id && t.token === body.table && t.active !== false);
      if (!table) return fail(res, 400, 'Scan the QR code on your table to play for the leaderboard.');
      const tk = 'game|' + clientIp(req); const t = tries.get(tk) || { n: 0, at: Date.now() }; if (Date.now() - t.at > 3600000) { t.n = 0; t.at = Date.now(); } t.n++; tries.set(tk, t);
      if (t.n > 120) return fail(res, 429, 'That is a lot of games! Take a break and try again in a while.');
      if (gameRuns.size > 5000) { const cut = Date.now() - 3600000; for (const [k, v] of gameRuns) if (v.at < cut) gameRuns.delete(k); }
      const sid = id(18); gameRuns.set(sid, { rid: r.id, game: body.game, at: Date.now(), table: table.id });
      return send(res, 200, { sid });
    }
    if (m === 'POST' && mt[2] === 'score') {
      const run = gameRuns.get(str(body.sid, 40)); if (!run || run.rid !== r.id) return fail(res, 400, 'This game has expired. Play again to post a score.');
      gameRuns.delete(str(body.sid, 40));
      const rule = GAME_RULES[run.game], score = Math.floor(Number(body.score) || 0), took = Date.now() - run.at;
      if (score < 1) return fail(res, 400, 'Score at least 1 point to get on the board.');
      if (score > rule.max || took < score * rule.msPer || took > 3 * 3600000) return fail(res, 400, 'That score could not be checked. Play again.');
      const name = gameName(body.name); if (!name) return fail(res, 400, 'Enter a name or nickname (letters and numbers).');
      const ph = normPhone(body.phone) || '';
      const x = { id: id(12), restaurantId: r.id, game: run.game, name, phone: ph, score, at: now(), week: weekKey(), tableId: run.table };
      db.scores.push(x);
      const same = db.scores.filter(y => y.restaurantId === r.id && y.game === run.game);
      if (same.length > 400) { const keep = new Set(same.sort((a, b) => b.score - a.score).slice(0, 250).map(y => y.id)); const wk = weekKey(); db.scores = db.scores.filter(y => y.restaurantId !== r.id || y.game !== run.game || keep.has(y.id) || y.week === wk); }
      save();
      const wk = weekKey(), list = topScores(db.scores.filter(y => y.restaurantId === r.id && y.game === run.game && y.week === wk && !y.hidden), 1000);
      const rank = list.findIndex(y => y.name.toLowerCase() === name.toLowerCase()) + 1;
      emit(r.id, 'game', { game: run.game, name, score });
      return send(res, 201, { rank, best: list[rank - 1] ? list[rank - 1].score : score });
    }
    return fail(res, 404, 'Not found');
  }
  if (m === 'GET' && p === '/api/public/top-scores') { // live "Top players" on the Veyra Dine In website: names, restaurant and score only
    const on = new Map(db.restaurants.filter(gamesOn).map(r => [r.id, r]));
    const wk = weekKey(); let list = (db.scores || []).filter(x => on.has(x.restaurantId) && !x.hidden);
    const week = list.filter(x => x.week === wk);
    const pick = l => { const best = new Map(); for (const x of l) { const k = x.restaurantId + '|' + x.game + '|' + x.name.toLowerCase(); const b = best.get(k); if (!b || x.score > b.score) best.set(k, x); } return [...best.values()].sort((a, b) => b.score / GAME_RULES[b.game].max - a.score / GAME_RULES[a.game].max).slice(0, 10); };
    const rows = pick(week.length >= 3 ? week : list).map(x => ({ name: x.name, restaurant: on.get(x.restaurantId).name, game: GAME_RULES[x.game].name, gameId: x.game, score: x.score, at: x.at }));
    const totals = Object.fromEntries(Object.keys(GAME_RULES).map(g => [g, pick(list.filter(x => x.game === g)).slice(0, 1).map(x => ({ name: x.name, restaurant: on.get(x.restaurantId).name, score: x.score }))[0] || null]));
    return send(res, 200, { thisWeek: week.length >= 3, rows, best: totals, restaurants: on.size, plays: (db.scores || []).filter(x => on.has(x.restaurantId)).length }, { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=30' });
  }
  if (m === 'GET' && (mt = /^\/api\/menu\/([a-z0-9-]+)\/wifi-qr$/.exec(p))) { // other guests can scan this to join the WiFi
    const r = db.restaurants.find(x => x.slug === mt[1]); if (!r || !r.wifi || !r.wifi.on || !r.wifi.ssid) return fail(res, 404, 'Not found');
    const e = v => String(v).replace(/([\\;,:"])/g, '\\$1');
    const svg = await QRCode.toString(`WIFI:T:${r.wifi.pass ? 'WPA' : 'nopass'};S:${e(r.wifi.ssid)};${r.wifi.pass ? `P:${e(r.wifi.pass)};` : ''};`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    return send(res, 200, svg, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' });
  }
  if (m === 'GET' && (mt = /^\/api\/menu\/([a-z0-9-]+)\/points$/.exec(p))) { // guests check their points with their number
    const r = db.restaurants.find(x => x.slug === mt[1]); if (!r || !loyaltyOn(r)) return fail(res, 404, 'Not found');
    const ph = normPhone(url.searchParams.get('phone')); if (!ph) return fail(res, 400, 'Enter your 10-digit mobile number');
    const c = customerOf(r, ph); return send(res, 200, { points: c ? c.points : 0, worth: Math.round((c ? c.points : 0) * r.loyalty.value), min: r.loyalty.min, spend: r.loyalty.spend, value: r.loyalty.value });
  }
  if (m === 'POST' && (mt = /^\/api\/menu\/([a-z0-9-]+)\/orders$/.exec(p))) {
    const r = db.restaurants.find(x => x.slug === mt[1]);
    if (!r) return fail(res, 404, 'Restaurant not found');
    if (r.acceptingOrders === false || !access(r).active) return fail(res, 409, 'Sorry, the restaurant is not taking orders right now. Please ask the staff.');
    const table = db.tables.find(t => t.restaurantId === r.id && t.token === body.table && t.active !== false);
    if (!table) return fail(res, 400, 'Please scan the QR code on your table to order.');
    const guest = guestOf(req, r);
    if (r.guestLogin !== false && !guest) return fail(res, 401, 'Please log in to place your order.');
    const lines = [];
    const shared = !!body.shared && gidOk(body.gid);
    if (shared) {
      const cv = cartView(table);
      if (!cv.lines.length) return fail(res, 400, 'Your table order is empty. Someone may have just sent it.');
      for (const l of cv.lines) {
        const item = db.items.find(i => i.id === l.itemId);
        lines.push({ itemId: item.id, name: item.name, price: item.price, qty: l.qty, diet: item.diet, note: '', gid: l.gid, by: l.name });
      }
    }
    for (const line of shared ? [] : Array.isArray(body.items) ? body.items.slice(0, 60) : []) {
      const item = db.items.find(i => i.id === line.id && i.restaurantId === r.id && !i.hidden);
      const qty = Math.min(50, Math.max(0, parseInt(line.qty, 10) || 0));
      if (!item || !qty) continue;
      if (item.available === false) return fail(res, 409, `${item.name} just sold out. Please remove it and try again.`);
      lines.push({ itemId: item.id, name: item.name, price: item.price, qty, diet: item.diet, note: str(line.note, 140), ...(gidOk(body.gid) ? { gid: body.gid, by: str(body.name, 40) || 'Guest' } : {}) });
    }
    if (!lines.length) return fail(res, 400, 'Your order is empty.');
    const subtotal = money(lines.reduce((s, l) => s + l.price * l.qty, 0));
    let discount = 0, couponCode = '';
    if (str(body.coupon)) {
      const v = couponCheck(r, body.coupon, subtotal);
      if (v.error) return fail(res, 409, v.error);
      discount = v.discount; couponCode = v.coupon.code; v.coupon.uses = (v.coupon.uses || 0) + 1;
    }
    const total = money(subtotal - discount);
    const lp = loyaltyOn(r) ? (normPhone(body.phone) || (guest && normPhone(guest.phone)) || '') : '';
    const auto = !!(r.service && r.service.autoAccept);
    r.orderSeq = (r.orderSeq || 100) + 1;
    const order = {
      id: id(16), restaurantId: r.id, number: r.orderSeq, tableId: table.id, tableName: table.name,
      items: lines, note: str(body.note, 300), customerName: str(body.name, 60), total, subtotal, discount, coupon: couponCode,
      status: auto ? 'preparing' : 'new', ...(auto ? { preparingAt: now(), autoAccepted: true } : {}), createdAt: now(), updatedAt: now(), readyBy: estimateReady(r, lines),
      ...(guest ? { guestId: guest.id, customerPhone: guest.phone || guest.email } : {}),
      ...(lp ? { loyaltyPhone: lp } : {}),
    };
    if (lp) customerOf(r, lp, true, body.name);
    if (guest) guest.lastAt = now();
    if (shared) {
      const people = [...new Set(lines.map(l => l.by))];
      if (!order.customerName) order.customerName = people.length > 1 ? people.join(', ').slice(0, 60) : people[0];
      cartOf(table.id).lines = [];
    }
    db.orders.push(order); save();
    emit(r.id, 'order', adminOrder(order));
    if (shared) emitTable(table.id, 'placed', { id: order.id, number: order.number, createdAt: order.createdAt, by: str(body.name, 40) || 'Someone', gid: body.gid });
    tableChanged(r, table, shared);
    return send(res, 201, publicOrder(order));
  }
  if (m === 'GET' && (mt = /^\/api\/orders\/([A-Za-z0-9]+)$/.exec(p))) {
    const o = db.orders.find(x => x.id === mt[1]);
    return o ? send(res, 200, publicOrder(o)) : fail(res, 404, 'Order not found');
  }
  if (m === 'GET' && (mt = /^\/api\/orders\/([A-Za-z0-9]+)\/stream$/.exec(p))) {
    const o = db.orders.find(x => x.id === mt[1]);
    if (!o) return fail(res, 404, 'Order not found');
    openStream(req, res, orderStreams, o.id);
    return res.write(`event: order\ndata: ${JSON.stringify(publicOrder(o))}\n\n`);
  }
  if (m === 'POST' && (mt = /^\/api\/menu\/([a-z0-9-]+)\/requests$/.exec(p))) {
    const r = db.restaurants.find(x => x.slug === mt[1]);
    const table = r && db.tables.find(t => t.restaurantId === r.id && t.token === body.table);
    if (!table) return fail(res, 400, 'Please scan the QR code on your table.');
    const type = ['waiter', 'bill', 'water'].includes(body.type) ? body.type : 'waiter';
    const recent = db.requests.find(q => q.tableId === table.id && q.type === type && !q.done && Date.now() - Date.parse(q.createdAt) < 120000);
    if (recent) return send(res, 200, { ok: true, duplicate: true });
    const q = { id: id(12), restaurantId: r.id, tableId: table.id, tableName: table.name, type, done: false, createdAt: now() };
    db.requests.push(q); save();
    emit(r.id, 'request', q);
    return send(res, 201, { ok: true });
  }

  // ===== restaurant admin =====
  if (m === 'POST' && p === '/api/signup') {
    if (!str(body.name)) return fail(res, 400, 'Please enter your restaurant name');
    const email = str(body.email, 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'Please enter a valid email');
    if (db.restaurants.some(x => x.email === email)) return fail(res, 409, 'An account with this email already exists. Please log in.');
    if (str(body.password).length < 6) return fail(res, 400, 'Password needs at least 6 characters');
    if (!/^[0-9+\s-]{8,16}$/.test(str(body.phone))) return fail(res, 400, 'Please enter a valid mobile number');
    const r = newRestaurant({ name: body.name, password: body.password, email, ownerName: body.ownerName, phone: body.phone, plan: 'trial' });
    r.phone = str(body.phone, 30);
    for (const name of ['Starters', 'Main Course', 'Desserts', 'Drinks']) db.categories.push({ id: id(), restaurantId: r.id, name, sort: db.categories.length });
    save();
    setCookie(res, 'vd_admin', sign(r.id + '|0')); trackEvent('signup'); save();
    return send(res, 201, { ok: true, slug: r.slug });
  }
  if (m === 'POST' && p === '/api/admin/login') {
    const who = str(body.slug, 120).toLowerCase();
    const r = db.restaurants.find(x => (who.includes('@') ? x.email === who : x.slug === slugify(who)));
    if (!r || !checkPassword(body.password || '', r.passwordHash)) return fail(res, 401, 'Wrong email / restaurant ID or password');
    setCookie(res, 'vd_admin', sign(r.id + '|' + (r.sessionVer || 0))); trackEvent('login'); saveSoon();
    return send(res, 200, { ok: true, slug: r.slug });
  }
  if (m === 'GET' && p === '/api/auth/config') return send(res, 200, { googleClientId: googleClientId(req) });
  if (m === 'POST' && p === '/api/admin/google') { // log in, or start a free trial, with a Google account
    let gu; try { gu = await verifyGoogle(body.credential); } catch (e) { return fail(res, e.status || 400, e.message); }
    let r = db.restaurants.find(x => x.email === gu.email);
    if (!r) {
      if (!str(body.name)) return send(res, 200, { needSignup: true, email: gu.email, ownerName: gu.name });
      if (!/^[0-9+\s-]{8,16}$/.test(str(body.phone))) return fail(res, 400, 'Please enter a valid mobile number');
      r = newRestaurant({ name: body.name, password: crypto.randomBytes(12).toString('hex'), email: gu.email, ownerName: gu.name, phone: body.phone, plan: 'trial' });
      r.phone = str(body.phone, 30); r.google = true;
      for (const name of ['Starters', 'Main Course', 'Desserts', 'Drinks']) db.categories.push({ id: id(), restaurantId: r.id, name, sort: db.categories.length });
      save();
      setCookie(res, 'vd_admin', sign(r.id + '|' + (r.sessionVer || 0)));
      trackEvent('signup_google'); save();
      return send(res, 201, { ok: true, slug: r.slug, created: true });
    }
    setCookie(res, 'vd_admin', sign(r.id + '|' + (r.sessionVer || 0))); trackEvent('login_google'); saveSoon();
    return send(res, 200, { ok: true, slug: r.slug });
  }
  if (m === 'POST' && p === '/api/admin/logout') { setCookie(res, 'vd_admin', '', 0); return send(res, 200, { ok: true }); }

  // ---- license server (used by Veyra HQ and by Windows apps running in local mode) ----
  if (m === 'POST' && p === '/api/licenses/register') { // HQ registers a new short code; only keys signed by Veyra are accepted
    const v = verifyKey(body.key), code = v.ok && normShort(v.payload.s);
    if (!v.ok || !code) return fail(res, 400, v.ok ? 'This key has no short code.' : v.error);
    db.licenseCodes = db.licenseCodes || {};
    const L = db.licenseCodes[code];
    if (L && L.id !== v.payload.id) return fail(res, 409, 'That short code is already taken.');
    if (!L) { db.licenseCodes[code] = { key: v.key, id: v.payload.id, n: v.payload.n, p: v.payload.p, exp: v.payload.exp || null, at: now(), activations: [] }; save(); }
    return send(res, 200, { ok: true, code });
  }
  if (m === 'POST' && p === '/api/licenses/claim') {
    const code = normShort(body.code), ip = clientIp(req), tk = 'lic|' + ip;
    if (tooMany(tk)) return fail(res, 429, 'Too many tries. Please wait 10 minutes.');
    if (!code) { failCount(tk); return fail(res, 400, 'That does not look like a license key. Keys look like VEYRA-XXXX-XXXX-XXXX.'); }
    try { return send(res, 200, { key: claimLocal(code, 'pc:' + str(body.rid, 80), body.name, 'windows', ip) }); }
    catch (e) { if (e.status === 404) failCount(tk); return fail(res, e.status || 400, e.message); }
  }
  // ---- Veyra HQ only: every request is signed with Veyra's private license key ----
  if (m === 'POST' && (p.startsWith('/api/licenses/') || p.startsWith('/api/hq/')) && ['/api/licenses/status', '/api/licenses/reset', '/api/licenses/revoke', '/api/licenses/unrevoke', '/api/hq/overview', '/api/hq/restaurant', '/api/hq/lead', '/api/hq/site', '/api/hq/site/save', '/api/hq/site/preview', '/api/hq/site/media'].includes(p)) {
    const ts = Number(body.ts), raw = String(body.code || '');
    const { code: _c, ts: _t, sig: _s, ...rest } = body;
    const bh = crypto.createHash('sha256').update(JSON.stringify(rest)).digest('hex');
    if (!(Math.abs(Date.now() - ts) < 10 * 60000) || !hqSigned(`${p}|${raw}|${ts}|${bh}`, body.sig)) return fail(res, 403, 'Not allowed');
    db.licenseCodes = db.licenseCodes || {};
    const code = normShort(raw) || '', L = db.licenseCodes[code];
    const codeView = (c, L) => ({ id: L.id, n: L.n, at: L.at, revoked: L.revoked || null, activations: (L.activations || []).map(a => ({ name: a.name, via: a.via, at: a.at, lastAt: a.lastAt })) });
    if (p === '/api/licenses/status') { const out = {}; for (const [c, x] of Object.entries(db.licenseCodes)) out[c] = codeView(c, x); return send(res, 200, { codes: out }); }
    if (p === '/api/licenses/reset' || p === '/api/licenses/revoke' || p === '/api/licenses/unrevoke') {
      if (!L) return fail(res, 404, 'This key is not on the server yet.');
      if (p === '/api/licenses/reset') L.activations = [];
      else {
        L.revoked = p === '/api/licenses/revoke' ? { at: now(), reason: str(body.reason, 200) } : null;
        for (const r of db.restaurants) if (r.licenseCode === code) r.suspended = !!L.revoked; // online restaurants stop (or start) taking orders straight away
      }
      save(); return send(res, 200, { ok: true });
    }
    if (p.startsWith('/api/hq/site')) {
      const stockFile = path.join(PUBLIC_DIR, 'site', 'content.json');
      const stock = fs.existsSync(stockFile) ? JSON.parse(fs.readFileSync(stockFile, 'utf8')) : { items: [], prices: {} };
      if (p === '/api/hq/site') return send(res, 200, { stock, content: db.siteContent || {}, site: baseUrl(req) });
      if (p === '/api/hq/site/preview') return send(res, 200, { html: siteContent.render(fs.readFileSync(path.join(PUBLIC_DIR, 'site', 'index.html'), 'utf8'), body.content || {}, stock).replace('<head>', `<head><base href="${baseUrl(req)}/">`) });
      if (p === '/api/hq/site/save') {
        const c = body.content || {};
        db.siteContent = { texts: c.texts || {}, images: c.images || {}, prices: c.prices || {}, banner: c.banner || {}, testimonials: (c.testimonials || []).slice(0, 30), testimonialsTitle: str(c.testimonialsTitle, 80), faqs: (c.faqs || []).slice(0, 40), logo: c.logo || '', updatedAt: now() };
        for (const k of ['lifetime', 'yearly', 'monthly']) if (Number(db.siteContent.prices[k]) > 0) PLANS[k] = Number(db.siteContent.prices[k]); // admin "Buy" buttons use the same prices
        siteCache = null; save(); return send(res, 200, { ok: true });
      }
      if (p === '/api/hq/site/media') { // logo or picture for the landing page
        const mt2 = /^data:image\/(png|jpe?g|webp|svg\+xml);base64,(.+)$/.exec(String(body.data || ''));
        if (!mt2) return fail(res, 400, 'Upload a PNG, JPG, WebP or SVG image.');
        const buf = Buffer.from(mt2[2], 'base64'); if (buf.length > 5 * 1024 * 1024) return fail(res, 400, 'Image is too big (5 MB max).');
        const dir = path.join(DATA_DIR, 'site-media'); fs.mkdirSync(dir, { recursive: true });
        const name = id(12) + '.' + ({ 'jpeg': 'jpg', 'svg+xml': 'svg' }[mt2[1]] || mt2[1]);
        fs.writeFileSync(path.join(dir, name), buf);
        return send(res, 200, { url: '/site-media/' + name });
      }
    }
    if (p === '/api/hq/lead') {
      const l = (db.leads || []).find(x => x.id === raw); if (!l) return fail(res, 404, 'Not found');
      if (['new', 'contacted', 'planned', 'won', 'closed'].includes(body.status)) l.status = body.status;
      if ('note' in body) l.note = str(body.note, 1000);
      l.updatedAt = now(); save(); return send(res, 200, { ok: true });
    }
    if (p === '/api/hq/restaurant') {
      const r = db.restaurants.find(x => x.id === raw); if (!r) return fail(res, 404, 'Restaurant not found');
      if (Number(body.extendTrialDays) > 0) { const base = Math.max(Date.now(), Date.parse(r.trialEnds || 0) || 0); if (r.plan !== 'lifetime' && !TERM_PLANS.includes(r.plan)) { r.plan = 'trial'; r.trialEnds = new Date(base + Number(body.extendTrialDays) * DAY).toISOString(); } }
      if ('suspended' in body) r.suspended = !!body.suspended;
      if ('note' in body) r.hqNote = str(body.note, 500);
      save(); return send(res, 200, { ok: true });
    }
    // overview: restaurants on the online server, activations and installer downloads
    const lastOrder = {}, orders = {};
    for (const o of db.orders) { orders[o.restaurantId] = (orders[o.restaurantId] || 0) + 1; if (!lastOrder[o.restaurantId] || o.createdAt > lastOrder[o.restaurantId]) lastOrder[o.restaurantId] = o.createdAt; }
    const restaurants = db.restaurants.map(r => ({ id: r.id, slug: r.slug, name: r.name, ownerName: r.ownerName || '', phone: r.ownerPhone || r.phone || '', email: r.email || '', createdAt: r.createdAt, access: access(r), suspended: !!r.suspended, licenseCode: r.licenseCode || null, licensedTo: r.licensedTo || '', updatesUntil: r.updatesUntil || null, google: !!r.google, items: db.items.filter(i => i.restaurantId === r.id).length, tables: db.tables.filter(t => t.restaurantId === r.id).length, orders: orders[r.id] || 0, lastOrderAt: lastOrder[r.id] || null, hqNote: r.hqNote || '' }));
    const codes = {}; for (const [c, x] of Object.entries(db.licenseCodes)) codes[c] = codeView(c, x);
    const A = db.analytics || {}, analytics = {}; for (const k of Object.keys(A).sort().slice(-120)) analytics[k] = A[k];
    return send(res, 200, { at: now(), restaurants, codes, downloads: db.config.downloads || {}, analytics, leads: (db.leads || []).slice(-1000) });
  }

  if (p.startsWith('/api/admin/')) {
    const r = adminOf(req);
    if (!r) return fail(res, 401, 'Please log in');
    const mine = list => list.filter(x => x.restaurantId === r.id);

    if (m === 'GET' && p === '/api/admin/me') {
      return send(res, 200, { restaurant: adminRestaurant(r), baseUrl: baseUrl(req), lan: lanAddresses(), port: PORT, publicUrlSet: !!process.env.PUBLIC_URL, plans: PLANS, buyUrl: BUY_URL });
    }
    if (m === 'POST' && p === '/api/admin/activate') {
      const code = normShort(body.key);
      let raw = body.key;
      if (code) { try { raw = await claimShort(code, r, req); } catch (e) { return fail(res, e.status || 400, e.message); } }
      const v = verifyKey(raw);
      if (!v.ok) return fail(res, 400, v.error);
      db.config.usedLicenses = db.config.usedLicenses || {};
      const owner = db.config.usedLicenses[v.payload.id];
      if (owner && owner !== r.id) return fail(res, 409, 'This license key is already used by another restaurant.');
      db.config.usedLicenses[v.payload.id] = r.id;
      r.plan = TERM_PLANS.includes(v.payload.p) ? v.payload.p : 'lifetime';
      r.paidUntil = v.payload.exp ? new Date(v.payload.exp + 'T23:59:59Z').toISOString() : null;
      r.licenseKey = v.key; r.licenseCode = code || v.payload.s || null; r.licensedTo = v.payload.n; r.activatedAt = now();
      r.updatesUntil = updatesUntilOf(v.payload);
      save();
      return send(res, 200, { ok: true, restaurant: adminRestaurant(r) });
    }
    if (m === 'GET' && p === '/api/admin/stream') return openStream(req, res, streams, r.id);

    // orders
    // guest accounts
    if (m === 'GET' && p === '/api/admin/guests') {
      const stats = {};
      for (const o of db.orders) if (o.restaurantId === r.id && o.guestId && o.status !== 'cancelled') { const x = stats[o.guestId] || (stats[o.guestId] = { orders: 0, spent: 0 }); x.orders++; x.spent += o.total; }
      return send(res, 200, db.guests.filter(g => g.restaurantId === r.id).map(g => ({ id: g.id, name: g.name, phone: g.phone, email: g.email, createdAt: g.createdAt, lastAt: g.lastAt, orders: (stats[g.id] || {}).orders || 0, spent: money((stats[g.id] || {}).spent || 0) })).sort((a, b) => b.lastAt.localeCompare(a.lastAt)));
    }
    if (m === 'POST' && (mt = /^\/api\/admin\/guests\/([A-Za-z0-9]+)\/password$/.exec(p))) {
      const g = db.guests.find(x => x.id === mt[1] && x.restaurantId === r.id);
      if (!g) return fail(res, 404, 'Guest not found');
      if (String(body.password || '').length < 4) return fail(res, 400, 'Password needs at least 4 characters.');
      g.passwordHash = hashPassword(body.password); g.ver = (g.ver || 0) + 1; save();
      return send(res, 200, { ok: true });
    }
    if (m === 'GET' && p === '/api/admin/orders') {
      const scope = url.searchParams.get('scope') || 'active';
      let list = mine(db.orders);
      if (scope === 'active') list = list.filter(o => ['new', 'preparing', 'ready'].includes(o.status));
      else {
        const day = url.searchParams.get('date'); // YYYY-MM-DD (local date of browser, passed with tz offset)
        const tz = Number(url.searchParams.get('tz')) || 0; // minutes, from getTimezoneOffset()
        if (day) list = list.filter(o => new Date(Date.parse(o.createdAt) - tz * 60000).toISOString().slice(0, 10) === day);
      }
      return send(res, 200, list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500).map(adminOrder));
    }
    if (m === 'GET' && p === '/api/admin/stats') {
      const tz = Number(url.searchParams.get('tz')) || 0;
      const day = new Date(Date.now() - tz * 60000).toISOString().slice(0, 10);
      const today = mine(db.orders).filter(o => o.status !== 'cancelled' && new Date(Date.parse(o.createdAt) - tz * 60000).toISOString().slice(0, 10) === day);
      const active = mine(db.orders).filter(o => ['new', 'preparing', 'ready'].includes(o.status));
      return send(res, 200, { ordersToday: today.length, salesToday: money(today.reduce((s, o) => s + o.total, 0)), activeTables: new Set(active.map(o => o.tableId)).size, activeOrders: active.length });
    }
    if (m === 'GET' && p === '/api/admin/report') {
      // Sales and orders for any day or date range (dates are the restaurant's local dates).
      const tz = Number(url.searchParams.get('tz')) || 0;
      const isDay = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
      const todayKey = new Date(Date.now() - tz * 60000).toISOString().slice(0, 10);
      let from = isDay(url.searchParams.get('from')) ? url.searchParams.get('from') : todayKey;
      let to = isDay(url.searchParams.get('to')) ? url.searchParams.get('to') : from;
      if (to < from) [from, to] = [to, from];
      const dayOf = o => new Date(Date.parse(o.createdAt) - tz * 60000).toISOString().slice(0, 10);
      const all = mine(db.orders).filter(o => { const d = dayOf(o); return d >= from && d <= to; });
      const done = all.filter(o => o.status !== 'cancelled');
      const sales = money(done.reduce((s, o) => s + o.total, 0));
      const days = [];
      for (let t = Date.parse(from + 'T00:00:00Z'), end = Date.parse(to + 'T00:00:00Z'); t <= end && days.length < 400; t += 86400000) {
        const k = new Date(t).toISOString().slice(0, 10);
        const list = done.filter(o => dayOf(o) === k);
        days.push({ date: k, orders: list.length, sales: money(list.reduce((s, o) => s + o.total, 0)) });
      }
      const dishes = {}, tables = {}, hours = Array(24).fill(0);
      for (const o of done) {
        const seen = new Set();
        for (const l of o.items) {
          const it = db.items.find(i => i.id === l.itemId), cat = it && db.categories.find(k => k.id === it.categoryId);
          const d = dishes[l.name] || (dishes[l.name] = { name: l.name, itemId: l.itemId || null, category: cat ? cat.name : 'Other', diet: l.diet || (it && it.diet) || '', qty: 0, sales: 0, orders: 0 });
          d.qty += l.qty; d.sales = money(d.sales + l.qty * l.price); if (!seen.has(l.name)) { seen.add(l.name); d.orders++; }
        }
        const t = tables[o.tableName] || (tables[o.tableName] = { name: o.tableName, orders: 0, sales: 0 }); t.orders++; t.sales = money(t.sales + o.total);
        hours[new Date(Date.parse(o.createdAt) - tz * 60000).getUTCHours()]++;
      }
      return send(res, 200, {
        from, to, discounts: money(done.reduce((s, o) => s + (o.discount || 0), 0)), orders: done.length, sales, average: done.length ? Math.round(sales / done.length) : 0,
        cancelled: all.length - done.length, items: done.reduce((s, o) => s + o.items.reduce((a, l) => a + l.qty, 0), 0),
        days, hours,
        dishes: Object.values(dishes).sort((a, b) => b.qty - a.qty || b.sales - a.sales),
        // What sells: share of item sales and items sold per category, and menu dishes nobody ordered in this period
        categories: (() => { const C = {}; for (const d of Object.values(dishes)) { const k = C[d.category] || (C[d.category] = { name: d.category, qty: 0, sales: 0, dishes: 0 }); k.qty += d.qty; k.sales = money(k.sales + d.sales); k.dishes++; } return Object.values(C).sort((a, b) => b.sales - a.sales); })(),
        itemSales: money(Object.values(dishes).reduce((t, d) => t + d.sales, 0)),
        notSold: db.items.filter(i => i.restaurantId === r.id && !i.hidden && !Object.values(dishes).some(d => d.itemId === i.id || d.name === i.name)).map(i => { const cat = db.categories.find(k => k.id === i.categoryId); return { name: i.name, category: cat ? cat.name : 'Other', price: i.price }; }),
        tables: Object.values(tables).sort((a, b) => b.sales - a.sales),
        list: all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 1000).map(publicOrder),
      });
    }
    if (m === 'PATCH' && (mt = /^\/api\/admin\/orders\/([A-Za-z0-9]+)$/.exec(p))) {
      const o = db.orders.find(x => x.id === mt[1] && x.restaurantId === r.id);
      if (!o) return fail(res, 404, 'Order not found');
      if (!['new', 'preparing', 'ready', 'served', 'cancelled'].includes(body.status)) return fail(res, 400, 'Unknown status');
      if (body.status === 'ready' && !o.readyAt) o.readyAt = now();
      if (body.status === 'preparing' && !o.preparingAt) o.preparingAt = now();
      if (body.status === 'served' && !o.readyAt) o.readyAt = now();
      o.status = body.status; o.updatedAt = now();
      if (o.status === 'served') earnFor(r, o);
      save();
      { const t = db.tables.find(x => x.id === o.tableId); if (t) tableChanged(r, t, false); }
      emit(r.id, 'order', adminOrder(o)); emitOrder(o);
      return send(res, 200, publicOrder(o));
    }
    // service requests
    if (m === 'GET' && p === '/api/admin/requests') return send(res, 200, mine(db.requests).filter(q => !q.done).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    if (p === '/api/admin/coupons' || /^\/api\/admin\/coupons\/[A-Za-z0-9]+$/.test(p)) {
      const cid = p.split('/')[4];
      const view = c => ({ ...c, label: couponLabel(c, r) });
      if (m === 'GET' && !cid) return send(res, 200, db.coupons.filter(c => c.restaurantId === r.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(view));
      const fill = (c, b) => {
        if (b.code !== undefined) {
          const code = str(b.code, 20).toUpperCase().replace(/\s/g, '');
          if (!/^[A-Z0-9_-]{3,20}$/.test(code)) throw new Error('Coupon code: 3 to 20 letters or numbers, like WELCOME10');
          if (db.coupons.some(x => x.restaurantId === r.id && x.code === code && x.id !== c.id)) throw new Error('You already have a coupon with this code');
          c.code = code;
        }
        if (b.type !== undefined) c.type = b.type === 'flat' ? 'flat' : 'percent';
        if (b.value !== undefined) { c.value = Math.round(Number(b.value) || 0); if (c.value <= 0 || (c.type === 'percent' && c.value > 100)) throw new Error(c.type === 'percent' ? 'Discount must be between 1 and 100%' : 'Discount amount must be more than 0'); }
        for (const k of ['minOrder', 'maxOff', 'maxUses']) if (b[k] !== undefined) c[k] = Math.max(0, Math.round(Number(b[k]) || 0)) || null;
        if (b.expires !== undefined) c.expires = /^\d{4}-\d{2}-\d{2}$/.test(b.expires || '') ? b.expires : null;
        for (const k of ['active', 'showOnMenu']) if (b[k] !== undefined) c[k] = !!b[k];
        if (b.note !== undefined) c.note = str(b.note, 80);
      };
      try {
        if (m === 'POST' && !cid) {
          const c = { id: id(), restaurantId: r.id, code: '', type: 'percent', value: 10, minOrder: null, maxOff: null, maxUses: null, expires: null, active: true, showOnMenu: true, note: '', uses: 0, createdAt: now() };
          fill(c, { type: 'percent', ...body }); if (!c.code) throw new Error('Please type a coupon code');
          db.coupons.push(c); save(); return send(res, 201, view(c));
        }
        const c = db.coupons.find(x => x.id === cid && x.restaurantId === r.id);
        if (!c) return fail(res, 404, 'Coupon not found');
        if (m === 'PUT') { fill(c, body); save(); return send(res, 200, view(c)); }
        if (m === 'DELETE') { db.coupons = db.coupons.filter(x => x !== c); save(); return send(res, 200, { ok: true }); }
      } catch (e) { return fail(res, 400, e.message); }
    }
    // UPI QR for the printed bill
    if (m === 'GET' && p === '/api/admin/phone-qr') { // QR the owner scans to open this admin on their phone
      let b = baseUrl(req); if (/\/\/(localhost|127\.0\.0\.1)(:|$)/.test(b) && !process.env.PUBLIC_URL) { const ip = lanAddresses()[0]; if (ip) b = `http://${ip}:${PORT}`; }
      const link = `${b}/admin/${r.slug}`;
      return send(res, 200, { url: link, svg: await QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1f1612', light: '#ffffff' } }) });
    }
    if (m === 'GET' && p === '/api/admin/upi-qr') {
      if (!r.upiId) return fail(res, 404, 'No UPI ID');
      const amount = Math.max(1, Math.min(500000, Number(url.searchParams.get('am')) || 0));
      const svg = await QRCode.toString(upiLink(r, amount, str(url.searchParams.get('n'), 40)), { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' }); return res.end(svg);
    }
    // the counter can see a table's bill and take payments person by person
    if ((mt = /^\/api\/admin\/tables\/([A-Za-z0-9]+)\/(bill|payment|loyalty|redeem)$/.exec(p))) {
      const table = db.tables.find(t => t.id === mt[1] && t.restaurantId === r.id);
      if (!table) return fail(res, 404, 'Table not found');
      if (m === 'GET' && mt[2] === 'bill') return send(res, 200, { table: { id: table.id, name: table.name }, ...billView(r, table) });
      if (m === 'POST' && mt[2] === 'loyalty') { // attach a customer's phone so this table's bill earns points
        if (!loyaltyOn(r)) return fail(res, 409, 'Turn on loyalty points in Settings first');
        const ph = normPhone(body.phone); if (!ph) return fail(res, 400, 'Enter a 10-digit mobile number');
        customerOf(r, ph, true, body.name);
        for (const o of billView(r, table).orders) { const oo = db.orders.find(x => x.id === o.id); if (oo && !oo.loyaltyPhone) oo.loyaltyPhone = ph; }
        save(); return send(res, 200, { table: { id: table.id, name: table.name }, ...billView(r, table), customer: customerView(customerOf(r, ph)) });
      }
      if (m === 'POST' && mt[2] === 'redeem') { // pay part of the bill with points
        if (!loyaltyOn(r)) return fail(res, 409, 'Loyalty points are off');
        const ph = normPhone(body.phone), c = ph && customerOf(r, ph); if (!c) return fail(res, 404, 'No points for this number yet');
        const L = r.loyalty, B = billView(r, table), left = Math.max(0, Math.round(B.total - B.paid.reduce((a, x) => a + x.amount, 0)));
        let pts = Math.floor(Number(body.points) || 0);
        if (c.points < L.min) return fail(res, 409, `Needs at least ${L.min} points to use them. This customer has ${c.points}.`);
        pts = Math.min(pts, c.points, Math.floor(left / L.value)); if (pts <= 0) return fail(res, 400, 'Nothing left to pay with points');
        const amount = Math.round(pts * L.value);
        c.points -= pts; pointsLog(c, 'redeem', -pts, `${table.name} bill, ₹${amount} off`);
        db.requests.push({ id: id(12), restaurantId: r.id, tableId: table.id, tableName: table.name, type: 'paid', gid: 'points', name: (c.name || 'Customer') + ' · ' + pts + ' pts', amount, method: 'points', counter: true, done: true, createdAt: now() });
        save(); tableChanged(r, table, false);
        return send(res, 201, { table: { id: table.id, name: table.name }, ...billView(r, table), customer: customerView(c) });
      }
      if (m === 'POST' && mt[2] === 'payment') {
        const amount = Math.round(Number(body.amount) || 0);
        if (amount <= 0) return fail(res, 400, 'Enter the amount paid');
        const method = ['cash', 'upi', 'card'].includes(body.method) ? body.method : 'cash';
        const q = { id: id(12), restaurantId: r.id, tableId: table.id, tableName: table.name, type: 'paid', gid: str(body.gid, 40) || 'counter', name: str(body.name, 40) || 'Guest', amount, method, counter: true, done: true, createdAt: now() };
        db.requests.push(q); save(); tableChanged(r, table, false);
        return send(res, 201, { table: { id: table.id, name: table.name }, ...billView(r, table) });
      }
    }
    if (m === 'POST' && (mt = /^\/api\/admin\/tables\/([A-Za-z0-9]+)\/settle$/.exec(p))) {
      const table = db.tables.find(t => t.id === mt[1] && t.restaurantId === r.id);
      if (!table) return fail(res, 404, 'Table not found');
      for (const o of db.orders) if (o.tableId === table.id && !o.settled) { o.settled = true; earnFor(r, o); }
      for (const q of db.requests) if (q.tableId === table.id && (q.type === 'bill' || q.type === 'paid') && !q.done) { q.done = true; q.settled = true; emit(r.id, 'request-done', { id: q.id }); }
      for (const q of db.requests) if (q.tableId === table.id && q.type === 'paid') q.settled = true;
      tableShares.delete(table.id); save();
      emitTable(table.id, 'settled', { at: now() }); tableChanged(r, table, false);
      return send(res, 200, { ok: true });
    }
    if (m === 'PATCH' && (mt = /^\/api\/admin\/requests\/([A-Za-z0-9]+)$/.exec(p))) {
      const q = db.requests.find(x => x.id === mt[1] && x.restaurantId === r.id);
      if (!q) return fail(res, 404, 'Not found');
      q.done = true; save(); emit(r.id, 'request-done', { id: q.id });
      return send(res, 200, { ok: true });
    }

    // menu: categories
    if (m === 'GET' && p === '/api/admin/menu') {
      return send(res, 200, {
        categories: mine(db.categories).sort((a, b) => a.sort - b.sort),
        items: mine(db.items).sort((a, b) => a.sort - b.sort),
      });
    }
    if (m === 'POST' && p === '/api/admin/categories') {
      const name = str(body.name, 60); if (!name) return fail(res, 400, 'Category name is required');
      const c = { id: id(), restaurantId: r.id, name, sort: Math.max(0, ...mine(db.categories).map(x => x.sort)) + 1 };
      db.categories.push(c); save(); return send(res, 201, c);
    }
    if ((mt = /^\/api\/admin\/categories\/([A-Za-z0-9]+)$/.exec(p))) {
      const c = db.categories.find(x => x.id === mt[1] && x.restaurantId === r.id);
      if (!c) return fail(res, 404, 'Category not found');
      if (m === 'PUT') { if (body.name != null) c.name = str(body.name, 60) || c.name; if (body.sort != null) c.sort = Number(body.sort) || 0; save(); return send(res, 200, c); }
      if (m === 'DELETE') {
        if (mine(db.items).some(i => i.categoryId === c.id)) return fail(res, 409, 'Move or delete the dishes in this category first');
        db.categories = db.categories.filter(x => x !== c); save(); return send(res, 200, { ok: true });
      }
    }
    if (m === 'POST' && p === '/api/admin/categories/reorder') {
      (body.ids || []).forEach((cid, i) => { const c = db.categories.find(x => x.id === cid && x.restaurantId === r.id); if (c) c.sort = i; });
      save(); return send(res, 200, { ok: true });
    }
    // menu: items
    const itemFields = (it, b) => {
      if (b.name != null) it.name = str(b.name, 80);
      if (b.description != null) it.description = str(b.description, 300);
      if (b.price != null) it.price = money(b.price);
      if (b.categoryId != null && mine(db.categories).some(c => c.id === b.categoryId)) it.categoryId = b.categoryId;
      if (b.diet != null) it.diet = ['veg', 'nonveg', 'egg', 'none'].includes(b.diet) ? b.diet : 'none';
      if (b.available != null) it.available = !!b.available;
      if (b.bestseller != null) it.bestseller = !!b.bestseller;
      if (b.spicy != null) it.spicy = !!b.spicy;
      if (b.photo !== undefined) it.photo = b.photo && String(b.photo).startsWith('data:') ? saveImage(b.photo) : str(b.photo, 300);
    };
    if (m === 'POST' && p === '/api/admin/items') {
      if (!str(body.name)) return fail(res, 400, 'Dish name is required');
      if (!mine(db.categories).some(c => c.id === body.categoryId)) return fail(res, 400, 'Choose a category');
      const it = { id: id(), restaurantId: r.id, name: '', description: '', price: 0, categoryId: body.categoryId, diet: 'veg', available: true, bestseller: false, spicy: false, photo: '', sort: Math.max(0, ...mine(db.items).map(x => x.sort)) + 1 };
      try { itemFields(it, body); } catch (e) { return fail(res, 400, e.message); }
      db.items.push(it); save(); return send(res, 201, it);
    }
    if ((mt = /^\/api\/admin\/items\/([A-Za-z0-9]+)$/.exec(p))) {
      const it = db.items.find(x => x.id === mt[1] && x.restaurantId === r.id);
      if (!it) return fail(res, 404, 'Dish not found');
      if (m === 'PUT') { try { itemFields(it, body); } catch (e) { return fail(res, 400, e.message); } save(); return send(res, 200, it); }
      if (m === 'DELETE') { db.items = db.items.filter(x => x !== it); save(); return send(res, 200, { ok: true }); }
    }

    // tables
    if (m === 'GET' && p === '/api/admin/tables') {
      const list = mine(db.tables).sort((a, b) => a.sort - b.sort);
      const out = await Promise.all(list.map(async t => ({ ...t, url: tableUrl(req, r, t), qr: await QRCode.toString(tableUrl(req, r, t), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }) })));
      return send(res, 200, out);
    }
    if (m === 'POST' && p === '/api/admin/tables') {
      const existing = mine(db.tables);
      const created = [];
      const names = Array.isArray(body.names) ? body.names : [body.name];
      let sort = Math.max(0, ...existing.map(x => x.sort));
      for (const raw of names.slice(0, 100)) {
        const name = str(raw, 40); if (!name) continue;
        if (existing.concat(created).some(t => t.name.toLowerCase() === name.toLowerCase())) continue;
        const t = { id: id(), restaurantId: r.id, name, token: id(10), active: true, sort: ++sort, createdAt: now() };
        db.tables.push(t); created.push(t);
      }
      if (!created.length) return fail(res, 400, 'Those table names already exist');
      save(); return send(res, 201, created);
    }
    if ((mt = /^\/api\/admin\/tables\/([A-Za-z0-9]+)$/.exec(p))) {
      const t = db.tables.find(x => x.id === mt[1] && x.restaurantId === r.id);
      if (!t) return fail(res, 404, 'Table not found');
      if (m === 'PUT') {
        if (body.name != null) { const n = str(body.name, 40); if (n && !mine(db.tables).some(x => x !== t && x.name.toLowerCase() === n.toLowerCase())) t.name = n; }
        if (body.active != null) t.active = !!body.active;
        if (body.newCode) t.token = id(10);
        save(); return send(res, 200, t);
      }
      if (m === 'DELETE') { db.tables = db.tables.filter(x => x !== t); save(); return send(res, 200, { ok: true }); }
    }
    if (m === 'GET' && (mt = /^\/api\/admin\/tables\/([A-Za-z0-9]+)\/qr\.png$/.exec(p))) {
      const t = db.tables.find(x => x.id === mt[1] && x.restaurantId === r.id);
      if (!t) return fail(res, 404, 'Table not found');
      const buf = await QRCode.toBuffer(tableUrl(req, r, t), { width: 1024, margin: 2, errorCorrectionLevel: 'M' });
      return send(res, 200, buf, { 'Content-Type': 'image/png', 'Content-Disposition': `attachment; filename="${slugify(r.name)}-${slugify(t.name)}-qr.png"` });
    }

    // branding & settings
    if (m === 'GET' && p === '/api/admin/customers') return send(res, 200, (db.customers || []).filter(c => c.restaurantId === r.id).sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || '')).map(customerView));
    if (m === 'GET' && p === '/api/admin/customers/lookup') { const ph = normPhone(url.searchParams.get('phone')); if (!ph) return fail(res, 400, 'Enter a 10-digit mobile number'); const c = customerOf(r, ph); return send(res, 200, c ? customerView(c) : { phone: ph, name: '', points: 0, spent: 0, visits: 0, history: [], isNew: true }); }
    if (m === 'GET' && p === '/api/admin/games') {
      const wk = weekKey(), prev = weekKey(Date.now() - 7 * DAY), mine = (db.scores || []).filter(x => x.restaurantId === r.id && !x.hidden), out = {};
      const view = x => ({ id: x.id, name: x.name, phone: x.phone || '', score: x.score, at: x.at, rewarded: x.rewarded || null });
      for (const g of Object.keys(GAME_RULES)) { const l = mine.filter(x => x.game === g); out[g] = { name: GAME_RULES[g].name, week: topScores(l.filter(x => x.week === wk)).map(view), last: topScores(l.filter(x => x.week === prev), 3).map(view), plays: l.filter(x => x.week === wk).length }; }
      return send(res, 200, { cfg: Object.assign({}, GAMES_DEFAULT, r.games || {}), loyalty: loyaltyOn(r), games: out });
    }
    if (m === 'POST' && p === '/api/admin/games/reward') {
      const x = (db.scores || []).find(y => y.id === body.id && y.restaurantId === r.id); if (!x) return fail(res, 404, 'Score not found');
      if (x.rewarded) return fail(res, 400, 'Already rewarded');
      const pts = Math.round(Number(body.points) || 0);
      if (pts > 0) { if (!loyaltyOn(r)) return fail(res, 400, 'Turn on loyalty points first'); if (!x.phone) return fail(res, 400, 'This player did not give a mobile number. Give the reward at the counter.'); const c = customerOf(r, x.phone, true, x.name); c.points += pts; pointsLog(c, 'adjust', pts, `Game winner, ${GAME_RULES[x.game].name}`); }
      x.rewarded = { at: now(), points: pts > 0 ? pts : 0 }; save(); return send(res, 200, { ok: true });
    }
    if (m === 'POST' && p === '/api/admin/games/hide') { const x = (db.scores || []).find(y => y.id === body.id && y.restaurantId === r.id); if (!x) return fail(res, 404, 'Score not found'); x.hidden = true; save(); return send(res, 200, { ok: true }); }
    if (m === 'POST' && p === '/api/admin/customers/adjust') {
      const ph = normPhone(body.phone); if (!ph) return fail(res, 400, 'Enter a 10-digit mobile number');
      const c = customerOf(r, ph, true, body.name), d = Math.round(Number(body.points) || 0);
      if (body.name) c.name = str(body.name, 60);
      if (d) { if (c.points + d < 0) return fail(res, 400, `This customer only has ${c.points} points`); c.points += d; pointsLog(c, 'adjust', d, str(body.note, 80) || 'Changed by the restaurant'); }
      save(); return send(res, 200, customerView(c));
    }
    if (m === 'POST' && p === '/api/admin/orders') { // order taken at the counter (also used to sync orders made while offline)
      const cid = str(body.clientId, 40);
      if (cid) { const dup = db.orders.find(o => o.restaurantId === r.id && o.clientId === cid); if (dup) return send(res, 200, adminOrder(dup)); }
      const table = db.tables.find(t => t.id === body.tableId && t.restaurantId === r.id);
      const lines = [];
      for (const line of Array.isArray(body.items) ? body.items.slice(0, 80) : []) {
        const item = db.items.find(i => i.id === line.id && i.restaurantId === r.id);
        const qty = Math.min(99, Math.max(0, parseInt(line.qty, 10) || 0));
        if (!item || !qty) continue;
        lines.push({ itemId: item.id, name: item.name, price: line.price != null && body.offline ? money(Number(line.price) || item.price) : item.price, qty, diet: item.diet, note: str(line.note, 140) });
      }
      if (!lines.length) return fail(res, 400, 'Add at least one dish');
      const total = money(lines.reduce((a, l) => a + l.price * l.qty, 0));
      let at = Date.parse(body.createdAt); if (!body.offline || !(at > Date.now() - 7 * DAY && at <= Date.now() + 60000)) at = Date.now();
      const st = ['new', 'preparing', 'ready', 'served', 'cancelled'].includes(body.status) ? body.status : 'preparing';
      const lp = loyaltyOn(r) ? normPhone(body.phone) : '';
      r.orderSeq = (r.orderSeq || 100) + 1;
      const order = { id: id(16), restaurantId: r.id, number: r.orderSeq, tableId: table ? table.id : null, tableName: table ? table.name : (str(body.label, 40) || 'Counter'),
        items: lines, note: str(body.note, 300), customerName: str(body.name, 60), total, subtotal: total, discount: 0, coupon: '', status: st, source: 'counter',
        createdAt: new Date(at).toISOString(), updatedAt: now(), readyBy: estimateReady(r, lines), ...(st !== 'new' ? { preparingAt: now() } : {}),
        ...(cid ? { clientId: cid } : {}), ...(body.offline ? { offline: true } : {}), ...(lp ? { loyaltyPhone: lp } : {}) };
      if (lp) customerOf(r, lp, true, body.name);
      db.orders.push(order); if (st === 'served') earnFor(r, order); save();
      emit(r.id, 'order', adminOrder(order)); if (table) tableChanged(r, table, false);
      return send(res, 201, adminOrder(order));
    }
    if (m === 'PUT' && p === '/api/admin/settings') {
      try {
        for (const k of ['name', 'tagline', 'phone', 'address', 'footerNote']) if (body[k] != null) r[k] = str(body[k], k === 'address' ? 200 : 120);
        if (!r.name) r.name = 'My Restaurant';
        if (body.currency != null) r.currency = str(body.currency, 4) || '₹';
        if (body.brandColor && /^#[0-9a-fA-F]{6}$/.test(body.brandColor)) r.brandColor = body.brandColor;
        if (body.acceptingOrders != null) r.acceptingOrders = !!body.acceptingOrders;
        if (body.guestLogin != null) r.guestLogin = !!body.guestLogin;
        if (body.logo !== undefined) r.logo = body.logo && body.logo.startsWith('data:') ? saveImage(body.logo) : str(body.logo, 300);
        if (body.cover !== undefined) r.cover = body.cover && body.cover.startsWith('data:') ? saveImage(body.cover) : str(body.cover, 300);
        if (body.upiId !== undefined) {
          const u = str(body.upiId, 60).replace(/\s/g, '');
          if (u && !/^[A-Za-z0-9._-]{2,}@[A-Za-z0-9]{2,}$/.test(u)) throw new Error('That UPI ID does not look right. It should look like name@okaxis');
          r.upiId = u;
        }
        if (body.upiName !== undefined) r.upiName = str(body.upiName, 60);
        if (body.bill && typeof body.bill === 'object') {
          const b = Object.assign({}, BILL_DEFAULT, r.bill || {});
          if (['58', '80'].includes(String(body.bill.width))) b.width = String(body.bill.width);
          for (const k of ['gstin', 'fssai']) if (body.bill[k] != null) b[k] = str(body.bill[k], 30).toUpperCase();
          if (body.bill.footer != null) b.footer = str(body.bill.footer, 120);
          for (const k of ['autoKot', 'showUpi']) if (body.bill[k] != null) b[k] = !!body.bill[k];
          r.bill = b;
        }
        if (body.wifi && typeof body.wifi === 'object') {
          const W = Object.assign({ on: false, ssid: '', pass: '' }, r.wifi || {});
          if (body.wifi.ssid != null) W.ssid = str(body.wifi.ssid, 32); if (body.wifi.pass != null) W.pass = String(body.wifi.pass).slice(0, 63);
          if (body.wifi.on != null) W.on = !!body.wifi.on; if (W.on && !W.ssid) throw new Error('Enter the WiFi name');
          r.wifi = W;
        }
        if (body.service && typeof body.service === 'object') { r.service = Object.assign({ autoAccept: false, payFirst: false }, r.service || {}); for (const k of ['autoAccept', 'payFirst']) if (body.service[k] != null) r.service[k] = !!body.service[k]; }
        if (body.loyalty && typeof body.loyalty === 'object') {
          const L = Object.assign({}, LOYALTY_DEFAULT, r.loyalty || {}), n = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) * 100) / 100 || 0));
          if (body.loyalty.on != null) L.on = !!body.loyalty.on;
          if (body.loyalty.spend != null) { L.spend = n(body.loyalty.spend, 1, 100000); if (!L.spend) throw new Error('Enter how many rupees earn 1 point'); }
          if (body.loyalty.value != null) L.value = n(body.loyalty.value, 0.01, 10000);
          if (body.loyalty.min != null) L.min = Math.round(n(body.loyalty.min, 0, 1000000));
          r.loyalty = L;
        }
        if (body.games && typeof body.games === 'object') {
          const Gm = Object.assign({}, GAMES_DEFAULT, r.games || {});
          if (body.games.on != null) Gm.on = !!body.games.on;
          if (body.games.reward != null) Gm.reward = str(body.games.reward, 80);
          if (body.games.points != null) Gm.points = Math.min(100000, Math.max(0, Math.round(Number(body.games.points) || 0)));
          r.games = Gm;
        }
        if (body.socials) { r.socials = {}; for (const k of SOCIAL_KEYS) if (str(body.socials[k], 300)) r.socials[k] = str(body.socials[k], 300); }
      } catch (e) { return fail(res, 400, e.message); }
      save(); emit(r.id, 'settings', adminRestaurant(r));
      return send(res, 200, adminRestaurant(r));
    }
    if (m === 'POST' && p === '/api/admin/password') {
      if (!checkPassword(body.current || '', r.passwordHash)) return fail(res, 400, 'Current password is wrong');
      if (str(body.next).length < 6) return fail(res, 400, 'New password needs at least 6 characters');
      r.passwordHash = hashPassword(body.next); r.sessionVer = (r.sessionVer || 0) + 1; save();
      setCookie(res, 'vd_admin', sign(r.id + '|' + r.sessionVer));
      return send(res, 200, { ok: true });
    }
    return fail(res, 404, 'Not found');
  }

  // ===== platform (Veyra) =====
  if (m === 'POST' && p === '/api/platform/login') {
    if (!checkPassword(body.password || '', db.config.platformHash)) return fail(res, 401, 'Wrong password');
    setCookie(res, 'vd_platform', sign('platform|' + (db.config.platformVer || 0)));
    return send(res, 200, { ok: true });
  }
  if (p.startsWith('/api/platform/')) {
    if (!isPlatform(req)) return fail(res, 401, 'Please log in');
    if (m === 'GET' && p === '/api/platform/restaurants') {
      return send(res, 200, db.restaurants.map(r => ({
        ...publicRestaurant(r), createdAt: r.createdAt, email: r.email || '', ownerName: r.ownerName || '', ownerPhone: r.ownerPhone || '', access: access(r),
        tables: db.tables.filter(t => t.restaurantId === r.id).length,
        items: db.items.filter(i => i.restaurantId === r.id).length,
        orders: db.orders.filter(o => o.restaurantId === r.id).length,
      })));
    }
    if (m === 'POST' && p === '/api/platform/restaurants') {
      if (!str(body.name)) return fail(res, 400, 'Restaurant name is required');
      if (str(body.password).length < 6) return fail(res, 400, 'Password needs at least 6 characters');
      const r = newRestaurant(body);
      for (const name of ['Starters', 'Main Course', 'Desserts', 'Drinks']) db.categories.push({ id: id(), restaurantId: r.id, name, sort: db.categories.length });
      save(); return send(res, 201, publicRestaurant(r));
    }
    if (m === 'POST' && (mt = /^\/api\/platform\/restaurants\/([A-Za-z0-9]+)\/password$/.exec(p))) {
      const r = db.restaurants.find(x => x.id === mt[1]);
      if (!r) return fail(res, 404, 'Not found');
      if (str(body.password).length < 6) return fail(res, 400, 'Password needs at least 6 characters');
      r.passwordHash = hashPassword(body.password); r.sessionVer = (r.sessionVer || 0) + 1; save();
      return send(res, 200, { ok: true });
    }
    if (m === 'PUT' && (mt = /^\/api\/platform\/restaurants\/([A-Za-z0-9]+)$/.exec(p))) {
      const r = db.restaurants.find(x => x.id === mt[1]);
      if (!r) return fail(res, 404, 'Not found');
      if (body.poweredBy != null) r.poweredBy = !!body.poweredBy;
      if (body.extendTrialDays) { const base = Math.max(Date.now(), Date.parse(r.trialEnds || 0) || 0); r.plan = 'trial'; r.trialEnds = new Date(base + Number(body.extendTrialDays) * DAY).toISOString(); }
      if (body.plan === 'lifetime') { r.plan = 'lifetime'; r.paidUntil = null; }
      save(); return send(res, 200, publicRestaurant(r));
    }
    if (m === 'GET' && p === '/api/platform/google') return send(res, 200, { clientId: googleClientId(), fromEnv: !!process.env.GOOGLE_CLIENT_ID });
    if (m === 'POST' && p === '/api/platform/google') {
      const cid = str(body.clientId, 200);
      if (cid && !/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(cid)) return fail(res, 400, 'That does not look like a Google Client ID. It ends with .apps.googleusercontent.com');
      db.config.googleClientId = cid; save(); return send(res, 200, { ok: true, clientId: cid });
    }
    if (m === 'POST' && p === '/api/platform/password') {
      if (str(body.next).length < 8) return fail(res, 400, 'Use at least 8 characters');
      db.config.platformHash = hashPassword(body.next); delete db.config.platformFirstPassword;
      db.config.platformVer = (db.config.platformVer || 0) + 1; save();
      setCookie(res, 'vd_platform', sign('platform|' + db.config.platformVer));
      return send(res, 200, { ok: true });
    }
  }
  return fail(res, 404, 'Not found');
}

// Start the HTTP server. Used by `npm start` and by the Windows desktop app.
function start(port = PORT, host) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      handle(req, res).catch(err => { console.error(err); if (!res.headersSent) fail(res, 500, 'Something went wrong'); });
    });
    srv.once('error', reject);
    srv.listen(port, host, () => resolve(srv));
  });
}

module.exports = { db, save, saveNow, newRestaurant, id, hashPassword, sign, start, lanAddresses, access };

if (require.main === module) {
  start().then(() => {
    console.log(`\n  Veyra Dine In is running.\n`);
    console.log(`  On this computer:   http://localhost:${PORT}`);
    for (const ip of lanAddresses()) console.log(`  On your Wi-Fi:      http://${ip}:${PORT}   <- open the admin with this so table QR codes work on phones`);
    if (db.config.platformFirstPassword) console.log(`\n  Platform login (/platform) password: ${db.config.platformFirstPassword}\n  Change it after you log in.`);
    console.log('');
  });
}
