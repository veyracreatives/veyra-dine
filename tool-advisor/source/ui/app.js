import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { STLLoader } from './vendor/STLLoader.js';
import { analyzePart, rotateGeo, segmentMesh, SIDE_NAME } from './analyze.js';
import { makePlan, toolLabel } from './plan.js';
import { MATERIALS, TOOL_TYPES, DEFAULT_SETTINGS, defaultLibrary } from './data.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};

let settings = { ...DEFAULT_SETTINGS, ...store.get('vta.settings', {}) };
let library = store.get('vta.library', null) || defaultLibrary();
let state = { name: '', geo: null, an: null, plan: null, tapped: {}, sel: null };

// ---------------- 3D viewer ----------------
const host = $('#viewer');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
host.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(1, -1.5, 2); scene.add(dl);
const dl2 = new THREE.DirectionalLight(0xffffff, 0.5); dl2.position.set(-1, 1, -0.5); scene.add(dl2);
let partGroup = new THREE.Group(), clampGroup = new THREE.Group(), grid = null;
scene.add(partGroup, clampGroup);
let mesh = null, faceOfTri = null, baseColors = null;

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
  camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);
(function loop() { requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); })();

const COL = { base: [0.72, 0.75, 0.8], hole: [0.23, 0.51, 0.96], tap: [0.66, 0.33, 0.97], floor: [0.13, 0.77, 0.37], corner: [0.94, 0.27, 0.27], fillet: [0.92, 0.7, 0.03], cham: [0.02, 0.71, 0.83], sel: [1, 0.48, 0.1] };

function buildMesh(geo) {
  partGroup.clear();
  const nt = geo.tri.length / 3;
  const P = new Float32Array(nt * 9), N = new Float32Array(nt * 9);
  faceOfTri = new Int32Array(nt);
  geo.faces.forEach((f, fi) => { for (let t = f.first; t <= f.last; t++) faceOfTri[t] = fi; });
  for (let t = 0; t < nt; t++) for (let k = 0; k < 3; k++) {
    const i = geo.tri[t * 3 + k];
    for (let c = 0; c < 3; c++) { P[t * 9 + k * 3 + c] = geo.pos[i * 3 + c]; N[t * 9 + k * 3 + c] = geo.nrm[i * 3 + c]; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  if (geo.approx) g.computeVertexNormals(); else g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nt * 9), 3));
  mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.55, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  partGroup.add(mesh);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), new THREE.LineBasicMaterial({ color: 0x0b0e13, transparent: true, opacity: 0.55 }));
  partGroup.add(edges);
  g.computeBoundingBox();
  const bb = g.boundingBox, size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  if (grid) scene.remove(grid);
  const gs = Math.max(size.x, size.y) * 2.2;
  grid = new THREE.GridHelper(gs, 22, 0x3a4458, 0x232b38); grid.rotation.x = Math.PI / 2; grid.position.set(c.x, c.y, bb.min.z - 0.01); scene.add(grid);
  const axes = new THREE.AxesHelper(Math.max(size.x, size.y, size.z) * 0.25); axes.position.set(bb.min.x - size.x * 0.1, bb.min.y - size.y * 0.1, bb.min.z); partGroup.add(axes);
  controls.target.copy(c);
  setView('iso');
}

function setView(v) {
  if (!mesh) return;
  const bb = new THREE.Box3().setFromObject(partGroup); const c = bb.getCenter(new THREE.Vector3()); const r = bb.getSize(new THREE.Vector3()).length() * 1.35;
  const dirs = { iso: [1, -1.3, 0.95], top: [0, -0.0001, 1], front: [0, -1, 0.0001], right: [1, 0, 0.0001] };
  const d = new THREE.Vector3(...dirs[v]).normalize();
  camera.position.copy(c).addScaledVector(d, r / Math.tan(camera.fov * Math.PI / 360) * 0.5);
  camera.near = r / 200; camera.far = r * 50; camera.updateProjectionMatrix();
  controls.target.copy(c); controls.update();
}

function faceCategories() {
  const an = state.an; const cat = new Map();
  if (!an) return cat;
  an.fillets.forEach(f => f.faces.forEach(i => cat.set(i, 'fillet')));
  an.surfaces.forEach(s => cat.set(s.idx, 'fillet'));
  an.corners.forEach(c => c.faces.forEach(i => cat.set(i, 'corner')));
  an.chamfers.forEach(c => cat.set(c.idx, 'cham'));
  an.pockets.forEach(p => p.faces.forEach(i => cat.set(i, 'floor')));
  (state.plan?.holes || an.holes).forEach(h => h.faces.forEach(i => cat.set(i, h.tap ? 'tap' : 'hole')));
  return cat;
}

function paint() {
  if (!mesh) return;
  const colors = mesh.geometry.attributes.color.array;
  const cat = $('#chkColors').checked ? faceCategories() : new Map();
  const sel = new Set(state.sel || []);
  for (let t = 0; t < faceOfTri.length; t++) {
    const f = faceOfTri[t];
    const c = sel.has(f) ? COL.sel : COL[cat.get(f) || 'base'];
    for (let k = 0; k < 3; k++) colors.set(c, t * 9 + k * 3);
  }
  mesh.geometry.attributes.color.needsUpdate = true;
}

// --------------- clamping visual ---------------
function drawClamps() {
  clampGroup.clear();
  const v = $('#selClampView').value; if (!v || !state.plan || !mesh) return;
  const s = state.plan.setups[+v]; const z = s?.clampZones; if (!z) return;
  const bb = state.an.bbox; const st = state.plan.stock; const cx = (bb.min[0] + bb.max[0]) / 2, cy = (bb.min[1] + bb.max[1]) / 2;
  const box = (w, d, h, x, y, zc, color, op = 0.45) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: op, depthWrite: false })); m.position.set(x, y, zc); clampGroup.add(m); const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })); e.position.copy(m.position); clampGroup.add(e); return m; };
  const H = bb.size[2];
  const top = bb.max[2] + settings.allowTop;
  const grip = settings.gripExtra;
  if (z.type === 'vise' || z.type === 'vise2') {
    const flipped = z.type === 'vise2';
    const stockBot = flipped ? bb.min[2] : bb.min[2] - settings.allowTop - grip;
    const stockTop = flipped ? bb.max[2] : top;
    // stock (setup 1 only)
    if (!flipped) box(st.L, st.W, stockTop - stockBot, cx, cy, (stockTop + stockBot) / 2, 0x9fb4d0, 0.12);
    else box(bb.size[0], bb.size[1], settings.allowTop + grip, cx, cy, bb.min[2] - (settings.allowTop + grip) / 2, 0x9fb4d0, 0.15);
    const jawH = 40, jawT = 12;
    const gripLen = z.gripAxis === 'Y' ? (flipped ? bb.size[0] : st.L) + 30 : jawT;
    const gripWid = z.gripAxis === 'Y' ? jawT : (flipped ? bb.size[1] : st.W) + 30;
    const halfOpen = z.gripAxis === 'Y' ? (flipped ? bb.size[1] : st.W) / 2 + jawT / 2 : (flipped ? bb.size[0] : st.L) / 2 + jawT / 2;
    // jaw zone: setup 1 = bottom of stock; setup 2 = near model top (part sits upside down)
    const jd = flipped ? Math.min(H * 0.6, 15) : grip - 1;
    const jzTop = flipped ? bb.max[2] : stockBot + jd;
    const jzBot = flipped ? bb.max[2] - jd : stockBot;
    for (const sgn of [-1, 1]) {
      const x = z.gripAxis === 'Y' ? cx : cx + sgn * halfOpen, y = z.gripAxis === 'Y' ? cy + sgn * halfOpen : cy;
      box(gripLen, gripWid, jzTop - jzBot, x, y, (jzTop + jzBot) / 2, 0xef4444, 0.55);
      const rest = jawH - (jzTop - jzBot);
      if (rest > 0) box(gripLen, gripWid, rest, x, y, flipped ? jzTop + rest / 2 : jzBot - rest / 2, 0x64748b, 0.35);
    }
    // parallels
    const pz = flipped ? bb.max[2] + 4 : stockBot - 4; const pw = 6;
    const span = z.gripAxis === 'Y' ? (flipped ? bb.size[1] : st.W) : (flipped ? bb.size[0] : st.L);
    for (const sgn of [-1, 1]) {
      if (z.gripAxis === 'Y') box(st.L + 20, pw, 8, cx, cy + sgn * (span / 2 - pw / 2 - 2), pz, 0x22c55e, 0.5);
      else box(pw, st.W + 20, 8, cx + sgn * (span / 2 - pw / 2 - 2), cy, pz, 0x22c55e, 0.5);
    }
  } else if (z.type === 'clamps') {
    const bot = bb.min[2] - settings.allowTop;
    box(st.L, st.W, H + 2 * settings.allowTop, cx, cy, (top + bot) / 2, 0x9fb4d0, 0.12);
    const m = (st.L - bb.size[0]) / 2;
    const pts = [[cx - st.L / 2 + m / 2, cy], [cx + st.L / 2 - m / 2, cy], [cx, cy - st.W / 2 + m / 2], [cx, cy + st.W / 2 - m / 2]];
    for (const [x, y] of pts) box(Math.max(10, m * 0.8), Math.max(10, m * 0.8), 10, x, y, top + 5, 0xef4444, 0.6);
  } else if (z.type === 'chuck') {
    const R = st.L / 2; const bot = bb.min[2] - settings.allowTop - grip;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R, R, top - bot, 48), new THREE.MeshStandardMaterial({ color: 0x9fb4d0, transparent: true, opacity: 0.12, depthWrite: false }));
    cyl.rotation.x = Math.PI / 2; cyl.position.set(cx, cy, (top + bot) / 2); clampGroup.add(cyl);
    for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3; box(14, 14, grip, cx + Math.cos(a) * (R + 7), cy + Math.sin(a) * (R + 7), bot + grip / 2, 0xef4444, 0.6); }
  } else if (z.type === 'side') {
    const ax = z.side[1];
    // jaws on the two faces perpendicular to the remaining horizontal axis
    const other = ax === 'X' ? 'Y' : 'X';
    const halfOpen = (other === 'Y' ? bb.size[1] : bb.size[0]) / 2 + 6;
    for (const sgn of [-1, 1]) {
      if (other === 'Y') box(bb.size[0] * 0.6, 12, H * 0.8, cx, cy + sgn * halfOpen, (bb.min[2] + bb.max[2]) / 2, 0xef4444, 0.5);
      else box(12, bb.size[1] * 0.6, H * 0.8, cx + sgn * halfOpen, cy, (bb.min[2] + bb.max[2]) / 2, 0xef4444, 0.5);
    }
  }
}

// ---------------- loading ----------------
let occt = null;
async function getOcct() {
  if (!occt) occt = await window.occtimportjs({ locateFile: n => new URL('vendor/' + n, location.href).href });
  return occt;
}
function busy(on, text) { $('#busy').hidden = !on; if (text) $('#busyText').textContent = text; }

async function openFile(file) {
  const name = file.name; const ext = name.split('.').pop().toLowerCase();
  if (['x_t', 'x_b', 'xmt_txt', 'xmt_bin'].includes(ext)) return alertMsg(`"${name}" is a Parasolid file (.x_t / .x_b). Parasolid is a closed format: no free software can read it. Please open it in your CAD (SolidWorks, NX, Solid Edge, Onshape, Fusion…) and use Save As → STEP (.step / .stp), then open the STEP here.`);
  if (['sldprt', 'ipt', 'prt', 'catpart', 'f3d', 'dwg', 'dxf'].includes(ext)) return alertMsg(`"${name}" is a native CAD file. Please export it from your CAD as STEP (.step / .stp) and open that here.`);
  busy(true, 'Reading part…');
  await new Promise(r => setTimeout(r, 30));
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    let geo;
    if (ext === 'stl') {
      const g = new STLLoader().parse(buf.buffer);
      geo = segmentMesh(g.attributes.position.array);
    } else {
      const o = await getOcct();
      const params = { linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.0015, angularDeflection: 0.35 };
      const r = ext === 'stp' || ext === 'step' ? o.ReadStepFile(buf, params) : ext === 'igs' || ext === 'iges' ? o.ReadIgesFile(buf, params) : ext === 'brep' ? o.ReadBrepFile(buf, params) : null;
      if (!r) throw new Error('Unsupported file type .' + ext + '. Use STEP, IGES or STL.');
      if (!r.success || !r.meshes.length) throw new Error('Could not read this file. Try exporting it again as STEP (AP214 or AP242).');
      const P = [], N = [], T = [], F = []; let vo = 0, to = 0;
      for (const m of r.meshes) {
        const p = m.attributes.position.array, n = m.attributes.normal?.array, ix = m.index.array;
        for (let i = 0; i < p.length; i++) { P.push(p[i]); N.push(n ? n[i] : 0); }
        for (let i = 0; i < ix.length; i++) T.push(ix[i] + vo);
        if (m.brep_faces?.length) for (const f of m.brep_faces) F.push({ first: f.first + to, last: f.last + to });
        else F.push({ first: to, last: to + ix.length / 3 - 1 });
        vo += p.length / 3; to += ix.length / 3;
      }
      geo = { pos: new Float32Array(P), nrm: new Float32Array(N), tri: new Uint32Array(T), faces: F };
    }
    state = { name, geo, an: null, plan: null, tapped: {}, sel: null };
    host.classList.add('loaded');
    $('#vtools').hidden = false; $('#legend').hidden = false;
    busy(true, 'Finding features…');
    await new Promise(r => setTimeout(r, 30));
    analyze(true);
  } catch (e) {
    console.error(e); alertMsg('Could not open this file.\n\n' + (e.message || e));
  } finally { busy(false); }
}

function alertMsg(m) {
  $('#tab-warn').innerHTML = `<div class="warnitem">${esc(m).replace(/\n/g, '<br>')}</div>`;
  showTab('warn');
  if (!state.geo) { $('#featList').innerHTML = `<div class="warnitem">${esc(m)}</div>`; }
}

function analyze(newView) {
  const g = rotateGeo(state.geo, settings.up);
  state.an = analyzePart(state.geo, settings.up);
  buildMesh(g);
  replan();
  if (newView) setView('iso');
}

function replan() {
  if (!state.an) return;
  state.plan = makePlan(state.an, library, settings, { tapped: state.tapped });
  renderAll();
}

// ---------------- render panels ----------------
const fx = v => (Math.round(v * 100) / 100).toString();
function renderAll() {
  const { an, plan } = state;
  const s = an.bbox.size;
  $('#partInfo').innerHTML = `<div class="fname">${esc(state.name)}</div><div class="kv">
    <b>Size</b><span>${fx(s[0])} × ${fx(s[1])} × ${fx(s[2])} mm</span>
    <b>Stock</b><span>${plan.stock.round ? 'Ø' + plan.stock.L + ' bar × ' + plan.stock.H : plan.stock.L + ' × ' + plan.stock.W + ' × ' + plan.stock.H} mm</span>
    <b>Hold</b><span>${{ vise: 'Machine vise', clamps: 'Strap clamps on table', chuck: '3-jaw chuck' }[plan.hold]}</span>
    <b>Setups</b><span>${plan.setups.length}</span>
    <b>Faces</b><span>${an.faceCount}${an.approx ? ' (STL, estimated)' : ''}</span></div>`;

  // features
  const hs = plan.holes; let h = '';
  const row = (color, text, faces, extra = '') => `<div class="feat" data-faces="${faces.join(',')}"><span class="dot" style="background:${color}"></span><span class="grow">${text}</span>${extra}</div>`;
  if (hs.length) {
    h += `<div class="fgroup">Holes (${hs.length})</div>`;
    for (const x of hs) {
      const desc = `<b>${x.id}</b> Ø${fx(x.dia)} × ${fx(x.depth)} ${x.through ? 'through' : 'deep'}${x.cbore ? `, c'bore Ø${fx(x.cbore.dia)}×${fx(x.cbore.depth)}` : ''}${x.csk ? `, chamfer Ø${fx(x.csk.dia)}` : ''} · ${x.dir ? SIDE_NAME[x.dir] : 'angled'}${x.tap ? ` · <b>M${x.tap.m}</b>` : ''}`;
      h += row(x.tap ? '#a855f7' : '#3b82f6', desc, x.faces, `<label class="tap" title="Tapped hole"><input type="checkbox" data-tap="${x.id}" ${x.tap ? 'checked' : ''}>Tap</label>`);
    }
  }
  if (an.pockets.length) {
    h += `<div class="fgroup">Pockets / steps (${an.pockets.length})</div>`;
    for (const p of an.pockets) h += row('#22c55e', `<b>${p.id}</b> ${p.kind} ${fx(p.length)} × ${fx(p.width)}, ${fx(p.depth)} deep · corner ${p.cornerR ? 'R' + fx(p.cornerR) : 'sharp'}${p.floorR ? ', floor R' + fx(p.floorR) : ''} · ${SIDE_NAME[p.dir]}`, p.faces);
  }
  const rads = [...an.corners.map(c => ({ ...c, col: '#ef4444', t: 'Inside corner' })), ...an.fillets.map(f => ({ ...f, col: '#eab308', t: f.type }))];
  if (rads.length) {
    h += `<div class="fgroup">Radii (${rads.length})</div>`;
    const grp = new Map(); for (const r of rads) { const k = r.t + r.r; if (!grp.has(k)) grp.set(k, { ...r, n: 0, faces: [] }); const g = grp.get(k); g.n++; g.faces.push(...r.faces); }
    for (const g of [...grp.values()].sort((a, b) => a.r - b.r)) h += row(g.col, `R${fx(g.r)} ${esc(g.t)} × ${g.n}`, g.faces);
  }
  if (an.chamfers.length) h += `<div class="fgroup">Chamfers</div>` + row('#06b6d4', `${an.chamfers.length} chamfer face(s), ≈${fx(Math.max(...an.chamfers.map(c => c.size || 0)))} mm`, an.chamfers.map(c => c.idx));
  if (an.surfaces.length) h += `<div class="fgroup">3D surfaces</div>` + row('#eab308', `${an.surfaces.length} curved face(s), smallest R≈${fx(Math.min(...an.surfaces.map(x => x.rmin || 99)))}`, an.surfaces.map(x => x.idx));
  if (an.bosses.length) h += `<div class="fgroup">Outside diameters</div>` + an.bosses.map(b => row('#94a3b8', `Ø${fx(b.dia)}`, b.faces)).join('');
  $('#featList').innerHTML = h || '<div class="muted">No machining features found (simple block).</div>';

  // plan
  let ph = `<div class="kv" style="margin-bottom:12px"><b>Material</b><span>${esc(plan.mat.name)}</span><b>Coolant</b><span>${esc(plan.mat.coolant)}</span></div>`;
  plan.setups.forEach((s, i) => {
    ph += `<div class="setup"><h4>${esc(s.title)}</h4><ul class="clamp">${s.clamp.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
    for (const o of s.ops) ph += opHtml(o);
    ph += `</div>`;
  });
  ph += `<div class="setup"><h4>Last: check the part</h4><ul class="clamp"><li>Deburr all edges by hand.</li><li>Measure: overall size, hole sizes (pin gauge), thread (plug gauge), pocket depths.</li><li>Compare with the drawing before making the next part.</li></ul></div>`;
  $('#tab-plan').innerHTML = ph;

  // tools
  let th = `<table class="tl"><tr><th>T</th><th>Tool</th><th>Flute / reach</th><th>Used in steps</th></tr>`;
  for (const t of plan.tools) {
    const steps = plan.setups.flatMap(s => s.ops).filter(o => o.tool === t).map(o => o.no);
    const so = Math.max(...plan.setups.flatMap(s => s.ops).filter(o => o.tool === t).map(o => o.stickout || 0));
    th += `<tr><td>${t.T ?? ''}</td><td>${esc(toolLabel({ ...t, T: 0 }))}${t.note ? `<div class="muted small">${esc(t.note)}</div>` : ''}</td><td>${t.fluteLen} / ${t.reach} mm${so ? `<div class="muted small">stick-out ≥ ${so} mm</div>` : ''}</td><td>${steps.join(', ')}</td></tr>`;
  }
  th += `</table>`;
  if (plan.missing.length) th += `<div class="need"><b>Not in your tool library:</b><ul>${plan.missing.map(m => `<li>${esc(m)}</li>`).join('')}</ul>Add them in <i>Tool library</i> if you have them, or buy them.</div>`;
  th += `<p class="muted small">Tool numbers (T) come from your library. Set the same numbers in the machine tool table.</p>`;
  $('#tab-tools').innerHTML = th;

  // clamping
  let ch = '';
  plan.setups.forEach((s, i) => { ch += `<div class="setup"><h4>${esc(s.title)}</h4><ul class="clamp">${s.clamp.map(c => `<li>${esc(c)}</li>`).join('')}</ul><button data-showclamp="${i}">Show on 3D</button></div>`; });
  ch += `<p class="muted small">Red = vise jaws / clamps (grip area). Green = parallels. Light blue = raw stock.</p>`;
  $('#tab-clamp').innerHTML = ch;
  const sel = $('#selClampView'); const cur = sel.value;
  sel.innerHTML = `<option value="">Off</option>` + plan.setups.map((s, i) => `<option value="${i}">Setup ${i + 1}</option>`).join('');
  sel.value = cur && +cur < plan.setups.length ? cur : '';

  // warnings
  const w = plan.warnings;
  $('#tab-warn').innerHTML = (w.length ? w.map(x => `<div class="warnitem">${esc(x)}</div>`).join('') : `<div class="warnitem okitem">No problems found. Still check the drawing for tolerances and finish.</div>`)
    + `<div class="warnitem okitem">3-axis check: ${plan.setups.length} setup(s) needed. Each side with features = one clamping.</div>`;
  $('#warnCount').hidden = !w.length; $('#warnCount').textContent = w.length;
  $('#btnPdf').disabled = false;
  paint(); drawClamps();
}

function opHtml(o) {
  const t = o.tool || {};
  const tl = t.missing ? t.label : t.type === 'note' ? t.label : toolLabel(t);
  const nums = [];
  if (o.rpm) nums.push(`S <b>${o.rpm}</b> rpm`);
  if (o.feed) nums.push(`F <b>${o.feed}</b> mm/min`);
  if (o.ap) nums.push(`Depth: <b>${esc(o.ap)}</b>`);
  if (o.ae) nums.push(`Width: <b>${esc(o.ae)}</b>`);
  if (o.stickout) nums.push(`Stick-out ≥ <b>${o.stickout}</b> mm`);
  return `<div class="op"><div class="h"><span class="n">${o.no}</span><span class="t">${esc(o.op)}</span></div>
    <div class="tool ${t.missing ? 'miss' : ''}">${esc(tl)}</div>
    ${nums.length ? `<div class="nums">${nums.map(n => `<span>${n}</span>`).join('')}</div>` : ''}
    ${o.note ? `<div class="note">${esc(o.note)}</div>` : ''}</div>`;
}

function showTab(id) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + id));
}

// ---------------- job sheet (PDF) ----------------
function snap() { controls.update(); renderer.render(scene, camera); return renderer.domElement.toDataURL('image/jpeg', 0.85); }
function jobSheetHtml(clampImgs = []) {
  const { an, plan } = state; const s = an.bbox.size;
  const img = snap();
  const d = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  let ops = '';
  plan.setups.forEach((st, si) => {
    ops += `<h2>${esc(st.title)}</h2><div class="sc">${clampImgs[si] ? `<img src="${clampImgs[si]}">` : ''}<ul class="cl">${st.clamp.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>
      <table><thead><tr><th>#</th><th>Operation</th><th>Tool</th><th>S rpm</th><th>F mm/min</th><th>Depth / width</th><th>Notes</th><th>✓</th></tr></thead>
      ${st.ops.map(o => `<tr><td>${o.no}</td><td>${esc(o.op)}</td><td>${esc(o.tool?.missing || o.tool?.type === 'note' ? o.tool.label : toolLabel(o.tool))}${o.stickout ? `<br><small>stick-out ≥ ${o.stickout}</small>` : ''}</td><td>${o.rpm ?? ''}</td><td>${o.feed ?? ''}</td><td>${esc([o.ap, o.ae].filter(Boolean).join(' / '))}</td><td>${esc(o.note || '')}</td><td class="box"></td></tr>`).join('')}</table>`;
  });
  const tools = plan.tools.map(t => `<tr><td>${t.T ?? ''}</td><td>${esc(toolLabel({ ...t, T: 0 }))}</td><td>${t.fluteLen}</td><td>${t.reach}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Job sheet ${esc(state.name)}</title><style>
  @page { size: A4; margin: 12mm; } body { font: 10.5px/1.35 "Segoe UI", Arial, sans-serif; color: #111; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #ff7a1a; padding-bottom: 6px; margin-bottom: 8px; }
  h1 { font-size: 18px; margin: 0; } h2 { font-size: 13px; margin: 14px 0 4px; color: #b44c00; page-break-after: avoid; }
  .top { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; } .sc { display: grid; grid-template-columns: 62mm 1fr; gap: 8px; align-items: start; page-break-inside: avoid; } .sc img { width: 100%; max-height: 62mm; object-fit: cover; border-radius: 4px; background: #1a2030; } .top img { width: 100%; max-height: 75mm; object-fit: contain; border: 1px solid #ccc; border-radius: 4px; background: #1a2030; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; } th, td { border: 1px solid #bbb; padding: 3px 4px; text-align: left; vertical-align: top; } th { background: #f1f1f1; }
  tr { page-break-inside: avoid; } td.box { width: 14px; } .cl { margin: 2px 0 4px 16px; padding: 0; } .kv td:first-child { font-weight: 600; width: 34%; }
  .warn { background: #fff7e6; border: 1px solid #f0b35a; padding: 6px 8px; border-radius: 4px; margin-top: 8px; } small { color: #555; }
  footer { margin-top: 12px; font-size: 9px; color: #666; border-top: 1px solid #ccc; padding-top: 4px; }</style></head><body>
  <header><div><h1>CNC Job Sheet — ${esc(state.name)}</h1><div>3-axis VMC · ${plan.setups.length} setup(s) · ${plan.setups.reduce((a, s) => a + s.ops.length, 0)} steps</div></div><div>Date: ${d}<br>Operator: ____________</div></header>
  <div class="top"><img src="${img}"><table class="kv">
  <tr><td>Part size</td><td>${fx(s[0])} × ${fx(s[1])} × ${fx(s[2])} mm</td></tr>
  <tr><td>Material</td><td>${esc(plan.mat.name)}</td></tr>
  <tr><td>Stock</td><td>${plan.stock.round ? 'Ø' + plan.stock.L + ' bar × ' + plan.stock.H : plan.stock.L + ' × ' + plan.stock.W + ' × ' + plan.stock.H} mm</td></tr>
  <tr><td>Work holding</td><td>${{ vise: 'Machine vise', clamps: 'Strap clamps on table', chuck: '3-jaw chuck' }[plan.hold]}</td></tr>
  <tr><td>Coolant</td><td>${esc(plan.mat.coolant)}</td></tr>
  <tr><td>Holes</td><td>${plan.holes.length} (${plan.holes.filter(h => h.tap).length} tapped)</td></tr>
  <tr><td>Pockets / steps</td><td>${an.pockets.length}</td></tr>
  <tr><td>Smallest inside radius</td><td>${an.minCorner ? 'R' + fx(an.minCorner) : 'sharp / none'}</td></tr></table></div>
  ${plan.warnings.length ? `<div class="warn"><b>Check before cutting:</b><ul class="cl">${plan.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
  <h2>Tool list</h2><table><tr><th>T</th><th>Tool</th><th>Flute length</th><th>Reach</th></tr>${tools}</table>
  ${plan.missing.length ? `<div class="warn"><b>Tools not in library:</b> ${plan.missing.map(esc).join('; ')}</div>` : ''}
  ${ops}
  <h2>Final check</h2><ul class="cl"><li>Deburr all edges.</li><li>Measure size, holes (pin gauge), threads (plug gauge), depths.</li><li>Compare with drawing.</li></ul>
  <footer>Made with Veyra Tool Advisor. Suggested values only: the operator must check every tool, clamp and value before cutting. Start with 70% feed override.</footer></body></html>`;
}

async function savePdf() {
  if (!state.plan) return;
  const prevClamp = $('#selClampView').value; $('#selClampView').value = ''; drawClamps(); state.sel = null; paint(); setView('iso');
  await new Promise(r => setTimeout(r, 120));
  const main = snap(); const imgs = [];
  for (let i = 0; i < state.plan.setups.length; i++) { $('#selClampView').value = String(i); drawClamps(); setView('iso'); imgs.push(snap()); }
  $('#selClampView').value = ''; drawClamps(); setView('iso');
  const html = jobSheetHtml(imgs);
  $('#selClampView').value = prevClamp; drawClamps();
  const base = state.name.replace(/\.[^.]+$/, '') + ' - job sheet.pdf';
  if (window.veyra?.savePdf) { const p = await window.veyra.savePdf(html, base); if (p) toast('Saved: ' + p); }
  else { const w = window.open('', '_blank'); w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
}
function toast(m) { const t = document.createElement('div'); t.textContent = m; Object.assign(t.style, { position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: '#03140a', padding: '8px 14px', borderRadius: '8px', zIndex: 99, fontWeight: 600, maxWidth: '90vw' }); document.body.appendChild(t); setTimeout(() => t.remove(), 4000); }

// ---------------- tool library ----------------
const LIB_COLS = [['T', 'T', 'n'], ['type', 'Type'], ['dia', 'Ø mm', 'n'], ['flutes', 'Flutes', 'n'], ['fluteLen', 'Flute len', 'n'], ['reach', 'Reach', 'n'], ['cornerR', 'Corner R', 'n'], ['pitch', 'Pitch', 'n'], ['angle', 'Angle', 'n'], ['mat', 'Material'], ['note', 'Note']];
function renderLib() {
  const rows = library.slice().sort((a, b) => (a.T || 999) - (b.T || 999));
  $('#libTable').innerHTML = `<tr>${LIB_COLS.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr>` + rows.map(t => `<tr data-id="${t.id}">${LIB_COLS.map(([k, , n]) => {
    if (k === 'type') return `<td><select data-k="type">${Object.entries(TOOL_TYPES).map(([v, l]) => `<option value="${v}" ${t.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td>`;
    if (k === 'mat') return `<td><select data-k="mat">${['Carbide', 'HSS', 'Cobalt HSS', 'Insert'].map(v => `<option ${t.mat === v ? 'selected' : ''}>${v}</option>`).join('')}</select></td>`;
    return `<td><input ${n ? 'type="number" step="any" class="n"' : 'type="text"'} data-k="${k}" value="${esc(t[k] ?? '')}"></td>`;
  }).join('')}<td class="del"><button title="Delete">✕</button></td></tr>`).join('');
}
function saveLib() { store.set('vta.library', library); replan(); }
$('#libTable').addEventListener('change', e => {
  const tr = e.target.closest('tr'); const t = library.find(x => x.id === tr?.dataset.id); if (!t) return;
  const k = e.target.dataset.k; t[k] = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value; saveLib();
});
$('#libTable').addEventListener('click', e => {
  if (!e.target.closest('td.del button')) return;
  const id = e.target.closest('tr').dataset.id; library = library.filter(x => x.id !== id); saveLib(); renderLib();
});
$('#libType').innerHTML = Object.entries(TOOL_TYPES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
$('#libAdd').onclick = () => {
  const type = $('#libType').value; const T = Math.max(0, ...library.map(x => x.T || 0)) + 1;
  library.push({ id: 'u' + Date.now(), T, type, dia: 6, flutes: type === 'drill' ? 2 : 4, fluteLen: 18, reach: 30, cornerR: 0, mat: type === 'drill' || type === 'tap' ? 'HSS' : 'Carbide', pitch: type === 'tap' ? 1 : 0, angle: type === 'chamfer' || type === 'spotdrill' ? 90 : 0, note: '' });
  saveLib(); renderLib(); const w = $('.libwrap'); w.scrollTop = w.scrollHeight;
};
$('#libReset').onclick = () => { if (confirm('Replace your tool library with the default list?')) { library = defaultLibrary(); saveLib(); renderLib(); } };
$('#libExport').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(library, null, 1)], { type: 'application/json' })); a.download = 'veyra-tool-library.json'; a.click(); };
$('#libImport').onclick = () => $('#libFile').click();
$('#libFile').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const l = JSON.parse(await f.text()); if (Array.isArray(l)) { library = l.map((t, i) => ({ id: t.id || 'i' + i, ...t })); saveLib(); renderLib(); } } catch { alert('Not a valid tool library file.'); } e.target.value = ''; };
$('#btnLib').onclick = () => { renderLib(); $('#libDlg').showModal(); };
$('#libClose').onclick = () => $('#libDlg').close();

// ---------------- settings UI ----------------
$('#selMat').innerHTML = MATERIALS.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
const SET_MAP = { setMaxRpm: 'maxRpm', setMaxFeed: 'maxFeed', setVise: 'viseOpening', setJaw: 'viseJawHeight', setSide: 'allowSide', setTop: 'allowTop', setGrip: 'gripExtra', setFin: 'finishStock' };
function loadSettingsUI() {
  $('#selMat').value = settings.material; $('#selUp').value = settings.up;
  for (const [id, k] of Object.entries(SET_MAP)) $('#' + id).value = settings[k];
}
loadSettingsUI();
const saveSettings = () => store.set('vta.settings', settings);
$('#selMat').onchange = e => { settings.material = e.target.value; saveSettings(); replan(); };
$('#selUp').onchange = e => { settings.up = e.target.value; saveSettings(); if (state.geo) { busy(true, 'Finding features…'); setTimeout(() => { analyze(true); busy(false); }, 30); } };
for (const [id, k] of Object.entries(SET_MAP)) $('#' + id).onchange = e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) { settings[k] = v; saveSettings(); replan(); } };

// ---------------- events ----------------
$('#btnOpen').onclick = $('#btnOpen2').onclick = () => $('#fileIn').click();
$('#fileIn').onchange = e => { const f = e.target.files[0]; if (f) openFile(f); e.target.value = ''; };
$('#btnPdf').onclick = savePdf;
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
$('#chkColors').onchange = paint;
$('#selClampView').onchange = drawClamps;
$('#tab-clamp').addEventListener('click', e => { const b = e.target.closest('[data-showclamp]'); if (b) { $('#selClampView').value = b.dataset.showclamp; drawClamps(); } });
$('#featList').addEventListener('change', e => { const id = e.target.dataset.tap; if (id) { state.tapped[id] = e.target.checked; replan(); } });
$('#featList').addEventListener('click', e => {
  if (e.target.closest('label.tap')) return;
  const f = e.target.closest('.feat'); if (!f) return;
  document.querySelectorAll('.feat.sel').forEach(x => x.classList.remove('sel'));
  const faces = f.dataset.faces.split(',').filter(Boolean).map(Number);
  if (state.sel && state.sel.join() === faces.join()) { state.sel = null; } else { state.sel = faces; f.classList.add('sel'); }
  paint();
});
['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); $('#drop').classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop' || e.relatedTarget === null) $('#drop').classList.remove('over'); }));
document.addEventListener('drop', e => { const f = e.dataTransfer?.files?.[0]; if (f) openFile(f); });
window.veyra?.onOpenFile?.(async (name, bytes) => openFile(new File([bytes], name)));
window.__vta = { openFile, state: () => state, setView, showTab };
