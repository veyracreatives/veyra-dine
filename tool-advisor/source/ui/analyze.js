// Feature detection from a triangulated B-rep (faces = triangle ranges).
// Everything is done in a frame where the chosen "top" direction is +Z.

const DEG = Math.PI / 180;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const r2 = v => Math.round(v * 100) / 100;

export const UP_ROT = {
  // maps model coords -> analysis coords (chosen up becomes +Z)
  '+Z': p => [p[0], p[1], p[2]],
  '-Z': p => [p[0], -p[1], -p[2]],
  '+Y': p => [p[0], -p[2], p[1]],
  '-Y': p => [p[0], p[2], -p[1]],
  '+X': p => [-p[2], p[1], p[0]],
  '-X': p => [p[2], p[1], -p[0]],
};

// symmetric 3x3 eigen (Jacobi). returns {vals:[asc], vecs:[[..],[..],[..]]}
function eig3(m) {
  let a = [m[0].slice(), m[1].slice(), m[2].slice()];
  let v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let it = 0; it < 50; it++) {
    let p = 0, q = 1, big = Math.abs(a[0][1]);
    if (Math.abs(a[0][2]) > big) { p = 0; q = 2; big = Math.abs(a[0][2]); }
    if (Math.abs(a[1][2]) > big) { p = 1; q = 2; big = Math.abs(a[1][2]); }
    if (big < 1e-12) break;
    const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
    const c = Math.cos(th), s = Math.sin(th);
    for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
    for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
    for (let k = 0; k < 3; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
  }
  const out = [0, 1, 2].map(i => ({ val: a[i][i], vec: [v[0][i], v[1][i], v[2][i]] })).sort((x, y) => x.val - y.val);
  return { vals: out.map(o => o.val), vecs: out.map(o => o.vec) };
}

function perpBasis(a) {
  const h = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(a, h)); const w = cross(a, u); return [u, w];
}

const AXES = { '+X': [1, 0, 0], '-X': [-1, 0, 0], '+Y': [0, 1, 0], '-Y': [0, -1, 0], '+Z': [0, 0, 1], '-Z': [0, 0, -1] };
export function axisName(v, tol = 0.999) {
  for (const [k, a] of Object.entries(AXES)) if (dot(v, a) > tol) return k;
  return null;
}
export const SIDE_NAME = { '+Z': 'Top', '-Z': 'Bottom', '+X': 'Right side', '-X': 'Left side', '+Y': 'Back side', '-Y': 'Front side' };

// ---------- geometry building ----------
// geo: { pos: Float32Array (xyz), nrm: Float32Array, tri: Uint32Array (vertex ids), faces: [{first,last}] }
export function rotateGeo(geo, up) {
  const f = UP_ROT[up] || UP_ROT['+Z'];
  const pos = new Float32Array(geo.pos.length), nrm = new Float32Array(geo.nrm.length);
  for (let i = 0; i < geo.pos.length; i += 3) {
    const p = f([geo.pos[i], geo.pos[i + 1], geo.pos[i + 2]]); pos[i] = p[0]; pos[i + 1] = p[1]; pos[i + 2] = p[2];
    const n = f([geo.nrm[i], geo.nrm[i + 1], geo.nrm[i + 2]]); nrm[i] = n[0]; nrm[i + 1] = n[1]; nrm[i + 2] = n[2];
  }
  return { ...geo, pos, nrm };
}

// For STL (no faces): split into smooth regions by region growing.
export function segmentMesh(pos) {
  // pos is non-indexed triangle soup. weld vertices
  const key = (i) => `${Math.round(pos[i] * 1000)},${Math.round(pos[i + 1] * 1000)},${Math.round(pos[i + 2] * 1000)}`;
  const vmap = new Map(); const triV = new Uint32Array(pos.length / 3); const vpos = [];
  for (let i = 0; i < pos.length / 3; i++) {
    const k = key(i * 3); let id = vmap.get(k);
    if (id === undefined) { id = vpos.length / 3; vmap.set(k, id); vpos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); }
    triV[i] = id;
  }
  const nt = triV.length / 3; const tn = [];
  for (let t = 0; t < nt; t++) {
    const a = triV[t * 3] * 3, b = triV[t * 3 + 1] * 3, c = triV[t * 3 + 2] * 3;
    const A = [vpos[a], vpos[a + 1], vpos[a + 2]], B = [vpos[b], vpos[b + 1], vpos[b + 2]], C = [vpos[c], vpos[c + 1], vpos[c + 2]];
    tn.push(norm(cross(sub(B, A), sub(C, A))));
  }
  const edges = new Map();
  for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) {
    const u = triV[t * 3 + e], w = triV[t * 3 + (e + 1) % 3]; const k = u < w ? u + '_' + w : w + '_' + u;
    (edges.get(k) || edges.set(k, []).get(k)).push(t);
  }
  const nb = Array.from({ length: nt }, () => []);
  for (const ts of edges.values()) if (ts.length === 2) { nb[ts[0]].push(ts[1]); nb[ts[1]].push(ts[0]); }
  const label = new Int32Array(nt).fill(-1); let L = 0; const regions = [];
  for (let s = 0; s < nt; s++) {
    if (label[s] >= 0) continue;
    const stack = [s]; label[s] = L; const tris = [];
    const flatSeed = tn[s];
    let planar = true;
    while (stack.length) {
      const t = stack.pop(); tris.push(t);
      for (const q of nb[t]) {
        if (label[q] >= 0) continue;
        const d = dot(tn[t], tn[q]);
        // planar regions grow only with same normal; curved regions grow with smooth neighbour (< 25°)
        if (d > Math.cos(0.5 * DEG) && (!planar || dot(tn[q], flatSeed) > Math.cos(0.5 * DEG))) { label[q] = L; stack.push(q); }
        else if (d > Math.cos(25 * DEG) && d < Math.cos(0.5 * DEG) && tris.length < 2) { planar = false; label[q] = L; stack.push(q); }
        else if (!planar && d > Math.cos(25 * DEG)) { label[q] = L; stack.push(q); }
      }
    }
    regions.push(tris); L++;
  }
  // build per-face vertex arrays (non-shared, facet normals)
  const P = [], N = [], T = [], faces = [];
  let tcount = 0;
  for (const tris of regions) {
    const first = tcount;
    for (const t of tris) {
      for (let e = 0; e < 3; e++) { const v = triV[t * 3 + e] * 3; P.push(vpos[v], vpos[v + 1], vpos[v + 2]); N.push(...tn[t]); T.push(P.length / 3 - 1); }
      tcount++;
    }
    faces.push({ first, last: tcount - 1 });
  }
  return { pos: new Float32Array(P), nrm: new Float32Array(N), tri: new Uint32Array(T), faces, approx: true };
}

// ---------- per-face surface fitting ----------
function faceData(geo, f) {
  const seen = new Set(); const P = [], Nn = []; let area = 0; let nsum = [0, 0, 0];
  for (let t = f.first; t <= f.last; t++) {
    const ids = [geo.tri[t * 3], geo.tri[t * 3 + 1], geo.tri[t * 3 + 2]];
    const v = ids.map(i => [geo.pos[i * 3], geo.pos[i * 3 + 1], geo.pos[i * 3 + 2]]);
    const c = cross(sub(v[1], v[0]), sub(v[2], v[0])); const a = len(c) / 2; area += a;
    for (const i of ids) {
      if (seen.has(i)) continue; seen.add(i);
      P.push([geo.pos[i * 3], geo.pos[i * 3 + 1], geo.pos[i * 3 + 2]]);
      Nn.push(norm([geo.nrm[i * 3], geo.nrm[i * 3 + 1], geo.nrm[i * 3 + 2]]));
    }
    nsum = add(nsum, mul(c, 0.5));
  }
  return { P, N: Nn, area, nsum };
}

function fitFace(geo, f, idx) {
  const { P, N, area, nsum } = faceData(geo, f);
  const box = bboxOf(P);
  const base = { idx, area, box, n: P.length };
  if (P.length < 3) return { ...base, kind: 'tiny' };
  // plane?
  const nm = norm(nsum);
  let maxDev = 0; for (const n of N) maxDev = Math.max(maxDev, 1 - dot(n, nm));
  if (maxDev < 1 - Math.cos(2 * DEG)) {
    let d = 0; for (const p of P) d += dot(p, nm); d /= P.length;
    return { ...base, kind: 'plane', normal: nm, d };
  }
  // cylinder? normals perpendicular to an axis
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const n of N) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i][j] += n[i] * n[j] / N.length;
  const e = eig3(M);
  let axis = norm(e.vecs[0]);
  let maxAx = 0; for (const n of N) maxAx = Math.max(maxAx, Math.abs(dot(n, axis)));
  if (maxAx < 0.05) {
    const snapped = axisName(axis, 0.995); if (snapped) axis = AXES[snapped].map(Math.abs).every((x, i) => true) ? (dot(axis, AXES[snapped]) > 0 ? AXES[snapped] : mul(AXES[snapped], -1)) : axis;
    // canonical axis direction (positive)
    if (axis[0] + axis[1] + axis[2] < 0) axis = mul(axis, -1);
    const pp = P.map(p => sub(p, mul(axis, dot(p, axis))));
    const k = kasa(pp, axis);
    if (k) {
      const { c, r } = k;
      let res = 0, conv = 0;
      for (let i = 0; i < pp.length; i++) { res = Math.max(res, Math.abs(len(sub(pp[i], c)) - r)); conv += dot(sub(pp[i], c), N[i]) > 0 ? 1 : -1; }
      if (res < 0.03 * r + 0.03) {
        const [u, w] = perpBasis(axis);
        const angs = pp.map(p => { const d = sub(p, c); return Math.atan2(dot(d, w), dot(d, u)); });
        const ts = P.map(p => dot(p, axis));
        return { ...base, kind: 'cyl', axis, center: c, r, concave: conv < 0, angs, pp, tmin: Math.min(...ts), tmax: Math.max(...ts), span: angSpan(angs) };
      }
    }
  }
  // cone? normals at constant angle to axis
  const nb = N.reduce((s, n) => add(s, n), [0, 0, 0]).map(x => x / N.length);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const n of N) { const d = sub(n, nb); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j] / N.length; }
  const ec = eig3(C); let ca = norm(ec.vecs[0]);
  const dots = N.map(n => dot(n, ca)); const md = dots.reduce((s, x) => s + x, 0) / dots.length;
  const sd = Math.sqrt(dots.reduce((s, x) => s + (x - md) ** 2, 0) / dots.length);
  if (sd < 0.02 && Math.abs(md) > 0.05 && Math.abs(md) < 0.995) {
    if (ca[0] + ca[1] + ca[2] < 0) ca = mul(ca, -1);
    const sn = axisName(ca, 0.995); if (sn) ca = AXES[sn][0] + AXES[sn][1] + AXES[sn][2] > 0 ? AXES[sn] : mul(AXES[sn], -1);
    const ts = P.map(p => dot(p, ca));
    const pp = P.map(p => sub(p, mul(ca, dot(p, ca))));
    const kk = kasa(pp, ca); const pm = kk ? kk.c : pp.reduce((s, p) => add(s, p), [0, 0, 0]).map(x => x / pp.length);
    const rads = pp.map(p => len(sub(p, pm)));
    return { ...base, kind: 'cone', axis: ca, center: pm, nz: nb[2], halfAngle: Math.asin(Math.min(1, Math.abs(md))) / DEG, rmin: Math.min(...rads), rmax: Math.max(...rads), tmin: Math.min(...ts), tmax: Math.max(...ts), concaveHint: md };
  }
  // freeform: estimate smallest curvature radius from vertex pairs
  const radii = [];
  for (let t = f.first; t <= f.last; t++) {
    for (let e = 0; e < 3; e++) {
      const i = geo.tri[t * 3 + e], j = geo.tri[t * 3 + (e + 1) % 3];
      const pi = [geo.pos[i * 3], geo.pos[i * 3 + 1], geo.pos[i * 3 + 2]], pj = [geo.pos[j * 3], geo.pos[j * 3 + 1], geo.pos[j * 3 + 2]];
      const ni = norm([geo.nrm[i * 3], geo.nrm[i * 3 + 1], geo.nrm[i * 3 + 2]]), nj = norm([geo.nrm[j * 3], geo.nrm[j * 3 + 1], geo.nrm[j * 3 + 2]]);
      const dn = len(sub(ni, nj)); if (dn > 0.02) radii.push(len(sub(pi, pj)) / dn);
    }
  }
  radii.sort((a, b) => a - b);
  const rmin = radii.length ? radii[Math.floor(radii.length * 0.1)] : 0;
  // concave if normals point toward the curvature centre on average
  let conc = 0;
  for (let k = 0; k < Math.min(P.length, 200); k++) { const d = sub(P[k], box.c); conc += dot(d, N[k]) < 0 ? 1 : -1; }
  return { ...base, kind: 'free', rmin, normal: nm };
}

function angSpan(angs) {
  if (angs.length < 2) return 0;
  const a = angs.slice().sort((x, y) => x - y);
  let gap = a[0] + 2 * Math.PI - a[a.length - 1];
  for (let i = 1; i < a.length; i++) gap = Math.max(gap, a[i] - a[i - 1]);
  return (2 * Math.PI - gap) / DEG;
}

function bboxOf(P) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const p of P) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p[i]); mx[i] = Math.max(mx[i], p[i]); }
  return { min: mn, max: mx, c: mn.map((v, i) => (v + mx[i]) / 2), size: mn.map((v, i) => mx[i] - v) };
}

// ---------- ray casting (accessibility) ----------
function makeRaycaster(geo) {
  const nt = geo.tri.length / 3;
  const T = new Float32Array(nt * 9);
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) { const i = geo.tri[t * 3 + k]; T[t * 9 + k * 3] = geo.pos[i * 3]; T[t * 9 + k * 3 + 1] = geo.pos[i * 3 + 1]; T[t * 9 + k * 3 + 2] = geo.pos[i * 3 + 2]; }
  return function hits(o, d) {
    // returns true if the ray o + s d (s > 0) hits any triangle
    for (let t = 0; t < nt; t++) {
      const b = t * 9;
      const e1 = [T[b + 3] - T[b], T[b + 4] - T[b + 1], T[b + 5] - T[b + 2]];
      const e2 = [T[b + 6] - T[b], T[b + 7] - T[b + 1], T[b + 8] - T[b + 2]];
      const p = cross(d, e2); const det = dot(e1, p);
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det; const s = [o[0] - T[b], o[1] - T[b + 1], o[2] - T[b + 2]];
      const u = dot(s, p) * inv; if (u < 0 || u > 1) continue;
      const q = cross(s, e1); const v = dot(d, q) * inv; if (v < 0 || u + v > 1) continue;
      if (dot(e2, q) * inv > 1e-4) return true;
    }
    return false;
  };
}

// ---------- main ----------
export function analyzePart(geo0, up = '+Z') {
  const geo = rotateGeo(geo0, up);
  const faces = geo.faces.map((f, i) => fitFace(geo, f, i));
  const allP = []; for (let i = 0; i < geo.pos.length; i += 3) allP.push([geo.pos[i], geo.pos[i + 1], geo.pos[i + 2]]);
  const bb = bboxOf(allP);
  const hits = makeRaycaster(geo);
  const tolPos = Math.max(0.01, Math.max(...bb.size) * 1e-4);

  // --- merge cylinder pieces (same axis line + radius) ---
  const cyls = faces.filter(f => f.kind === 'cyl');
  const groups = [];
  for (const c of cyls) {
    let g = groups.find(g => g.concave === c.concave && Math.abs(Math.abs(dot(g.axis, c.axis)) - 1) < 1e-3 && Math.abs(g.r - c.r) < 0.02 + 0.002 * c.r && lineDist(g.center, g.axis, c.center) < 0.05 + 0.002 * c.r && c.tmin <= g.tmax + 0.05 && c.tmax >= g.tmin - 0.05);
    if (!g) { g = { axis: c.axis, center: c.center, r: c.r, concave: c.concave, faces: [], angs: [], tmin: c.tmin, tmax: c.tmax }; groups.push(g); }
    g.faces.push(c.idx); g.angs.push(...c.angs); (g.pp = g.pp || []).push(...c.pp); g.tmin = Math.min(g.tmin, c.tmin); g.tmax = Math.max(g.tmax, c.tmax);
  }
  for (const g of groups) { const k = kasa(g.pp, g.axis); if (k) { g.r = k.r; g.center = k.c; const [u, w] = perpBasis(g.axis); g.angs = g.pp.map(p => { const d = sub(p, g.center); return Math.atan2(dot(d, w), dot(d, u)); }); } delete g.pp; g.span = angSpan(g.angs); g.full = g.span > 340; g.axisName = axisName(g.axis, 0.999); delete g.angs; }

  // --- holes: concave full cylinders, stacked coaxially ---
  const holeSegs = groups.filter(g => g.concave && g.full);
  const stacks = [];
  for (const s of holeSegs) {
    let st = stacks.find(st => Math.abs(Math.abs(dot(st.axis, s.axis)) - 1) < 1e-3 && lineDist(st.center, st.axis, s.center) < 0.05 && s.tmin <= st.tmax + 0.05 && s.tmax >= st.tmin - 0.05);
    if (!st) { st = { axis: s.axis, center: s.center, segs: [], tmin: s.tmin, tmax: s.tmax }; stacks.push(st); }
    st.segs.push(s); st.tmin = Math.min(st.tmin, s.tmin); st.tmax = Math.max(st.tmax, s.tmax);
  }
  const cones = faces.filter(f => f.kind === 'cone');
  const holes = [];
  for (const st of stacks) {
    const a = st.axis; const cBase = sub(st.center, mul(a, dot(st.center, a)));
    const pt = t => add(cBase, mul(a, t));
    // include coaxial cones (drill point / countersink)
    const maxR = Math.max(...st.segs.map(x => x.r));
    const cc = cones.filter(c => c.rmin <= maxR + 0.1 && Math.abs(Math.abs(dot(c.axis, a)) - 1) < 1e-3 && lineDist(cBase, a, c.center) < 0.1 && c.tmin <= st.tmax + 0.1 && c.tmax >= st.tmin - 0.1);
    let tmin = st.tmin, tmax = st.tmax;
    for (const c of cc) { tmin = Math.min(tmin, c.tmin); tmax = Math.max(tmax, c.tmax); }
    const e = 0.05;
    const openPlus = !hits(pt(tmax + e), a);
    const openMinus = !hits(pt(tmin - e), mul(a, -1));
    const segs = st.segs.sort((x, y) => x.tmin - y.tmin);
    let entry; // direction tool comes from (vector pointing out of hole)
    if (openPlus && openMinus) {
      // through: enter from side with bigger segment (counterbore) or the +Z / most "up" side
      const big = segs.reduce((m, s) => s.r > m.r ? s : m, segs[0]);
      const small = segs.reduce((m, s) => s.r < m.r ? s : m, segs[0]);
      if (big !== small && big.r - small.r > 0.2) entry = (big.tmin + big.tmax) / 2 > (small.tmin + small.tmax) / 2 ? a : mul(a, -1);
      else entry = a[2] < -0.5 ? mul(a, -1) : a;
      if (big === small && a[2] > -0.5 && a[2] < 0.5) entry = a; // side through hole: either side
    } else if (openPlus) entry = a; else if (openMinus) entry = mul(a, -1); else entry = null;
    const dirName = entry ? axisName(entry, 0.999) : null;
    const through = openPlus && openMinus;
    // order segments from entry
    const tEntry = entry && dot(entry, a) > 0 ? tmax : tmin;
    const ordered = segs.map(s => ({ dia: r2(2 * s.r), depth: r2(Math.abs((dot(entry || a, a) > 0 ? tmax - s.tmin : s.tmax - tmin))), from: r2(Math.abs((dot(entry || a, a) > 0 ? tmax - s.tmax : s.tmin - tmin))), faces: s.faces }))
      .sort((x, y) => x.from - y.from);
    const csk = cc.filter(c => { const nearEntry = Math.abs((dot(entry || a, a) > 0 ? c.tmax : c.tmin) - tEntry) < 0.1; return nearEntry && ordered.length && c.rmax > ordered[0].dia / 2 + 0.05; });
    const tip = cc.find(c => !csk.includes(c));
    const main = ordered[ordered.length - 1] || ordered[0];
    const minDia = Math.min(...ordered.map(o => o.dia));
    const totalDepth = r2(tmax - tmin);
    const loc = pt(tEntry);
    holes.push({
      id: 'H' + (holes.length + 1), axis: a, entry, dir: dirName, through, blocked: !entry,
      dia: minDia, depth: through ? totalDepth : r2(ordered.reduce((m, o) => Math.max(m, o.depth), 0)), totalDepth,
      segs: ordered, cbore: ordered.length > 1 ? ordered[0] : null,
      csk: csk.length ? { dia: r2(2 * Math.max(...csk.map(c => c.rmax))), angle: r2(2 * (90 - csk[0].halfAngle)) } : null,
      drillPoint: !!tip, pos: loc.map(r2), angled: !dirName,
      faces: [...ordered.flatMap(o => o.faces), ...cc.map(c => c.idx)],
    });
  }
  // group identical holes
  // --- corners & fillets ---
  const partials = groups.filter(g => !(g.concave && g.full));
  const corners = []; const fillets = []; const bosses = [];
  for (const g of partials) {
    const an = g.axisName;
    const vertical = an === '+Z' || an === '-Z';
    const item = { r: r2(g.r), axis: an || 'angled', faces: g.faces, zmin: 0, zmax: 0, center: g.center, span: r2(g.span), concave: g.concave };
    if (vertical) { item.zmin = r2(g.tmin); item.zmax = r2(g.tmax); }
    if (g.concave) (vertical ? corners : fillets).push({ ...item, type: vertical ? 'corner' : 'floor/edge fillet' });
    else if (g.full) bosses.push({ ...item, type: 'round boss / outside diameter', dia: r2(2 * g.r) });
    else fillets.push({ ...item, type: vertical ? 'outside corner' : 'rounded edge', convex: true });
  }

  // --- planar faces ---
  const planes = faces.filter(f => f.kind === 'plane');
  const zTop = bb.max[2], zBot = bb.min[2];
  const floors = []; const walls = []; const angled = []; const chamfers = [];
  for (const p of planes) {
    const an = axisName(p.normal, 0.9995);
    if (an === '+Z' || an === '-Z') {
      const z = p.d * (an === '+Z' ? 1 : -1);
      const atBoundary = an === '+Z' ? Math.abs(z - zTop) < tolPos * 10 : Math.abs(z - zBot) < tolPos * 10;
      // accessible from that direction?
      const probe = [p.box.c[0], p.box.c[1], z];
      const dir = AXES[an];
      const open = !hits(add(probe, mul(dir, 0.02)), dir);
      floors.push({ dir: an, z: r2(z), depth: r2(an === '+Z' ? zTop - z : z - zBot), area: p.area, box: p.box, boundary: atBoundary, open, idx: p.idx,
        touchesSide: p.box.min[0] <= bb.min[0] + 0.05 || p.box.max[0] >= bb.max[0] - 0.05 || p.box.min[1] <= bb.min[1] + 0.05 || p.box.max[1] >= bb.max[1] - 0.05 });
    } else if (an) {
      const k = an[1] === 'X' ? 0 : 1; const sgn = an[0] === '+' ? 1 : -1; const v = p.d * sgn;
      const boundary = sgn > 0 ? Math.abs(v - bb.max[k]) < 0.05 : Math.abs(v - bb.min[k]) < 0.05;
      walls.push({ dir: an, area: p.area, box: p.box, boundary, idx: p.idx });
    } else {
      const tilt = Math.acos(Math.min(1, Math.abs(p.normal[2]))) / DEG;
      const minSide = Math.min(...[0, 1, 2].map(i => p.box.size[i]).filter(s => s > 0.001));
      const isCham = Math.abs(tilt - 45) < 3 && minSide < Math.max(3, 0.05 * Math.max(...bb.size)) || (Math.abs(tilt - 90) < 1 && Math.abs(Math.abs(p.normal[0]) - Math.abs(p.normal[1])) < 0.05 && minSide < 3);
      (isCham ? chamfers : angled).push({ normal: p.normal.map(r2), tilt: r2(tilt), area: p.area, idx: p.idx, size: r2(Math.min(...p.box.size.filter(s => s > 0.01)) * Math.SQRT2), dir: p.normal[2] > 0.3 ? '+Z' : p.normal[2] < -0.3 ? '-Z' : null });
    }
  }
  // chamfer cones (on hole edges / round edges) that are not part of holes
  const holeFaceSet = new Set(holes.flatMap(h => h.faces));
  for (const c of cones) if (!holeFaceSet.has(c.idx) && (c.rmax - c.rmin) < 5) chamfers.push({ tilt: r2(90 - c.halfAngle), area: c.area, idx: c.idx, size: r2((c.rmax - c.rmin) * Math.SQRT2), dir: Math.abs(c.tmax - zTop) < 0.05 ? '+Z' : Math.abs(c.tmin - zBot) < 0.05 ? '-Z' : (c.nz > 0 ? '+Z' : '-Z'), round: true });

  const free = faces.filter(f => f.kind === 'free');
  const surfaces = free.map(f => ({ idx: f.idx, rmin: r2(f.rmin), area: f.area, dir: f.normal[2] > 0.2 ? '+Z' : f.normal[2] < -0.2 ? '-Z' : axisName(f.normal, 0.7) }));

  // --- pockets / steps: group floors by side + depth ---
  const pockets = [];
  const inHole = fl => holes.some(h => { const mx = Math.max(...h.segs.map(x => x.dia)); return lineDist(h.pos, h.axis, fl.box.c) < 0.2 && Math.max(fl.box.size[0], fl.box.size[1]) <= mx + 0.2; });
  for (const fl of floors.filter(f => !f.boundary && f.depth > 0.05 && !inHole(f))) {
    let pk = pockets.find(p => p.dir === fl.dir && Math.abs(p.depth - fl.depth) < 0.02 && boxGap(p.box, fl.box) < 1);
    if (!pk) { pk = { id: '', dir: fl.dir, depth: fl.depth, z: fl.z, box: { min: fl.box.min.slice(), max: fl.box.max.slice() }, faces: [], open: fl.open, area: 0, touchesSide: fl.touchesSide }; pockets.push(pk); }
    pk.faces.push(fl.idx); pk.area += fl.area; pk.touchesSide = pk.touchesSide || fl.touchesSide;
    for (let i = 0; i < 3; i++) { pk.box.min[i] = Math.min(pk.box.min[i], fl.box.min[i]); pk.box.max[i] = Math.max(pk.box.max[i], fl.box.max[i]); }
  }
  pockets.sort((a, b) => b.area - a.area).forEach((p, i) => {
    p.id = 'P' + (i + 1);
    p.width = r2(Math.min(p.box.max[0] - p.box.min[0], p.box.max[1] - p.box.min[1]));
    p.length = r2(Math.max(p.box.max[0] - p.box.min[0], p.box.max[1] - p.box.min[1]));
    // floor face box = floor only; pockets with fillets grow; include matching corners
    const zA = p.dir === '+Z' ? p.z : bb.min[2], zB = p.dir === '+Z' ? bb.max[2] : p.z;
    const myCorners = corners.filter(c => c.zmin < zB - 0.01 && c.zmax > zA + 0.01 && c.center[0] > p.box.min[0] - c.r - 1 && c.center[0] < p.box.max[0] + c.r + 1 && c.center[1] > p.box.min[1] - c.r - 1 && c.center[1] < p.box.max[1] + c.r + 1);
    p.cornerR = myCorners.length ? Math.min(...myCorners.map(c => c.r)) : null;
    p.width = r2(p.width + (p.cornerR ? 0 : 0));
    const ff = fillets.filter(f => f.concave && Math.abs((f.center[2] ?? 0)) >= 0 && f.axis !== 'angled');
    p.floorR = null;
    for (const f of ff) { // horizontal concave cylinder whose centre is about r above this floor
      const g = groups.find(g => g.faces === f.faces); if (!g) continue;
      const cz = g.center[2];
      if (Math.abs(Math.abs(cz - p.z) - f.r) < 0.05 && cz > p.box.min[2] - 5) p.floorR = p.floorR == null ? f.r : Math.min(p.floorR, f.r);
    }
    p.kind = p.touchesSide ? 'Step / open shoulder' : 'Closed pocket';
    if (!p.touchesSide && p.width < p.length / 3) p.kind = 'Slot';
  });

  // --- round part? ---
  const H = bb.size[2];
  const bigRound = bosses.find(b => b.axis === '+Z' || b.axis === '-Z') && bosses.filter(b => (b.axis === '+Z' || b.axis === '-Z')).some(b => Math.abs(2 * b.r - Math.max(bb.size[0], bb.size[1])) < 0.5);

  // --- sides that need machining ---
  const sideFeat = {};
  const addSide = (d, what) => { if (!d) return; (sideFeat[d] = sideFeat[d] || []).push(what); };
  holes.forEach(h => addSide(h.dir, h.id));
  pockets.forEach(p => addSide(p.dir, p.id));
  chamfers.forEach(c => c.dir && addSide(c.dir, 'chamfer'));
  // non-boundary walls facing sideways with no floor = side features (e.g. side slots)
  const minCorner = corners.length ? Math.min(...corners.map(c => c.r)) : null;
  const minFillet = Math.min(...[...fillets.filter(f => f.concave).map(f => f.r), ...surfaces.map(s => s.rmin).filter(x => x > 0)], Infinity);

  return {
    bbox: { min: bb.min.map(r2), max: bb.max.map(r2), size: bb.size.map(r2) },
    faceCount: faces.length, approx: !!geo.approx,
    faceKinds: faces.map(f => f.kind),
    holes, pockets, corners, fillets, bosses, chamfers, angled, surfaces, floors, walls,
    minCorner, minFillet: minFillet === Infinity ? null : r2(minFillet),
    roundPart: !!bigRound, sides: sideFeat,
    up,
  };
}

function lineDist(c, a, p) { const d = sub(p, c); const t = dot(d, a); return len(sub(d, mul(a, t))); }
function boxGap(a, b) { let g = 0; for (let i = 0; i < 2; i++) g = Math.max(g, a.min[i] - b.max[i], b.min[i] - a.max[i]); return g; }

// algebraic circle fit of points lying in planes perpendicular to axis
function kasa(pp, axis) {
  if (!pp || pp.length < 3) return null;
  const [u, w] = perpBasis(axis);
  const o = pp[0];
  let Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0, Sz = 0, Sxz = 0, Syz = 0; const n = pp.length;
  for (const p of pp) { const d = sub(p, o); const x = dot(d, u), y = dot(d, w), z = x * x + y * y; Sx += x; Sy += y; Sxx += x * x; Syy += y * y; Sxy += x * y; Sz += z; Sxz += x * z; Syz += y * z; }
  // solve [Sxx Sxy Sx; Sxy Syy Sy; Sx Sy n] [D E F] = -[Sxz Syz Sz]
  const A = [[Sxx, Sxy, Sx], [Sxy, Syy, Sy], [Sx, Sy, n]], b = [-Sxz, -Syz, -Sz];
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D0 = det(A); if (Math.abs(D0) < 1e-12) return null;
  const sol = [0, 1, 2].map(k => det(A.map((row, i) => row.map((v, j) => j === k ? b[i] : v))) / D0);
  const cx = -sol[0] / 2, cy = -sol[1] / 2; const r = Math.sqrt(Math.max(0, cx * cx + cy * cy - sol[2]));
  if (!isFinite(r) || r <= 0) return null;
  return { c: add(o, add(mul(u, cx), mul(w, cy))), r };
}
