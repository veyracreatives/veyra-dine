// Razorpay: restaurants buy Veyra Dine In plans online (Monthly, Yearly, Lifetime, update renewal).
// Only used for plan payments to Veyra. Guests still pay restaurant bills by the restaurant's own UPI.
// Docs: https://razorpay.com/docs/api/orders/ and https://razorpay.com/docs/webhooks/validate-test/
'use strict';
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const API = (process.env.RAZORPAY_API || 'https://api.razorpay.com').replace(/\/$/, '');

function call(cfg, method, path, data) {
  return new Promise((resolve, reject) => {
    const body = data ? JSON.stringify(data) : '';
    const u = new URL(API + path);
    const rq = (u.protocol === 'http:' ? http : https).request(u, {
      method,
      headers: Object.assign({ Authorization: 'Basic ' + Buffer.from(cfg.keyId + ':' + cfg.keySecret).toString('base64') }, body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
    }, r => {
      let s = ''; r.on('data', c => s += c);
      r.on('end', () => {
        let j = {}; try { j = JSON.parse(s); } catch {}
        if (r.statusCode >= 400) {
          const msg = (j.error && j.error.description) || 'Razorpay answered ' + r.statusCode;
          const e = new Error(r.statusCode === 401 ? 'Razorpay did not accept the API keys. Check the Key ID and Key Secret.' : msg); e.status = r.statusCode === 401 ? 400 : 502; return reject(e);
        }
        resolve(j);
      });
    });
    rq.on('error', () => { const e = new Error('Could not reach Razorpay. Check the internet and try again.'); e.status = 503; reject(e); });
    rq.setTimeout(20000, () => rq.destroy(new Error('timeout')));
    rq.end(body);
  });
}

const hmac = (secret, text) => crypto.createHmac('sha256', String(secret)).update(text).digest('hex');
function safeEq(a, b) { a = Buffer.from(String(a || '')); b = Buffer.from(String(b || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); }

// Checkout success: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
const checkPayment = (cfg, orderId, paymentId, signature) => !!(orderId && paymentId && signature) && safeEq(hmac(cfg.keySecret, orderId + '|' + paymentId), signature);
// Webhook: X-Razorpay-Signature = HMAC_SHA256(raw body, webhook secret)
const checkWebhook = (secret, raw, signature) => !!(secret && signature) && safeEq(hmac(secret, raw), signature);

module.exports = { call, checkPayment, checkWebhook, hmac, API };
