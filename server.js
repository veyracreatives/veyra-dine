// Veyra Dine In: QR table ordering for restaurants (white-label, multi-restaurant).
// Run: npm install && npm start   ->  http://localhost:3000
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const QRCode = require('qrcode');
const { verifyKey } = require('./lib/license');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
// Plans and where the "Buy" buttons go. Change prices here.
const PLANS = { trialDays: 30, lifetime: 14999, yearly: 5999 };
const BUY_URL = process.env.BUY_URL || 'https://wa.me/918928246726?text=';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- tiny JSON database ----------
let db = { config: {}, restaurants: [], categories: [], items: [], tables: [], orders: [], requests: [], coupons: [] };
if (fs.existsSync(DB_FILE)) db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
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
  };
}
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
// Is this restaurant allowed to take orders? (trial running, or paid)
function access(r) {
  const plan = r.plan || 'lifetime'; // restaurants made before plans existed keep working
  if (plan === 'lifetime') return { plan, active: true };
  const until = plan === 'trial' ? r.trialEnds : r.paidUntil;
  const daysLeft = until ? Math.ceil((Date.parse(until) - Date.now()) / DAY) : 0;
  return { plan, active: daysLeft > 0, daysLeft: Math.max(0, daysLeft), until };
}
const BILL_DEFAULT = { width: '80', gstin: '', fssai: '', footer: 'Thank you! Please visit again.', autoKot: false, showUpi: true };
function adminRestaurant(r) { return { ...publicRestaurant(r), upiId: r.upiId || '', upiName: r.upiName || '', email: r.email || '', ownerName: r.ownerName || '', access: access(r), bill: Object.assign({}, BILL_DEFAULT, r.bill || {}) }; }
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
  if (m === 'GET' && p === '/') { res.writeHead(302, { Location: process.env.HOME_URL || 'https://veyracreatives.github.io/dine-in/' }); return res.end(); } // product website; restaurants use /admin and /signup
  if (m === 'GET' && /^\/m\/[a-z0-9-]+\/?$/.test(p)) return serveMenuPage(req, res, url, p.split('/')[2]);
  if (m === 'GET' && p === '/robots.txt') return send(res, 200, `User-agent: *\nDisallow: /admin\nDisallow: /platform\nDisallow: /api/\nDisallow: /print-qr\nAllow: /m/\n\nSitemap: ${baseUrl(req)}/sitemap.xml\n`, { 'Content-Type': 'text/plain; charset=utf-8' });
  if (m === 'GET' && p === '/sitemap.xml') return send(res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${db.restaurants.filter(r => access(r).active).map(r => `  <url><loc>${baseUrl(req)}/m/${r.slug}</loc><changefreq>weekly</changefreq></url>`).join('\n')}\n</urlset>\n`, { 'Content-Type': 'application/xml; charset=utf-8' });
  if (m === 'GET' && (p === '/signup' || /^\/admin(\/[a-z0-9-]+)?\/?$/.test(p))) return serveFile(res, path.join(PUBLIC_DIR, 'admin.html'));
  if (m === 'GET' && p === '/platform') return serveFile(res, path.join(PUBLIC_DIR, 'platform.html'));
  if (m === 'GET' && p === '/print-qr') return serveFile(res, path.join(PUBLIC_DIR, 'print-qr.html'));
  if (m === 'GET' && p.startsWith('/uploads/')) { const f = safeJoin(UPLOAD_DIR, p.slice(9)); return f ? serveFile(res, f, 'public, max-age=31536000, immutable') : fail(res, 404, 'Not found'); }
  if (m === 'GET' && p.startsWith('/assets/')) { const f = safeJoin(PUBLIC_DIR, p); return f ? serveFile(res, f) : fail(res, 404, 'Not found'); }

  if (!p.startsWith('/api/')) return fail(res, 404, 'Not found');
  let body = {};
  if (m === 'POST' || m === 'PUT' || m === 'PATCH') {
    try { body = await readBody(req); } catch (e) { return fail(res, 400, e.message); }
  }
  let mt;

  // ===== guest accounts (log in before ordering) =====
  if ((mt = /^\/api\/menu\/([a-z0-9-]+)\/guest\/(me|signup|login|logout)$/.exec(p))) {
    const r = db.restaurants.find(x => x.slug === mt[1]);
    if (!r) return fail(res, 404, 'Restaurant not found');
    const act = mt[2];
    if (m === 'GET' && act === 'me') { const g = guestOf(req, r); return send(res, 200, { guest: g ? publicGuest(g) : null }); }
    if (m !== 'POST') return fail(res, 404, 'Not found');
    if (act === 'logout') { setCookie(res, 'vd_guest_' + r.id, '', 0); return send(res, 200, { ok: true }); }
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
    r.orderSeq = (r.orderSeq || 100) + 1;
    const order = {
      id: id(16), restaurantId: r.id, number: r.orderSeq, tableId: table.id, tableName: table.name,
      items: lines, note: str(body.note, 300), customerName: str(body.name, 60), total, subtotal, discount, coupon: couponCode,
      status: 'new', createdAt: now(), updatedAt: now(), readyBy: estimateReady(r, lines),
      ...(guest ? { guestId: guest.id, customerPhone: guest.phone || guest.email } : {}),
    };
    if (guest) guest.lastAt = now();
    if (shared) {
      const people = [...new Set(lines.map(l => l.by))];
      if (!order.customerName) order.customerName = people.length > 1 ? people.join(', ').slice(0, 60) : people[0];
      cartOf(table.id).lines = [];
    }
    db.orders.push(order); save();
    emit(r.id, 'order', publicOrder(order));
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
    setCookie(res, 'vd_admin', sign(r.id + '|0'));
    return send(res, 201, { ok: true, slug: r.slug });
  }
  if (m === 'POST' && p === '/api/admin/login') {
    const who = str(body.slug, 120).toLowerCase();
    const r = db.restaurants.find(x => (who.includes('@') ? x.email === who : x.slug === slugify(who)));
    if (!r || !checkPassword(body.password || '', r.passwordHash)) return fail(res, 401, 'Wrong email / restaurant ID or password');
    setCookie(res, 'vd_admin', sign(r.id + '|' + (r.sessionVer || 0)));
    return send(res, 200, { ok: true, slug: r.slug });
  }
  if (m === 'POST' && p === '/api/admin/logout') { setCookie(res, 'vd_admin', '', 0); return send(res, 200, { ok: true }); }

  if (p.startsWith('/api/admin/')) {
    const r = adminOf(req);
    if (!r) return fail(res, 401, 'Please log in');
    const mine = list => list.filter(x => x.restaurantId === r.id);

    if (m === 'GET' && p === '/api/admin/me') {
      return send(res, 200, { restaurant: adminRestaurant(r), baseUrl: baseUrl(req), lan: lanAddresses(), port: PORT, publicUrlSet: !!process.env.PUBLIC_URL, plans: PLANS, buyUrl: BUY_URL });
    }
    if (m === 'POST' && p === '/api/admin/activate') {
      const v = verifyKey(body.key);
      if (!v.ok) return fail(res, 400, v.error);
      db.config.usedLicenses = db.config.usedLicenses || {};
      const owner = db.config.usedLicenses[v.payload.id];
      if (owner && owner !== r.id) return fail(res, 409, 'This license key is already used by another restaurant.');
      db.config.usedLicenses[v.payload.id] = r.id;
      r.plan = v.payload.p === 'yearly' ? 'yearly' : 'lifetime';
      r.paidUntil = v.payload.exp ? new Date(v.payload.exp + 'T23:59:59Z').toISOString() : null;
      r.licenseKey = v.key; r.licensedTo = v.payload.n; r.activatedAt = now();
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
      return send(res, 200, list.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 500).map(publicOrder));
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
        for (const l of o.items) { const d = dishes[l.name] || (dishes[l.name] = { name: l.name, qty: 0, sales: 0 }); d.qty += l.qty; d.sales = money(d.sales + l.qty * l.price); }
        const t = tables[o.tableName] || (tables[o.tableName] = { name: o.tableName, orders: 0, sales: 0 }); t.orders++; t.sales = money(t.sales + o.total);
        hours[new Date(Date.parse(o.createdAt) - tz * 60000).getUTCHours()]++;
      }
      return send(res, 200, {
        from, to, discounts: money(done.reduce((s, o) => s + (o.discount || 0), 0)), orders: done.length, sales, average: done.length ? Math.round(sales / done.length) : 0,
        cancelled: all.length - done.length, items: done.reduce((s, o) => s + o.items.reduce((a, l) => a + l.qty, 0), 0),
        days, hours,
        dishes: Object.values(dishes).sort((a, b) => b.qty - a.qty || b.sales - a.sales).slice(0, 15),
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
      o.status = body.status; o.updatedAt = now(); save();
      { const t = db.tables.find(x => x.id === o.tableId); if (t) tableChanged(r, t, false); }
      emit(r.id, 'order', publicOrder(o)); emitOrder(o);
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
    if (m === 'GET' && p === '/api/admin/upi-qr') {
      if (!r.upiId) return fail(res, 404, 'No UPI ID');
      const amount = Math.max(1, Math.min(500000, Number(url.searchParams.get('am')) || 0));
      const svg = await QRCode.toString(upiLink(r, amount, str(url.searchParams.get('n'), 40)), { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' }); return res.end(svg);
    }
    // the counter can see a table's bill and take payments person by person
    if ((mt = /^\/api\/admin\/tables\/([A-Za-z0-9]+)\/(bill|payment)$/.exec(p))) {
      const table = db.tables.find(t => t.id === mt[1] && t.restaurantId === r.id);
      if (!table) return fail(res, 404, 'Table not found');
      if (m === 'GET' && mt[2] === 'bill') return send(res, 200, { table: { id: table.id, name: table.name }, ...billView(r, table) });
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
      for (const o of db.orders) if (o.tableId === table.id && !o.settled) { o.settled = true; if (['new', 'preparing', 'ready'].includes(o.status)) continue; }
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
