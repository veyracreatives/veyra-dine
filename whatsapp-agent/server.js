// Veyra WhatsApp AI agent + phone inbox.
//   /webhook  Meta WhatsApp Cloud API webhook (verify + messages)
//   /         phone inbox for Rutvi/Dibesh (password)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db, save, saveNow, backup, own } from "./lib/store.js";
import { think, aiReady, MODEL } from "./lib/agent.js";
import { verifySignature, sendText, markRead, textOf, waReady } from "./lib/whatsapp.js";
import { findLeads, importSeed, cleanPhone } from "./lib/finder.js";
import { notify, mailReady } from "./lib/notify.js";

// Keys can be pasted on the phone (Setup tab); stored in data/secrets.json, never sent back.
const KEYS = ["ANTHROPIC_API_KEY", "WA_TOKEN", "WA_PHONE_ID", "WA_APP_SECRET", "GOOGLE_PLACES_KEY", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
const SECRETS = path.join(process.env.DATA_DIR || path.resolve("data"), "secrets.json");
const secrets = fs.existsSync(SECRETS) ? JSON.parse(fs.readFileSync(SECRETS, "utf8")) : {};
for (const k of KEYS) if (secrets[k]) process.env[k] = secrets[k];
const PORT = Number(process.env.PORT || 3200);
const PASSWORD = process.env.INBOX_PASSWORD || "";
const SECRET = process.env.SESSION_SECRET || crypto.createHash("sha256").update("veyra-wa:" + PASSWORD).digest("hex");
const VERIFY = process.env.WA_VERIFY_TOKEN || "";
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const MAX_BOT_REPLIES_PER_DAY = Number(process.env.MAX_BOT_REPLIES_PER_DAY || 40);
const PUB = path.resolve("public");

// ---------- helpers ----------
const now = () => new Date().toISOString();
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
const readBody = req => new Promise((ok, bad) => { const c = []; let n = 0; req.on("data", d => { n += d.length; if (n > 1e6) { bad(new Error("too big")); req.destroy(); } else c.push(d); }); req.on("end", () => ok(Buffer.concat(c))); req.on("error", bad); });
const sign = v => v + "." + crypto.createHmac("sha256", SECRET).update(v).digest("hex").slice(0, 32);
function authed(req) {
  const m = /(?:^|;\s*)vs=([^;]+)/.exec(req.headers.cookie || ""); if (!m || !PASSWORD) return false;
  const [exp] = m[1].split(".");
  return sign(exp) === m[1] && Number(exp) > Date.now();
}
const within24h = c => c.lastInboundAt && Date.now() - Date.parse(c.lastInboundAt) < 24 * 3600e3;
const fails = {};

function chatOf(wa, name) {
  const c = own(db.chats, wa) || (db.chats[wa] = { wa, name: "", msgs: [], lead: {}, botPaused: false, optOut: false, createdAt: now(), unread: 0, botToday: { day: "", n: 0 } });
  if (name && !c.name) c.name = name;
  return c;
}
const pending = {}; // debounce bursts of messages per chat

// ---------- core: handle one inbound message ----------
async function inbound({ wa, name, text, id, sim = false }) {
  if (id) { db.seen.msg ||= {}; if (db.seen.msg[id]) return null; db.seen.msg[id] = Date.now(); }
  const c = chatOf(wa, name);
  const isNew = c.msgs.length === 0;
  c.msgs.push({ from: "them", text, at: now(), id: id || null });
  c.lastInboundAt = now(); c.updatedAt = now(); c.unread = (c.unread || 0) + 1; c.sim = c.sim || sim;
  const found = Object.values(db.found).find(f => f.phone === wa);
  if (found && found.status !== "Won") { found.status = "Replied"; c.lead.business ||= found.name; c.lead.city ||= found.area || ""; c.lead.interest ||= found.product; }
  if (/^\s*(start|unstop)\s*$/i.test(text)) c.optOut = false;
  save();
  if (isNew && !sim) notify(`New WhatsApp chat: ${c.name || "+" + wa}`, `${c.name || ""} (+${wa}) wrote:\n\n${text}\n\nOpen inbox: ${PUBLIC_URL}/#${wa}`);
  if (id) markRead(id);
  if (c.optOut || c.botPaused || !db.settings.botOn) {
    if (c.botPaused && !sim) notify(`Reply needed: ${c.name || "+" + wa}`, `${text}\n\nOpen inbox: ${PUBLIC_URL}/#${wa}`);
    return { paused: true };
  }
  // wait a few seconds so 3 quick messages get one reply
  return new Promise(ok => {
    clearTimeout(pending[wa]?.t);
    const waiters = [...(pending[wa]?.w || []), ok];
    pending[wa] = { w: waiters, t: setTimeout(async () => { delete pending[wa]; const r = await botReply(c, sim); waiters.forEach(f => f(r)); }, sim ? 50 : 4000) };
  });
}

async function botReply(c, sim) {
  const day = now().slice(0, 10);
  if (c.botToday?.day !== day) c.botToday = { day, n: 0 };
  if (c.botToday.n >= MAX_BOT_REPLIES_PER_DAY) { c.botPaused = true; save(); notify(`Bot paused (too many messages): +${c.wa}`, `${PUBLIC_URL}/#${c.wa}`); return { paused: true }; }
  let out;
  try { out = await think(c.msgs, c.lead); }
  catch (e) { console.error("think", e.status || "", e.message); out = { reply: "Thanks for your message. Rutvi from our team will reply here shortly.", lead: c.lead, handoff: true, optOut: false, model: "error" }; }
  const sent = sim ? { ok: true, sim: true } : await sendText(c.wa, out.reply);
  c.msgs.push({ from: "bot", text: out.reply, at: now(), ok: sent.ok, error: sent.error || null, model: out.model });
  c.botToday.n++;
  const before = c.lead.stage;
  c.lead = { ...c.lead, ...Object.fromEntries(Object.entries(out.lead || {}).filter(([, v]) => v !== "" && v !== "Unknown" && !(Array.isArray(v) && !v.length))) };
  if (out.optOut) c.optOut = true;
  if (out.handoff) {
    c.botPaused = true;
    if (!sim) notify(`Hand over to you: ${c.lead.name || c.name || "+" + c.wa}`, `${c.lead.summary || ""}\nInterest: ${c.lead.interest || "?"}\nLast message: ${c.msgs.filter(m => m.from === "them").pop()?.text}\n\nReply from the inbox: ${PUBLIC_URL}/#${c.wa}`);
  } else if (before !== c.lead.stage && c.lead.stage === "Qualified" && !sim) {
    notify(`Qualified lead: ${c.lead.business || c.lead.name || "+" + c.wa}`, `${c.lead.summary || ""}\n${PUBLIC_URL}/#${c.wa}`);
  }
  c.updatedAt = now(); save();
  return { reply: out.reply, lead: c.lead, handoff: out.handoff, sent };
}

// ---------- HTTP ----------
const routes = {
  "GET /health": (q, res) => json(res, 200, { ok: true, ai: aiReady(), model: MODEL, whatsapp: waReady(), email: mailReady() }),

  // Meta webhook verification
  "GET /webhook": (q, res) => {
    if (VERIFY && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === VERIFY) { res.writeHead(200); return res.end(q.get("hub.challenge")); }
    res.writeHead(403); res.end("forbidden");
  },
  "POST /webhook": async (q, res, req, raw) => {
    if (!verifySignature(raw, req.headers["x-hub-signature-256"])) { res.writeHead(401); return res.end("bad signature"); }
    res.writeHead(200); res.end("ok"); // answer Meta fast, work after
    let body; try { body = JSON.parse(raw.toString("utf8")); } catch { return; }
    for (const entry of body.entry || []) for (const ch of entry.changes || []) {
      const v = ch.value || {};
      const names = Object.fromEntries((v.contacts || []).map(k => [k.wa_id, k.profile?.name || ""]));
      for (const m of v.messages || []) inbound({ wa: m.from, name: names[m.from], text: textOf(m), id: m.id }).catch(e => console.error("inbound", e));
      for (const s of v.statuses || []) if (s.status === "failed") console.error("WA delivery failed", s.recipient_id, s.errors?.[0]?.title);
    }
  },

  "POST /api/login": async (q, res, req, raw) => {
    const ip = (/^(::ffff:)?127\.0\.0\.1$|^::1$/.test(req.socket.remoteAddress) && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress; const f = fails[ip] ||= { n: 0, until: 0 };
    if (f.until > Date.now()) return json(res, 429, { error: "Too many tries. Wait 10 minutes." });
    let p = ""; try { p = JSON.parse(raw).password || ""; } catch {}
    const ok = PASSWORD && p.length === PASSWORD.length && crypto.timingSafeEqual(Buffer.from(p), Buffer.from(PASSWORD));
    if (!ok) { if (++f.n >= 8) { f.until = Date.now() + 600e3; f.n = 0; } return json(res, 401, { error: "Wrong password" }); }
    f.n = 0;
    const exp = String(Date.now() + 60 * 24 * 3600e3);
    res.setHeader("Set-Cookie", `vs=${sign(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 24 * 3600}${PUBLIC_URL.startsWith("https") ? "; Secure" : ""}`);
    json(res, 200, { ok: true });
  },
};

const authedRoutes = {
  "GET /api/state": (q, res) => {
    const chats = Object.values(db.chats).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "")).map(c => ({
      wa: c.wa, name: c.name, lead: c.lead, botPaused: c.botPaused, optOut: c.optOut, unread: c.unread || 0, sim: !!c.sim,
      updatedAt: c.updatedAt, open: within24h(c), last: c.msgs[c.msgs.length - 1] || null, needsYou: c.botPaused && !c.optOut && (c.msgs[c.msgs.length - 1]?.from || "team") !== "team",
    }));
    const found = Object.values(db.found).sort((a, b) => (b.foundAt || "").localeCompare(a.foundAt || ""));
    json(res, 200, { chats, found, settings: db.settings, status: { ai: aiReady(), model: MODEL, whatsapp: waReady(), email: mailReady(), lastFind: db.seen.lastFind || null, keys: KEYS.filter(k => process.env[k]), webhook: PUBLIC_URL + "/webhook", verifyToken: VERIFY, google: !!process.env.GOOGLE_PLACES_KEY } });
  },
  "GET /api/chat": (q, res) => { const c = own(db.chats, q.get("wa") || ""); if (!c) return json(res, 404, { error: "not found" }); c.unread = 0; save(); json(res, 200, { ...c, open: within24h(c) }); },
  "POST /api/send": async (q, res, req, raw) => {
    const { wa, text } = JSON.parse(raw); const c = own(db.chats, wa || "");
    if (!c || !text?.trim()) return json(res, 400, { error: "Missing chat or text" });
    if (!c.sim && !within24h(c)) return json(res, 409, { error: "More than 24 hours since they last wrote. WhatsApp only allows approved templates now. Use 'Open in my WhatsApp' to message from your own phone." });
    const sent = c.sim ? { ok: true, sim: true } : await sendText(c.wa, text.trim());
    c.msgs.push({ from: "team", text: text.trim(), at: now(), ok: sent.ok, error: sent.error || null });
    c.botPaused = true; c.pausedAt = now(); c.updatedAt = now(); save();
    json(res, sent.ok ? 200 : 502, sent);
  },
  "POST /api/chat-update": async (q, res, req, raw) => {
    const b = JSON.parse(raw); const c = own(db.chats, b.wa || ""); if (!c) return json(res, 404, { error: "not found" });
    if (typeof b.botPaused === "boolean") { c.botPaused = b.botPaused; if (b.botPaused) c.pausedAt = now(); }
    if (b.stage) c.lead.stage = String(b.stage).slice(0, 40);
    if (typeof b.note === "string") c.lead.note = b.note.slice(0, 2000);
    if (b.delete && c.sim) delete db.chats[c.wa];
    save(); json(res, 200, { ok: true });
  },
  "POST /api/keys": async (q, res, req, raw) => {
    const b = JSON.parse(raw);
    for (const k of KEYS) if (typeof b[k] === "string" && b[k].trim()) { secrets[k] = b[k].trim(); process.env[k] = secrets[k]; }
    fs.writeFileSync(SECRETS, JSON.stringify(secrets), { mode: 0o600 });
    json(res, 200, { saved: Object.keys(secrets).filter(k => KEYS.includes(k)) });
  },
  "POST /api/settings": async (q, res, req, raw) => { const b = JSON.parse(raw); if (typeof b.botOn === "boolean") db.settings.botOn = b.botOn; save(); json(res, 200, db.settings); },
  "POST /api/found-update": async (q, res, req, raw) => {
    const b = JSON.parse(raw); const f = own(db.found, b.id || ""); if (!f) return json(res, 404, { error: "not found" });
    if (["New", "Messaged", "Replied", "Won", "Skip"].includes(b.status)) { f.status = b.status; if (b.status === "Messaged") f.messagedAt = now(); }
    if (typeof b.opener === "string") f.opener = b.opener.slice(0, 1500);
    if (typeof b.note === "string") f.note = b.note.slice(0, 1000);
    save(); json(res, 200, f);
  },
  "POST /api/find-now": async (q, res) => { const r = await findLeads(); json(res, 200, r); },
  // Try the bot from the phone without WhatsApp (nothing is sent to anyone)
  "POST /api/sim": async (q, res, req, raw) => {
    const b = JSON.parse(raw); const wa = "test-" + String(b.who || "me").replace(/[^a-z0-9]/gi, "").slice(0, 12);
    const r = await inbound({ wa, name: "Test chat", text: String(b.text || "").slice(0, 1000), sim: true });
    json(res, 200, r || {});
  },
  "GET /api/export.csv": (q, res) => {
    const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["type", "name", "business", "phone", "city", "interest", "stage", "summary", "updated"].join(",")];
    for (const c of Object.values(db.chats)) if (!c.sim) rows.push(["chat", c.lead.name || c.name, c.lead.business, "+" + c.wa, c.lead.city, c.lead.interest, c.lead.stage, c.lead.summary, c.updatedAt].map(esc).join(","));
    for (const f of Object.values(db.found)) rows.push(["found", "", f.name, f.phone ? "+" + f.phone : "", f.area, f.product, f.status, f.address, f.foundAt].map(esc).join(","));
    res.writeHead(200, { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=veyra-leads.csv" }); res.end(rows.join("\n"));
  },
};

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://x"); const key = `${req.method} ${u.pathname}`;
    res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "no-referrer");
    const raw = req.method === "POST" ? await readBody(req) : Buffer.alloc(0);
    if (routes[key]) return await routes[key](u.searchParams, res, req, raw);
    if (authedRoutes[key]) { if (!authed(req)) return json(res, 401, { error: "Please sign in" }); return await authedRoutes[key](u.searchParams, res, req, raw); }
    if (req.method !== "GET") return json(res, 404, { error: "not found" });
    const file = path.join(PUB, u.pathname === "/" ? "index.html" : path.normalize(u.pathname).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  } catch (e) { console.error(e); if (!res.headersSent) json(res, 500, { error: "server error" }); }
});

// ---------- schedule: daily lead finding at 9 AM IST, backups ----------
function daily() {
  const ist = new Date(Date.now() + 5.5 * 3600e3); const day = ist.toISOString().slice(0, 10);
  if (ist.getUTCHours() >= 9 && db.seen.findDay !== day && process.env.LEAD_FINDER !== "off") {
    db.seen.findDay = day; save();
    findLeads().then(r => { if (r.google + r.osm > 0) notify(`${r.google + r.osm} new leads found`, `Open the Leads tab: ${PUBLIC_URL}/#leads`); }).catch(e => console.error("find", e));
  }
  if (db.seen.backupDay !== day) { db.seen.backupDay = day; backup(); save(); }
  // forget old message ids
  const cut = Date.now() - 7 * 86400e3; for (const [k, t] of Object.entries(db.seen.msg || {})) if (t < cut) delete db.seen.msg[k];
}

if (!db.seen.seeded && fs.existsSync("seed-leads.json")) {
  const list = JSON.parse(fs.readFileSync("seed-leads.json", "utf8")).map(l => ({ ...l, phone: cleanPhone(l.phone) }));
  importSeed(list).then(n => { db.seen.seeded = true; save(); console.log("seeded", n, "leads"); });
}
setInterval(daily, 10 * 60e3); setTimeout(daily, 5000);
process.on("SIGTERM", () => { saveNow(); process.exit(0); });
server.listen(PORT, () => console.log(`Veyra WhatsApp agent on :${PORT}  ai=${aiReady()} whatsapp=${waReady()} model=${MODEL}`));
