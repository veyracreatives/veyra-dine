// License keys. Veyra signs keys with a private key that is never shipped (see tools/make-license.js).
// The server only has the public key, so it can check a key but cannot make one.
'use strict';
const crypto = require('crypto');

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi539kK/pWCj3hfKhm0jEowvoE0uH8nZ+9rw2I3Skj8M=
-----END PUBLIC KEY-----`;

function verifyKey(raw) {
  const key = String(raw || '').replace(/\s+/g, '');
  const m = /^VD1-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(key);
  if (!m) return { ok: false, error: 'That does not look like a license key. Keys start with VD1-' };
  let ok = false;
  try { ok = crypto.verify(null, Buffer.from(m[1]), PUBLIC_KEY, Buffer.from(m[2], 'base64url')); } catch {}
  if (!ok) return { ok: false, error: 'This license key is not valid. Please check that it was copied fully.' };
  let payload;
  try { payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')); } catch { return { ok: false, error: 'This license key is not valid.' }; }
  if (payload.exp && Date.now() > Date.parse(payload.exp + 'T23:59:59Z')) return { ok: false, error: `This license ended on ${payload.exp}. Please renew it.` };
  return { ok: true, key, payload };
}

module.exports = { verifyKey };
