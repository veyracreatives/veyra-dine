// Email alerts to the team (new chat, hand-over, new leads). Optional: needs SMTP.
import nodemailer from "nodemailer";
const TO = process.env.NOTIFY_EMAIL || "marketing@veyracreatives.com";
let tx = null;
export const mailReady = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
export async function notify(subject, text) {
  console.log("[notify]", subject);
  if (!mailReady()) return;
  tx ||= nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: Number(process.env.SMTP_PORT || 465) === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  try { await tx.sendMail({ from: `"Veyra WhatsApp" <${process.env.SMTP_USER}>`, to: TO, subject: `[Veyra WA] ${subject}`, text }); }
  catch (e) { console.error("notify email failed", e.message); }
}
