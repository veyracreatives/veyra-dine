/* Veyra visitor stats: free, self-hosted, no cookies, no third parties.
   Browsers send small events to /api/va (see public/va.js). Each day is one file: data/analytics/YYYY-MM-DD.jsonl.
   Saved per event: a random visitor id from the browser, page, button name, source site, device, city. Never the IP or anything typed.
   Server events (signup, paid) link a visitor id to the account they made, so HQ can show which visitor became which customer. */
'use strict';
const fs = require('fs'), path = require('path');
const { Geo } = require('./geo.js');

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python|axios|node-fetch|go-http|java\/|okhttp|scrapy|semrush|ahrefs|mj12|dataprovider|petal|yandex|baidu/i;
const DAY = 864e5;
const ist = t => new Date(t + 19800000).toISOString().slice(0, 10); // days in India time

function device(ua) {
  ua = String(ua || '');
  const dv = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ? 'Tablet' : /Mobi|iPhone|iPod|Android.*Mobile|Opera Mini|IEMobile/i.test(ua) ? 'Phone' : 'Computer';
  const os = /Windows/i.test(ua) ? 'Windows' : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone / iPad' : /Android/i.test(ua) ? 'Android' : /Mac OS X|Macintosh/i.test(ua) ? 'Mac' : /CrOS/i.test(ua) ? 'ChromeOS' : /Linux/i.test(ua) ? 'Linux' : 'Other';
  const br = /Edg\//i.test(ua) ? 'Edge' : /SamsungBrowser/i.test(ua) ? 'Samsung Internet' : /OPR\/|Opera/i.test(ua) ? 'Opera' : /FBAN|FBAV|Instagram/i.test(ua) ? 'Instagram / Facebook app' : /CriOS|Chrome\//i.test(ua) ? 'Chrome' : /Firefox|FxiOS/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'Other';
  return { dv, os, br };
}
function source(ref, utm, selfHost) {
  const s = String((utm && utm.s) || '').toLowerCase();
  let h = ''; try { h = ref ? new URL(ref).hostname.replace(/^www\./, '').toLowerCase() : ''; } catch (_) {}
  if (h && selfHost && h === selfHost) h = '';
  const k = s || h;
  if (!k) return { src: 'Direct', host: '' };
  const M = [[/google/, 'Google'], [/bing/, 'Bing'], [/yahoo|duckduckgo|ecosia|yandex|baidu/, 'Other search'], [/instagram|^ig$/, 'Instagram'], [/facebook|fb\.|^fb$|^meta$/, 'Facebook'], [/whatsapp|wa\.me|^wa$/, 'WhatsApp'], [/youtube|youtu\.be/, 'YouTube'], [/linkedin|lnkd/, 'LinkedIn'], [/t\.co$|twitter|^x\.com$|^x$/, 'X / Twitter'], [/chatgpt|openai|perplexity|claude|gemini|copilot/, 'AI assistants'], [/veyracreatives|veyralab/, 'Veyra sites']];
  for (const [re, n] of M) if (re.test(k)) return { src: n, host: h };
  return { src: s ? s : 'Other sites', host: h };
}
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 120);

function Analytics(opts) {
  const dir = path.join(opts.dataDir, 'analytics'); fs.mkdirSync(dir, { recursive: true });
  const geo = Geo(path.join(opts.dataDir, 'geo'));
  const selfHost = (() => { try { return new URL(opts.base).hostname.replace(/^www\./, ''); } catch (_) { return ''; } })();
  /* first-touch index: vid -> where they first came from */
  const VF = path.join(dir, 'visitors.json'); let V = {}; try { V = JSON.parse(fs.readFileSync(VF, 'utf8')); } catch (_) {}
  let vT = null; const saveV = () => { clearTimeout(vT); vT = setTimeout(() => { const k = Object.keys(V); if (k.length > 60000) k.sort((a, b) => V[a].f - V[b].f).slice(0, k.length - 50000).forEach(x => delete V[x]); fs.writeFile(VF + '.tmp', JSON.stringify(V), e => { if (!e) fs.rename(VF + '.tmp', VF, () => {}); }); }, 2000); };
  const buf = []; let bT = null;
  function write(ev) { buf.push(ev); clearTimeout(bT); bT = setTimeout(flush, 500); cache.clear(); }
  function flush() { if (!buf.length) return; const by = {}; buf.splice(0).forEach(e => { const d = ist(e.ts); (by[d] = by[d] || []).push(JSON.stringify(e)); }); for (const [d, l] of Object.entries(by)) fs.appendFileSync(path.join(dir, d + '.jsonl'), l.join('\n') + '\n'); }
  process.on('exit', flush);
  setInterval(() => { // keep 400 days
    try { const cut = ist(Date.now() - 400 * DAY); fs.readdirSync(dir).filter(f => /^\d{4}-\d\d-\d\d\.jsonl$/.test(f) && f.slice(0, 10) < cut).forEach(f => fs.unlinkSync(path.join(dir, f))); } catch (_) {}
  }, 6 * 3600e3);
  const hits = new Map();
  function ipOf(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }

  /* browser events */
  function track(req, body) {
    const ua = req.headers['user-agent'] || ''; if (BOT.test(ua) || !body || !Array.isArray(body.e)) return;
    const ip = ipOf(req); const now = Date.now(); const h = (hits.get(ip) || []).filter(t => now - t < 60e3); if (h.length > 120) return; h.push(now); hits.set(ip, h); if (hits.size > 20000) hits.clear();
    const vid = clean(body.v, 24).replace(/[^\w-]/g, ''), sid = clean(body.s, 24).replace(/[^\w-]/g, ''); if (!vid) return;
    const isNew = !V[vid]; let place = null, dev = null;
    body.e.slice(0, 40).forEach(x => {
      const t = clean(x.t, 10); if (!['view', 'click', 'see', 'form', 'leave', 'app'].includes(t)) return;
      const ev = { ts: now, v: vid, s: sid, t, p: clean(x.p, 160) || '/', h: clean(x.h, 60) };
      if (t === 'click' || t === 'see' || t === 'form' || t === 'app') { ev.n = clean(x.n, 80); if (!ev.n) return; if (x.x) ev.x = clean(x.x, 200); if (x.sec) ev.sec = clean(x.sec, 40); }
      if (t === 'leave') { ev.ms = Math.max(0, Math.min(3 * 3600e3, +x.ms || 0)); ev.d = Math.max(0, Math.min(100, +x.d || 0)); }
      if (t === 'view') {
        const utm = x.u && typeof x.u === 'object' ? { s: clean(x.u.s, 60), m: clean(x.u.m, 60), c: clean(x.u.c, 80) } : null;
        const so = source(x.r, utm, selfHost); ev.src = so.src; if (so.host) ev.ref = so.host; if (utm && (utm.s || utm.c)) ev.utm = utm;
        dev = dev || device(ua); Object.assign(ev, dev);
        if (place === null) { place = geo.city(ip) || {}; }
        if (place.ct) { const m = /^(.*?)\s*\((.*)\)$/.exec(place.ct); ev.ct = m ? m[1] : place.ct; if (m) ev.ar = m[2]; } if (place.rg) ev.rg = place.rg; if (place.co) ev.co = place.co;
        ev.w = Math.max(0, Math.min(10000, +x.w || 0)); if (x.l) ev.l = clean(x.l, 12);
        if (isNew && !V[vid]) { V[vid] = { f: now, src: ev.src, ref: ev.ref || '', utm: ev.utm || null, ct: ev.ct || '', co: ev.co || '', dv: ev.dv, os: ev.os, p: ev.p + (ev.h || '') }; saveV(); }
      }
      write(ev);
    });
  }
  /* server events: signup, paid, login (linked to an account) */
  function server(vid, t, data) { vid = clean(vid, 24).replace(/[^\w-]/g, ''); if (!vid) return; write(Object.assign({ ts: Date.now(), v: vid, s: '', t, p: '' }, data || {})); }
  const first = vid => V[vid] || null;

  /* reports */
  const cache = new Map();
  function readDays(from, to) {
    flush(); const out = [];
    for (let t = from; ist(t) <= ist(to); t += DAY) { const f = path.join(dir, ist(t) + '.jsonl'); if (!fs.existsSync(f)) continue;
      for (const line of fs.readFileSync(f, 'utf8').split('\n')) { if (!line) continue; try { const e = JSON.parse(line); if (e.ts >= from && e.ts <= to) out.push(e); } catch (_) {} } }
    return out;
  }
  function report(q) {
    const days = Math.max(1, Math.min(365, +q.days || 30)); const key = days + '|' + (q.funnelKey || '');
    const c = cache.get(key); if (c && Date.now() - c.at < 60e3) return c.r;
    const to = Date.now(); const from = days === 1 ? Date.parse(ist(to) + 'T00:00:00+05:30') : to - days * DAY;
    const evs = readDays(from, to); const funnel = opts.funnel || [];
    const vis = new Map(); // vid -> visitor summary
    const get = v => { let x = vis.get(v); if (!x) { x = { v, first: Infinity, last: 0, views: 0, sessions: new Set(), clicks: [], seen: new Set(), forms: new Set(), ms: 0, depth: 0, step: -1, acct: null, src: '', ref: '', utm: null, ct: '', ar: '', rg: '', co: '', dv: '', os: '', br: '', pages: new Set(), app: false }; vis.set(v, x); } return x; };
    const series = {}; const clicks = new Map(); const seeBy = new Map(); const pathVis = new Map();
    for (const e of evs) {
      const x = get(e.v); x.first = Math.min(x.first, e.ts); x.last = Math.max(x.last, e.ts); if (e.s) x.sessions.add(e.s);
      if (e.t === 'view') { x.views++; x.pages.add(e.p + (e.h || '')); if (!x.src) Object.assign(x, { src: e.src, ref: e.ref || '', utm: e.utm || null, ct: e.ct || '', ar: e.ar || '', rg: e.rg || '', co: e.co || '', dv: e.dv, os: e.os, br: e.br });
        const d = ist(e.ts); (series[d] = series[d] || { v: new Set(), pv: 0 }).v.add(e.v); series[d].pv++;
        for (const pk of [e.p, e.p + (e.h || '')]) { if (!pathVis.has(pk)) pathVis.set(pk, new Set()); pathVis.get(pk).add(e.v); } }
      if (e.t === 'click') { x.clicks.push({ n: e.n, sec: e.sec || '', ts: e.ts }); const k = e.n + '\u0001' + (e.sec || '') + '\u0001' + e.p + (e.h || ''); let c = clicks.get(k); if (!c) { c = { n: e.n, sec: e.sec || '', p: e.p, h: e.h || '', x: e.x || '', who: new Set(), total: 0 }; clicks.set(k, c); } c.who.add(e.v); c.total++; }
      if (e.t === 'see') { x.seen.add(e.n); const k = e.p + '\u0001' + e.n; if (!seeBy.has(k)) seeBy.set(k, new Set()); seeBy.get(k).add(e.v); }
      if (e.t === 'form') x.forms.add(e.n);
      if (e.t === 'app') x.app = true;
      if (e.t === 'leave') { x.ms += e.ms || 0; x.depth = Math.max(x.depth, e.d || 0); }
      if (e.t === 'signup' || e.t === 'paid') { x.acct = Object.assign(x.acct || {}, { name: e.n || (x.acct && x.acct.name) || '', email: e.x || (x.acct && x.acct.email) || '', id: e.id || (x.acct && x.acct.id) || '' }); if (e.t === 'paid') x.acct.paid = (x.acct.paid || 0) + (e.amt || 0); }
      funnel.forEach((st, i) => { if (i > x.step && st.match(e)) x.step = i; });
    }
    // fill missing first-touch info for visitors who first came before the range
    for (const x of vis.values()) { if (!x.src) { const f = V[x.v]; if (f) Object.assign(x, { src: f.src, ref: f.ref, utm: f.utm, ct: f.ct, co: f.co, dv: f.dv, os: f.os }); } }
    const people = [...vis.values()].filter(x => x.views > 0 || x.acct);
    const N = people.length;
    const count = (fn) => { const m = new Map(); people.forEach(x => { const k = fn(x); if (!k) return; m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => ({ k, n })); };
    const signups = people.filter(x => x.acct).length;
    const daysList = []; for (let t = from; ist(t) <= ist(to); t += DAY) { const d = ist(t); daysList.push({ d, v: series[d] ? series[d].v.size : 0, pv: series[d] ? series[d].pv : 0 }); }
    const sessions = people.reduce((t, x) => t + Math.max(1, x.sessions.size), 0);
    const bounced = people.filter(x => x.views <= 1 && !x.clicks.length && !x.acct).length;
    // buttons: who clicked vs who saw it and did not
    const buttons = [...clicks.values()].map(c => { const base = (c.sec && seeBy.get(c.p + '\u0001' + c.sec)) || pathVis.get(c.p + c.h) || new Set(); const saw = new Set([...base, ...c.who]).size; return { n: c.n, sec: c.sec, p: c.p + c.h, href: c.x, clicked: c.who.size, total: c.total, saw, notClicked: Math.max(0, saw - c.who.size) }; }).sort((a, b) => b.clicked - a.clicked).slice(0, 80);
    const sections = [...seeBy.entries()].map(([k, s]) => { const [p, n] = k.split('\u0001'); const base = (pathVis.get(p) || new Set()).size || 1; return { p, n, seen: s.size, of: base }; }).sort((a, b) => b.seen - a.seen).slice(0, 40);
    const steps = funnel.map((st, i) => ({ label: st.label, n: people.filter(x => x.step >= i).length }));
    const list = people.sort((a, b) => b.last - a.last).slice(0, 500).map(x => ({ v: x.v, first: x.first === Infinity ? x.last : x.first, last: x.last, views: x.views, sessions: Math.max(1, x.sessions.size), ms: x.ms, depth: x.depth, src: x.src, ref: x.ref, utm: x.utm, ct: x.ct, ar: x.ar, rg: x.rg, co: x.co, dv: x.dv, os: x.os, br: x.br, clicks: x.clicks.slice(0, 40), seen: [...x.seen], forms: [...x.forms], pages: [...x.pages].slice(0, 20), step: x.step, stepLabel: x.step >= 0 && funnel[x.step] ? funnel[x.step].label : '', acct: x.acct, app: x.app }));
    const r = { days, from, to, geoReady: geo.ready(),
      totals: { visitors: N, sessions, views: people.reduce((t, x) => t + x.views, 0), avgMs: N ? Math.round(people.reduce((t, x) => t + x.ms, 0) / N) : 0, bounce: N ? Math.round(bounced * 100 / N) : 0, signups, conv: N ? +(signups * 100 / N).toFixed(1) : 0, newVisitors: people.filter(x => V[x.v] && V[x.v].f >= from).length },
      series: daysList, sources: count(x => x.src), referrers: count(x => x.ref), campaigns: count(x => x.utm && (x.utm.c || x.utm.s) ? [x.utm.s, x.utm.m, x.utm.c].filter(Boolean).join(' / ') : ''),
      devices: count(x => x.dv), os: count(x => x.os), browsers: count(x => x.br), cities: count(x => x.ct ? x.ct + (x.co && x.co !== 'IN' ? ', ' + x.co : '') : ''), areas: count(x => x.ar ? x.ar + ' · ' + x.ct : ''), countries: count(x => x.co),
      pages: count(x => [...x.pages][0] || ''), buttons, sections, funnel: steps, visitors: list };
    cache.set(key, { at: Date.now(), r }); return r;
  }
  return { track, server, report, first, device, geoReady: () => geo.ready() };
}
module.exports = { Analytics, device, source, BOT };
