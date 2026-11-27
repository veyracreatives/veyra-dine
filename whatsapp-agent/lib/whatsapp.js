// Official WhatsApp Cloud API (Meta). Only replies inside the 24-hour window
// that opens when a customer messages us, so no cold messages from the bot.
import crypto from "node:crypto";
const V = process.env.GRAPH_VERSION || "v21.0";
export const waReady = () => !!(process.env.WA_TOKEN && process.env.WA_PHONE_ID);

export function verifySignature(raw, header) {
  const secret = process.env.WA_APP_SECRET;
  if (!secret) return false; // paste the Meta App Secret in Setup first
  if (!header || !header.startsWith("sha256=")) return false;
  const want = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const got = header.slice(7);
  return want.length === got.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(got));
}

export async function sendText(to, body) {
  if (!waReady()) return { ok: false, error: "WhatsApp not connected yet (no WA_TOKEN / WA_PHONE_ID)" };
  const r = await fetch(`https://graph.facebook.com/${V}/${process.env.WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: body.slice(0, 4000), preview_url: true } }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, id: j.messages?.[0]?.id } : { ok: false, error: j.error?.message || `HTTP ${r.status}` };
}

export async function markRead(id) {
  if (!waReady() || !id) return;
  await fetch(`https://graph.facebook.com/${V}/${process.env.WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: id }),
  }).catch(() => {});
}

// Pull text out of any inbound message type we care about.
export function textOf(m) {
  if (m.type === "text") return m.text?.body || "";
  if (m.type === "button") return m.button?.text || "";
  if (m.type === "interactive") return m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "";
  if (m.type === "location") return `(shared location ${m.location?.latitude},${m.location?.longitude})`;
  return `(sent a ${m.type})`;
}
