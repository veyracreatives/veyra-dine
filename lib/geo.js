/* City lookup for visitor stats. Free "IP to City Lite" database by DB-IP (https://db-ip.com, CC BY 4.0).
   The file (~130 MB) is downloaded once a month into data/geo/. The visitor's IP is only used for this lookup and is never saved.
   Small MaxMind-DB (.mmdb) reader with no dependencies; it reads the file in 4 KB pages so memory stays low. */
'use strict';
const fs = require('fs'), path = require('path'), https = require('https'), zlib = require('zlib'), net = require('net');

const MARK = Buffer.from([0xab, 0xcd, 0xef, 0x4d, 0x61, 0x78, 0x4d, 0x69, 0x6e, 0x64, 0x2e, 0x63, 0x6f, 0x6d]);
const PAGE = 4096, MAXPAGES = 3000;

function Reader(file) {
  const fd = fs.openSync(file, 'r'); const size = fs.fstatSync(fd).size; const pages = new Map();
  function page(n) { let p = pages.get(n); if (p) { pages.delete(n); pages.set(n, p); return p; } p = Buffer.alloc(PAGE); fs.readSync(fd, p, 0, PAGE, n * PAGE); pages.set(n, p); if (pages.size > MAXPAGES) pages.delete(pages.keys().next().value); return p; }
  const byte = o => page(Math.floor(o / PAGE))[o % PAGE];
  function bytes(o, n) { const b = Buffer.alloc(n); for (let i = 0; i < n; i++) b[i] = byte(o + i); return b; }
  // metadata: search the last 128 KB for the marker
  const tailLen = Math.min(size, 128 * 1024); const tail = Buffer.alloc(tailLen); fs.readSync(fd, tail, 0, tailLen, size - tailLen);
  const mi = tail.lastIndexOf(MARK); if (mi < 0) throw new Error('Not an mmdb file');
  const metaStart = size - tailLen + mi + MARK.length;
  function decode(base, off) { // returns [value, nextOffset]; base = start of data section for pointers
    const ctrl = byte(off++); let type = ctrl >> 5;
    if (type === 1) { const ss = (ctrl >> 3) & 3, v = ctrl & 7; let p;
      if (ss === 0) { p = (v << 8) | byte(off); off += 1; } else if (ss === 1) { p = ((v << 16) | (byte(off) << 8) | byte(off + 1)) + 2048; off += 2; }
      else if (ss === 2) { p = ((v << 24) | (byte(off) << 16) | (byte(off + 1) << 8) | byte(off + 2)) + 526336; off += 3; } else { p = bytes(off, 4).readUInt32BE(0); off += 4; }
      return [decode(base, base + p)[0], off]; }
    if (type === 0) { type = 7 + byte(off++); }
    let n = ctrl & 31;
    if (n === 29) n = 29 + byte(off++); else if (n === 30) { n = 285 + ((byte(off) << 8) | byte(off + 1)); off += 2; } else if (n === 31) { n = 65821 + ((byte(off) << 16) | (byte(off + 1) << 8) | byte(off + 2)); off += 3; }
    switch (type) {
      case 2: return [bytes(off, n).toString('utf8'), off + n];
      case 3: return [bytes(off, 8).readDoubleBE(0), off + 8];
      case 4: return [bytes(off, n), off + n];
      case 5: case 6: case 9: case 10: { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + byte(off + i); return [v, off + n]; }
      case 8: { let v = 0; for (let i = 0; i < n; i++) v = (v << 8) | byte(off + i); return [v, off + n]; }
      case 7: { const o = {}; for (let i = 0; i < n; i++) { const [k, a] = decode(base, off); const [v, b] = decode(base, a); o[k] = v; off = b; } return [o, off]; }
      case 11: { const a = []; for (let i = 0; i < n; i++) { const [v, b] = decode(base, off); a.push(v); off = b; } return [a, off]; }
      case 14: return [!!n, off];
      case 15: return [bytes(off, 4).readFloatBE(0), off + 4];
      default: return [null, off + n];
    }
  }
  const meta = decode(metaStart, metaStart)[0];
  const nodes = meta.node_count, rs = meta.record_size, nodeBytes = rs / 4, treeSize = nodeBytes * nodes, dataStart = treeSize + 16;
  function rec(node, bit) { const o = node * nodeBytes;
    if (rs === 24) { const b = o + bit * 3; return (byte(b) << 16) | (byte(b + 1) << 8) | byte(b + 2); }
    if (rs === 28) { if (bit === 0) return (((byte(o + 3) & 0xf0) << 20) | (byte(o) << 16) | (byte(o + 1) << 8) | byte(o + 2)) >>> 0; return (((byte(o + 3) & 0x0f) << 24) | (byte(o + 4) << 16) | (byte(o + 5) << 8) | byte(o + 6)) >>> 0; }
    return bytes(o + bit * 4, 4).readUInt32BE(0);
  }
  let v4start = 0; if (meta.ip_version === 6) { for (let i = 0; i < 96 && v4start < nodes; i++) v4start = rec(v4start, 0); }
  function lookup(ip) {
    let bits, node;
    if (net.isIPv4(ip)) { bits = Buffer.from(ip.split('.').map(Number)); node = v4start; }
    else if (net.isIPv6(ip)) { if (meta.ip_version !== 6) return null; bits = v6(ip); node = 0; } else return null;
    for (let i = 0; i < bits.length * 8 && node < nodes; i++) node = rec(node, (bits[i >> 3] >> (7 - (i & 7))) & 1);
    if (node <= nodes) return null;
    return decode(dataStart, dataStart + (node - nodes - 16))[0];
  }
  return { lookup, meta, close: () => fs.closeSync(fd) };
}
function v6(ip) { const [a, b] = ip.split('::'); const h = s => s ? s.split(':') : []; let L = h(a), R = h(b);
  const last = (R.length ? R : L)[(R.length ? R : L).length - 1] || ''; if (last.includes('.')) { const q = last.split('.').map(Number); const arr = R.length ? R : L; arr.splice(arr.length - 1, 1, ((q[0] << 8) | q[1]).toString(16), ((q[2] << 8) | q[3]).toString(16)); }
  const mid = Array(Math.max(0, 8 - L.length - R.length)).fill('0'); const all = ip.includes('::') ? L.concat(mid, R) : L;
  const buf = Buffer.alloc(16); all.forEach((g, i) => buf.writeUInt16BE(parseInt(g || '0', 16), i * 2)); return buf; }

/* ---- manager: download monthly, look up with a small cache ---- */
function Geo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'city.mmdb'); let rd = null, busy = false; const cache = new Map();
  function open() { try { if (fs.existsSync(file)) { const r = Reader(file); if (rd) rd.close(); rd = r; cache.clear(); } } catch (e) { console.error('geo open', e.message); } }
  function fetchTo(url, out, redirects) { return new Promise((ok, no) => { https.get(url, { headers: { 'user-agent': 'veyra-stats' } }, res => { if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (redirects || 0) < 3) { res.resume(); return fetchTo(res.headers.location, out, (redirects || 0) + 1).then(ok, no); } if (res.statusCode !== 200) { res.resume(); return no(new Error('HTTP ' + res.statusCode)); } const w = fs.createWriteStream(out); res.pipe(zlib.createGunzip()).on('error', no).pipe(w).on('finish', ok).on('error', no); }).on('error', no); }); }
  async function update() {
    if (busy) return; const age = fs.existsSync(file) ? Date.now() - fs.statSync(file).mtimeMs : Infinity; if (age < 30 * 864e5) return; busy = true;
    const d = new Date(); const tries = [0, 1].map(k => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 1)); return x.toISOString().slice(0, 7); });
    for (const m of tries) { const tmp = file + '.part'; try { await fetchTo(`https://download.db-ip.com/free/dbip-city-lite-${m}.mmdb.gz`, tmp); Reader(tmp).close(); fs.renameSync(tmp, file); open(); console.log('geo: city database', m, 'ready'); break; } catch (e) { try { fs.unlinkSync(tmp); } catch (_) {} console.error('geo download', m, e.message); } }
    busy = false;
  }
  open(); setTimeout(update, 20e3); setInterval(update, 864e5);
  function city(ip) {
    ip = String(ip || '').replace(/^::ffff:/, ''); if (!rd || !ip) return null; if (cache.has(ip)) return cache.get(ip);
    let r = null; try { const x = rd.lookup(ip); if (x) { const nm = o => o && o.names && (o.names.en || Object.values(o.names)[0]) || ''; r = { ct: nm(x.city), rg: nm((x.subdivisions || [])[0]), co: (x.country && x.country.iso_code) || '' }; } } catch (e) { r = null; }
    cache.set(ip, r); if (cache.size > 5000) cache.delete(cache.keys().next().value); return r;
  }
  return { city, ready: () => !!rd, update };
}
module.exports = { Geo, Reader };
