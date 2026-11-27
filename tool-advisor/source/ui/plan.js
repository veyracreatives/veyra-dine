// Builds tool picks, setups, clamping and the step-by-step machining plan.
import { MATERIALS, TAPS, TOOL_TYPES } from './data.js';
import { SIDE_NAME } from './analyze.js';

const r1 = v => Math.round(v * 10) / 10;
const r0 = v => Math.round(v);
const ceil5 = v => Math.ceil(v / 5) * 5;

export function toolLabel(t) {
  if (!t) return '';
  const T = t.T ? `T${t.T} ` : '';
  switch (t.type) {
    case 'tap': return `${T}Tap M${t.dia}x${t.pitch}`;
    case 'bullnose': return `${T}Bull nose Ø${t.dia} R${t.cornerR}`;
    case 'cornerround': return `${T}Corner rounding R${t.cornerR}`;
    case 'spotdrill': case 'chamfer': return `${T}${TOOL_TYPES[t.type]} Ø${t.dia} ${t.angle || 90}°`;
    default: return `${T}${TOOL_TYPES[t.type] || t.type} Ø${t.dia}${t.type === 'endmill' || t.type === 'ballnose' ? ` ${t.flutes}F ${t.mat}` : t.type === 'drill' ? ` ${t.mat}` : ''}`;
  }
}

export function makePlan(an, lib, settings, opts = {}) {
  const mat = MATERIALS.find(m => m.id === settings.material) || MATERIALS[0];
  const tapped = opts.tapped || {}; // hole id -> true/false override
  const used = new Map(); // tool id -> tool
  const missing = []; // descriptions of tools not in library
  const warnings = [];
  const S = an.bbox.size; const L = S[0], W = S[1], H = S[2];

  // ---------- tool helpers ----------
  const ofType = ty => lib.filter(t => t.type === ty).sort((a, b) => b.dia - a.dia);
  const need = (desc) => { if (!missing.includes(desc)) missing.push(desc); return { missing: true, label: 'NEED: ' + desc, dia: 0, type: 'missing' }; };
  const use = t => { if (t && !t.missing) used.set(t.id, t); return t; };
  function endmill({ maxDia = Infinity, minReach = 0, minDia = 0, prefer } = {}) {
    let c = ofType('endmill').filter(t => t.dia <= maxDia + 1e-6 && t.dia >= minDia && (t.reach || t.fluteLen) >= minReach);
    if (prefer) c = c.sort((a, b) => Math.abs(a.dia - prefer) - Math.abs(b.dia - prefer));
    if (c.length) return use(c[0]);
    return null;
  }
  const rpmFor = (vc, d) => Math.min(settings.maxRpm, r0(vc * 1000 / (Math.PI * d)));
  const feedCap = f => Math.min(settings.maxFeed, r0(f));
  function millData(t, kind) {
    const carb = (t.mat || 'Carbide').toLowerCase().startsWith('c');
    let vc = carb ? mat.vcC : mat.vcH;
    if (t.type === 'facemill') vc = mat.vcC;
    const s = rpmFor(vc, t.dia);
    let fz = Math.min(0.15, Math.max(0.005, mat.fz * t.dia)) * (carb ? 1 : 0.7);
    if (kind === 'finish') fz *= 0.7;
    if (kind === 'slot') fz *= 0.6;
    if (t.type === 'ballnose' || t.type === 'chamfer') fz *= 0.6;
    const F = feedCap(s * (t.flutes || 2) * fz);
    return { rpm: s, feed: F, fz: Math.round(fz * 1000) / 1000 };
  }
  function drillData(t) {
    const carb = (t.mat || '').toLowerCase().startsWith('c');
    const s = rpmFor(carb ? mat.vdC : mat.vdH, t.dia);
    const f = Math.max(0.03, mat.fd * t.dia);
    return { rpm: s, feed: feedCap(s * f), fr: Math.round(f * 100) / 100 };
  }

  // ---------- holes: decide tapped / process ----------
  const holes = an.holes.map(h => {
    const tap = TAPS.find(x => Math.abs(x.d - h.dia) < 0.06);
    const isTapped = tapped[h.id] !== undefined ? tapped[h.id] : !!tap && !h.through;
    return { ...h, tap: isTapped ? (tap || TAPS.reduce((b, x) => Math.abs(x.d - h.dia) < Math.abs(b.d - h.dia) ? x : b)) : null, tapGuess: !!tap };
  });

  // ---------- setups ----------
  // main side = side with most features (prefer +Z on tie)
  const sides = Object.keys(an.sides);
  const count = s => (an.sides[s] || []).length;
  const order = ['+Z', '-Z', '+X', '-X', '+Y', '-Y'].filter(s => s === '+Z' || s === '-Z' || count(s) > 0);
  let main = order.reduce((b, s) => count(s) > count(b) ? s : b, '+Z');
  if (main !== '+Z' && main !== '-Z') main = '+Z';
  const flip = main === '+Z' ? '-Z' : '+Z';
  const sideSetups = order.filter(s => s !== '+Z' && s !== '-Z' && count(s) > 0);

  // ---------- stock & workholding ----------
  const td3 = Object.values(an.threeD || {});
  const thin = H <= 12 && Math.max(L, W) >= 8 * H;
  const round = an.roundPart;
  const narrow = Math.min(L, W);
  const sideAllow = settings.allowSide;
  const fitsVise = narrow + 2 * sideAllow <= settings.viseOpening;
  let hold; // 'vise' | 'clamps' | 'chuck'
  if (round) hold = 'chuck'; else if (thin || !fitsVise) hold = 'clamps'; else hold = 'vise';
  const grip = hold === 'clamps' ? 0 : settings.gripExtra;
  const clampMargin = hold === 'clamps' ? 15 : 0;
  const stock = {
    L: round ? ceil5(Math.max(L, W) + 2 * sideAllow) : ceil5(L + 2 * (sideAllow + clampMargin)),
    W: round ? ceil5(Math.max(L, W) + 2 * sideAllow) : ceil5(W + 2 * (sideAllow + clampMargin)),
    H: Math.ceil(H + settings.allowTop * 2 + grip),
    round,
  };
  const gripAxis = L >= W ? 'Y' : 'X'; // jaws close along the short direction
  const jawDepth = Math.min(grip - 1, settings.viseJawHeight);

  // ---------- operations ----------
  const setups = [];
  const mk = (side, title) => { const s = { side, title, clamp: [], ops: [], clampZones: null }; setups.push(s); return s; };
  const feats = side => ({
    holes: holes.filter(h => h.dir === side),
    pockets: an.pockets.filter(p => p.dir === side),
    cham: an.chamfers.filter(c => c.dir === side),
    surf: an.surfaces.filter(s => s.dir === side),
  });
  const partBand = side => side === main ? H : H;
  const finish = settings.finishStock;

  function addMillOps(s, side, isMain) {
    const f = feats(side);
    const depthAll = H + 0.5;
    // 1 facing
    const fm = ofType('facemill')[0] || endmill({ prefer: 16 }) || endmill();
    if (fm) {
      use(fm);
      const d = millData(fm, 'rough');
      s.ops.push({ mc: { tp: 'Facing', style: 'Zigzag (climb)', z: 0, top: isMain ? settings.allowTop : r1(settings.allowTop + grip), cuts: isMain ? `Max rough step ${r1(settings.allowTop - 0.2)}, 1 finish pass 0.2` : 'Max rough step 1.5, 1 finish pass 0.2', step: '70%' }, op: isMain ? 'Face the top flat' : 'Face to final thickness', tool: fm, ...d, ap: isMain ? `${settings.allowTop} mm total (2 passes: ${r1(settings.allowTop - 0.2)} + 0.2)` : `${r1(settings.allowTop + grip)} mm total, max 1.5 mm per pass, last pass 0.2`, ae: `${r0(fm.dia * 0.7)} mm (70% of tool)`, note: isMain ? 'Set Z0 on the finished top after this.' : `Measure the part height. Final height = ${r1(H)} mm.` });
    } else s.ops.push({ op: 'Face top', tool: need('Face mill Ø40–63 or end mill Ø16+'), note: '' });

    // 2 outside profile (main side only, all the way down)
    if (isMain && !round && hold !== 'chuck') {
      const reach = H + 2;
      const t = endmill({ minReach: reach, maxDia: 20 }) || endmill({ maxDia: 20 });
      if (t) {
        const d = millData(t, 'rough'); const df = millData(t, 'finish');
        const short = (t.reach || t.fluteLen) < reach;
        if (short) warnings.push(`${toolLabel(t)} reach ${t.reach} mm is shorter than profile depth ${r1(reach)} mm. Use a longer tool or profile from both sides.`);
        s.ops.push({ mc: { tp: '2D Dynamic Mill', mode: 'Outside (chain the part outline)', z: -r1(depthAll), stw: finish, stf: 0, step: r0(mat.ae * 100) + '%', cuts: 'Full depth in one level (Dynamic)' }, op: `Rough outside profile, leave ${finish} mm`, tool: t, ...d, ap: `${r1(Math.min(depthAll, t.dia * mat.ap))} mm per pass, down to ${r1(depthAll)} mm`, ae: `${r1(t.dia * mat.ae)} mm`, note: hold === 'clamps' ? `Cut ${r1(depthAll)} mm deep, into the sacrificial plate under the part. Leave 4 small tabs (or bolt through the part's own holes) so it cannot move when cut free.` : `Cut ${r1(depthAll)} mm deep (0.5 mm into the extra stock). The bottom ${grip} mm stays in the vise.` });
        s.ops.push({ mc: { tp: 'Contour (2D)', mode: 'Compensation: Computer, Left (climb). Lead in/out arc 50%', z: -r1(depthAll), stw: 0, stf: 0, cuts: '1 finish pass, spring pass ON' }, op: 'Finish outside profile', tool: t, ...df, ap: `full depth ${r1(depthAll)} mm (or 2 steps)`, ae: `${finish} mm`, note: 'Climb milling. Check size with a micrometer before removing.', finish: true });
      } else s.ops.push({ op: 'Outside profile', tool: need(`End mill with reach ≥ ${r1(H + 2)} mm`) });
    }
    if (round && isMain) s.ops.push({ op: 'Outside diameter', tool: { label: 'Lathe / turning', type: 'note' }, note: `Round part Ø${r1(Math.max(L, W))}: turn the outside diameter on a lathe first, or mill it with a helical contour.` });

    // 3 pockets / steps rough
    for (const p of f.pockets.sort((a, b) => b.depth - a.depth)) {
      const maxRough = Math.max(1, p.width * 0.7);
      const t = endmill({ maxDia: Math.min(maxRough, 16), minReach: p.depth + 1 });
      if (!t) { s.ops.push({ op: `Rough ${p.kind.toLowerCase()} ${p.id}`, tool: need(`End mill ≤ Ø${r1(maxRough)} with reach ≥ ${r1(p.depth + 1)} mm`), pocket: p.id }); continue; }
      const d = millData(t, 'rough');
      const entry = p.kind === 'Step / open shoulder' ? 'Enter from outside the part.' : 'Ramp or helix in (2–3°), do not plunge straight.';
      s.ops.push({ mc: { tp: '2D Dynamic Mill', mode: p.kind === 'Step / open shoulder' ? 'Open pocket: start from outside' : 'Entry: Helix, radius ' + r1(t.dia * 0.4) + ', ramp 2°', z: -r1(p.depth), stw: finish, stf: finish, step: r0(mat.ae * 100) + '%', cuts: `Max rough step ${r1(Math.min(p.depth, t.dia * mat.ap * 0.8))}` }, op: `Rough ${p.kind.toLowerCase()} ${p.id} (${r1(p.length)} x ${r1(p.width)}, ${r1(p.depth)} deep)`, tool: t, ...d, ap: `${r1(Math.min(p.depth, t.dia * mat.ap * 0.8))} mm per pass`, ae: `${r1(t.dia * mat.ae)} mm`, note: `${entry} Leave ${finish} mm on walls and floor.`, pocket: p.id });
    }

    // 4 holes: spot, drill, peck, ream / helical
    const hs = f.holes.filter(h => !h.angled);
    if (hs.length) {
      const sp = ofType('spotdrill')[0];
      if (sp) {
        use(sp);
        const d = drillData(sp);
        s.ops.push({ mc: { tp: 'Drill', cycle: 'Drill/Counterbore (G81)', z: -r1(Math.max(...hs.map(h => h.tap ? h.tap.d : h.dia)) / 2 + 0.2), cuts: 'Tip comp OFF (depth = chamfer size)', dwell: '0' }, op: `Spot drill ${hs.length} hole${hs.length > 1 ? 's' : ''} (${hs.map(h => h.id).join(', ')})`, tool: sp, ...d, ap: 'Depth = hole Ø/2 + 0.2 (90° spot also makes a small chamfer)', ae: '', note: 'G81 drilling cycle.' });
      } else s.ops.push({ op: 'Spot drill holes', tool: need('Spot drill Ø6–10 90°') });

      // group by drill size
      const byDrill = new Map();
      for (const h of hs) {
        const target = h.tap ? h.tap.d : h.dia;
        const key = target.toFixed(2) + (h.through ? 'T' : 'B') + r1(h.depth);
        if (!byDrill.has(key)) byDrill.set(key, { target, list: [], depth: h.depth, through: h.through });
        byDrill.get(key).list.push(h);
      }
      for (const g of [...byDrill.values()].sort((a, b) => a.target - b.target)) {
        const ids = g.list.map(h => h.id).join(', ');
        const drills = ofType('drill');
        const exact = drills.find(t => Math.abs(t.dia - g.target) < 0.06);
        const reamer = ofType('reamer').find(t => Math.abs(t.dia - g.target) < 0.02);
        const depth = g.through ? r1(g.depth + 1 + 0.3 * g.target) : r1(g.depth);
        const peck = depth > 3 * g.target;
        if (exact && !reamer) {
          use(exact); const d = drillData(exact);
          if (exact.fluteLen < depth) warnings.push(`${toolLabel(exact)} flute length ${exact.fluteLen} mm is shorter than hole depth ${depth} mm (${ids}).`);
          s.ops.push({ mc: { tp: 'Drill', cycle: peck ? 'Peck drill (G83)' : 'Chip break (G73)', peck: r1(peck ? g.target : g.target * 1.5), z: -r1(g.depth), tip: true, brk: g.through ? 1 : 0 }, op: `Drill Ø${g.target} x ${depth} ${g.through ? '(through)' : 'deep'} — ${ids}`, tool: exact, ...d, ap: peck ? `Peck ${r1(g.target)} mm (G83)` : 'G81 / G73 chip break', ae: '', note: g.through ? (hold === 'clamps' ? 'Through hole: put a sacrificial plate under the part.' : 'Through hole: goes 1 mm into the extra stock under the part, safe for the vise.') : '' });
        } else if (reamer) {
          const pre = drills.filter(t => t.dia <= g.target - 0.15 && t.dia >= g.target - 0.5)[0] || drills.filter(t => t.dia < g.target - 0.1)[0];
          if (pre) { use(pre); const d = drillData(pre); s.ops.push({ mc: { tp: 'Drill', cycle: peck ? 'Peck drill (G83)' : 'Drill/Counterbore (G81)', peck: peck ? r1(pre.dia) : null, z: -r1(g.depth), tip: true, brk: g.through ? 1 : 0 }, op: `Pre-drill Ø${pre.dia} for reaming — ${ids}`, tool: pre, ...d, ap: peck ? `Peck ${r1(pre.dia)} mm (G83)` : 'G81', ae: '', note: '' }); }
          else s.ops.push({ op: `Pre-drill for Ø${g.target} ream`, tool: need(`Drill Ø${r1(g.target - 0.2)}`) });
          use(reamer); const rr = rpmFor(mat.vdH / 3, reamer.dia);
          s.ops.push({ mc: { tp: 'Drill', cycle: 'Bore #1 feed-feed (G85)', z: -r1(g.depth), tip: false, brk: g.through ? 0.5 : 0 }, op: `Ream Ø${g.target} H7 — ${ids}`, tool: reamer, rpm: rr, feed: feedCap(rr * reamer.dia * 0.04), ap: 'G85 (feed in, feed out)', ae: '', note: 'Only if this is a fit hole (dowel/bearing). Else drill only.', finish: true });
        } else {
          // no exact drill: drill under and helical-mill / bore
          const pre = drills.filter(t => t.dia <= g.target - 0.3)[0];
          if (pre) { use(pre); const d = drillData(pre); s.ops.push({ mc: { tp: 'Drill', cycle: peck ? 'Peck drill (G83)' : 'Drill/Counterbore (G81)', peck: peck ? r1(pre.dia) : null, z: -r1(g.depth), tip: true, brk: g.through ? 1 : 0 }, op: `Pre-drill Ø${pre.dia} — ${ids}`, tool: pre, ...d, ap: peck ? `Peck ${r1(pre.dia)} mm (G83)` : 'G81', ae: '', note: '' }); }
          const em = endmill({ maxDia: g.target * 0.75, minReach: depth, minDia: g.target * 0.3 });
          if (em) { const d = millData(em, 'finish'); s.ops.push({ mc: { tp: 'Helix Bore', mode: 'Rough + finish, finish 0.1', z: -r1(g.depth), stw: 0, stf: 0, cuts: `Helix pitch ${r1(Math.min(1, em.dia * 0.1))}` }, op: `Helical interpolate Ø${g.target} — ${ids}`, tool: em, ...d, ap: `Helix pitch ${r1(Math.min(1, em.dia * 0.1))} mm`, ae: '', note: `No Ø${g.target} drill in your library. Mill it to size (or buy a Ø${g.target} drill).`, finish: true }); }
          else s.ops.push({ op: `Make Ø${g.target} hole — ${ids}`, tool: need(`Drill Ø${g.target}`) });
          if (!exact && g.target <= 20) need(`Drill Ø${g.target} (optional, faster than milling)`);
        }
      }
      // counterbores
      const cbg = new Map(); for (const h of hs.filter(h => h.cbore)) { const k = h.cbore.dia + 'x' + h.cbore.depth; if (!cbg.has(k)) cbg.set(k, []); cbg.get(k).push(h); }
      for (const list of cbg.values()) {
        const cb = list[0].cbore, h = list[0], ids = list.map(x => x.id).join(', ');
        const em = endmill({ maxDia: cb.dia * 0.8, minReach: cb.depth + 1, minDia: Math.min(cb.dia * 0.4, h.dia * 0.9) });
        if (em) { const d = millData(em, 'finish'); s.ops.push({ mc: { tp: 'Helix Bore', mode: 'Counterbore, finish 0.1', z: -r1(cb.depth), stw: 0, stf: 0, cuts: `Helix pitch ${r1(Math.min(1, em.dia * 0.1))}` }, op: `Counterbore Ø${cb.dia} x ${cb.depth} deep — ${ids}`, tool: em, ...d, ap: `${r1(Math.min(cb.depth, em.dia * 0.5))} mm per pass`, ae: 'circular pocket', note: 'Mill as a circular pocket / helix after drilling.', finish: true }); }
        else s.ops.push({ op: `Counterbore Ø${cb.dia} — ${ids}`, tool: need(`End mill ≤ Ø${r1(cb.dia * 0.8)} or counterbore tool Ø${cb.dia}`) });
      }
    }

    // 5 finish pockets (corner radius limited)
    for (const p of f.pockets) {
      let maxD = p.cornerR ? 2 * p.cornerR * 0.9 : p.width * 0.5;
      let note = p.cornerR ? `Corner radius R${p.cornerR}: tool must be smaller than Ø${r1(2 * p.cornerR)}.` : 'CAD shows SHARP inside corners. Any end mill leaves a radius = tool radius. Use the smallest tool you trust, or ask if R is allowed.';
      const t = endmill({ maxDia: maxD, minReach: p.depth + 1 });
      if (!t) { s.ops.push({ op: `Finish ${p.id} walls and floor`, tool: need(`End mill ≤ Ø${r1(maxD)} reach ≥ ${r1(p.depth + 1)}`), note }); continue; }
      const d = millData(t, 'finish');
      s.ops.push({ mc: { tp: 'Pocket (Standard) – finish only', mode: 'Finish walls + floor, spring pass ON', z: -r1(p.depth), stw: 0, stf: 0, cuts: 'Walls full depth, floor 1 pass 0.2' }, op: `Finish ${p.id} walls and floor`, tool: t, ...d, ap: `full depth ${r1(p.depth)} mm walls, floor 0.2 mm`, ae: `${finish} mm`, note, finish: true, pocket: p.id });
      if (p.floorR) {
        const bn = ofType('bullnose').find(b => Math.abs(b.cornerR - p.floorR) < 0.05) || ofType('ballnose').find(b => b.dia <= 2 * p.floorR + 0.01);
        if (bn) { use(bn); const d2 = millData(bn, 'finish'); s.ops.push({ mc: { tp: 'Contour (2D)', mode: 'Floor fillet: or use Surface Finish Scallop', z: -r1(p.depth), stw: 0, stf: 0 }, op: `Floor corner radius R${p.floorR} — ${p.id}`, tool: bn, ...d2, ap: '', ae: `stepover ${r1(bn.dia * 0.08)} mm`, note: 'Bottom fillet where wall meets floor.', finish: true }); }
        else s.ops.push({ op: `Floor corner radius R${p.floorR} — ${p.id}`, tool: need(`Bull nose R${p.floorR} or ball nose Ø${r1(2 * p.floorR)}`), note: 'Or leave sharp if drawing allows.' });
      }
    }

    // 6 3D surface toolpaths
    const td = an.threeD && an.threeD[side];
    if (td) {
      const h = Math.max(0.001, settings.scallop || 0.01);
      const so = R => Math.round(Math.min(R, 2 * Math.sqrt(Math.max(0, 2 * R * h - h * h))) * 100) / 100;
      const depth = Math.max(0.5, td.depth);
      const reach = depth + 2;
      const lim = td.concR || Infinity; // smallest concave radius (limits ball size)
      const ids = `${td.faces.length} face(s), ${td.steepPct}% steep`;
      const tol = (fin) => fin ? 'Total tolerance 0.01' : 'Total tolerance 0.025';
      if (!td.onlyEdges) {
        // roughing
        const rt = endmill({ minReach: reach, maxDia: 16, prefer: 12 }) || ofType('bullnose').find(t => (t.reach || 0) >= reach);
        if (rt) {
          const d = millData(rt, 'rough');
          const sd = r1(Math.min(depth, rt.dia * (mat.ap >= 1 ? 1 : 0.6)));
          s.ops.push({ mc: { tp: 'Dynamic OptiRough (3D HST)', mode: `${tol(false)}. Containment = part outline + tool radius. Entry: helix`, z: -r1(depth), stw: finish, stf: finish, step: `${Math.round(rt.dia * 0.12 * 10) / 10} mm (12%)`, cuts: `Step down ${sd}, step up 0.5 (fill-in steps ON)` }, op: `3D rough all surfaces (${ids})`, tool: rt, ...d, ap: `step down ${sd}`, ae: `${r1(rt.dia * 0.12)} mm`, note: `Leaves ${finish} mm on all surfaces. Uses full flute length with small stepover.` });
          // rest rough if tool too big for concave areas
          if (lim < rt.dia / 2) {
            const rr = endmill({ maxDia: Math.max(1, 2 * lim * 0.9), minReach: reach });
            if (rr) { const d2 = millData(rr, 'rough'); s.ops.push({ mc: { tp: 'Area Roughing (rest material)', mode: `Rest from previous op. ${tol(false)}`, z: -r1(depth), stw: finish, stf: finish, step: '15%', cuts: `Step down ${r1(rr.dia * 0.5)}` }, op: 'Rest rough corners the big tool could not reach', tool: rr, ...d2, ap: `step down ${r1(rr.dia * 0.5)}`, ae: `${r1(rr.dia * 0.15)} mm`, note: `Smallest concave radius R${td.concR}.` }); }
          }
        } else s.ops.push({ op: '3D rough', tool: need(`End mill / bull nose with reach ≥ ${r1(reach)} mm`) });
        // finishing tool: largest ball nose with R < smallest concave radius, enough reach
        const balls = ofType('ballnose').filter(t => (t.reach || 0) >= reach);
        const fb = balls.filter(t => t.dia <= 10)[0] || balls.slice(-1)[0];
        if (fb) {
          use(fb); const d = millData(fb, 'finish'); const R = fb.dia / 2; const st = so(R);
          if (td.steepPct > 10) s.ops.push({ mc: { tp: 'Surface High Speed – Waterline', mode: `Steep areas only (45°–90°). ${tol(true)}. Climb`, z: -r1(depth), stw: 0, stf: 0, cuts: `Step down ${st} (scallop ${h})` }, op: `3D finish steep walls (${td.steepPct}% of 3D area)`, tool: fb, ...d, ap: `step down ${st}`, ae: '', note: 'Waterline cuts in Z levels, best on steep walls.', finish: true });
          if (td.steepPct < 90) s.ops.push({ mc: { tp: td.steepPct <= 10 ? 'Surface High Speed – Raster' : 'Surface High Speed – Scallop', mode: `${td.steepPct <= 10 ? 'Cut angle 45°, ' : ''}Shallow areas only (0°–45°). ${tol(true)}`, z: -r1(depth), stw: 0, stf: 0, step: `${st} mm (scallop ${h})`, cuts: 'Single level' }, op: `3D finish shallow areas (${100 - td.steepPct}% of 3D area)`, tool: fb, ...d, ap: '', ae: `stepover ${st} mm`, note: 'Smaller scallop = smoother surface but longer time. Overlap 1 mm with Waterline.', finish: true });
          if (td.concR && R > td.concR * 0.95) {
            const pb = ofType('ballnose').filter(t => t.dia / 2 <= td.concR * 0.95 && (t.reach || 0) >= reach)[0];
            if (pb) { use(pb); const d3 = millData(pb, 'finish'); s.ops.push({ mc: { tp: 'Surface High Speed – Pencil', mode: `Corners / fillets. ${tol(true)}`, z: -r1(depth), stw: 0, stf: 0, cuts: 'Pencil passes: 3, overlap 0.5' }, op: `Clean inside corners (smallest R${td.concR})`, tool: pb, ...d3, ap: '', ae: '', note: 'Removes the material the finishing ball left in concave corners.', finish: true }); }
            else s.ops.push({ op: `Clean inside corners R${td.concR}`, tool: need(`Ball nose < Ø${r1(2 * td.concR)}`) });
          }
        } else s.ops.push({ op: '3D finish', tool: need(`Ball nose ≤ Ø${r1(Math.min(12, 2 * lim))} with reach ≥ ${r1(reach)} mm`) });
      }
      // convex rounded edges
      if (td.convR) {
        const cr = ofType('cornerround').find(t => Math.abs(t.cornerR - td.convR) < 0.05);
        if (cr) { use(cr); const d = millData(cr, 'finish'); s.ops.push({ mc: { tp: 'Contour (2D)', mode: `Corner rounding tool R${td.convR}, tip offset 0.1`, z: -r1(td.convR + 0.1), stw: 0, stf: 0 }, op: `Round top edges R${td.convR}`, tool: cr, ...d, note: 'Fastest way for an outside edge radius.', finish: true }); }
        else if (td.onlyEdges) {
          const b2 = ofType('ballnose').filter(t => (t.reach || 0) >= td.convR + 5)[0];
          if (b2) { use(b2); const d = millData(b2, 'finish'); s.ops.push({ mc: { tp: 'Surface High Speed – Waterline', mode: `Edge radius only. ${tol(true)}`, z: -r1(td.convR), stw: 0, stf: 0, cuts: `Step down ${so(b2.dia / 2)}` }, op: `Round edges R${td.convR} (3D)`, tool: b2, ...d, note: `Or buy a corner rounding tool R${td.convR} (much faster).`, finish: true }); }
          need(`Corner rounding tool R${td.convR} (optional, faster)`);
        }
      }
      if (side === '+Z' && an.threeD['-Z'] && !an.threeD['-Z'].onlyEdges) {}
    }

    // 7 chamfers / deburr
    const holeCh = f.holes.filter(h => h.csk);
    if (f.cham.length || holeCh.length || isMain) {
      const c = ofType('chamfer')[0];
      if (c) { use(c); const d = millData(c, 'finish'); const sz = Math.max(0.3, ...f.cham.map(x => x.size || 0), ...holeCh.map(h => (h.csk.dia - h.dia) / 2)); s.ops.push({ mc: { tp: 'Contour (2D)', mode: 'Contour type: 2D chamfer, width ' + r1(sz) + ', tip offset 0.5', z: 0, stw: 0, stf: 0 }, op: f.cham.length || holeCh.length ? `Chamfer edges (≈${r1(sz)} mm)` : 'Deburr edges (0.3 mm chamfer)', tool: c, ...d, ap: 'Z depth = chamfer size + 0.5 mm tip offset', ae: '', note: holeCh.length ? `Includes hole chamfers/countersinks: ${holeCh.map(h => h.id).join(', ')}.` : '' }); }
      else s.ops.push({ op: 'Chamfer / deburr edges', tool: need('Chamfer mill 90° Ø6–12'), note: 'Or deburr by hand.' });
    }

    // 8 tap last
    const th = f.holes.filter(h => h.tap);
    const tg = new Map(); for (const h of th) { const k = h.tap.m + '_' + h.depth + (h.through ? 'T' : ''); if (!tg.has(k)) tg.set(k, []); tg.get(k).push(h); }
    for (const [, list] of tg) { const m = list[0].tap.m;
      const tp = ofType('tap').find(t => Math.abs(t.dia - m) < 0.01);
      const tap = list[0].tap; const depth = r1(Math.max(...list.map(h => h.depth)) - (list[0].through ? 0 : 2 * tap.p));
      if (tp) { use(tp); const s1 = Math.min(r0(mat.vt * 1000 / (Math.PI * m)), 1500, settings.maxRpm); s.ops.push({ mc: { tp: 'Drill', cycle: 'Tap (G84) rigid', z: -depth, tip: false, brk: 0 }, op: `Tap M${m}x${tap.p} x ${depth} deep — ${list.map(h => h.id).join(', ')}`, tool: tp, rpm: s1, feed: r1(s1 * tap.p), ap: 'G84 rigid tapping, feed = RPM x pitch', ae: '', note: `Tap drill Ø${tap.d}. Use tapping oil. Check thread with a plug gauge.` }); }
      else s.ops.push({ op: `Tap M${m} — ${list.map(h => h.id).join(', ')}`, tool: need(`Tap M${m}x${tap.p}`) });
    }
    // angled
    for (const h of f.holes.filter(h => h.angled)) warnings.push(`${h.id} Ø${h.dia} is at an angle. Your machine is 3-axis: needs an angle plate / sine vise / tilted fixture setup, or make it on another machine.`);
  }

  // ---------- Setup 1: main side ----------
  const s1 = mk(main, `Setup 1 — ${SIDE_NAME[main]} side up`);
  if (hold === 'vise') {
    s1.clamp = [
      `Stock: ${stock.L} x ${stock.W} x ${stock.H} mm (part ${r1(L)} x ${r1(W)} x ${r1(H)} + ${sideAllow} mm each side + ${settings.allowTop} mm top/bottom + ${grip} mm extra height to hold).`,
      `Clamp in the machine vise. Jaws grip the two long sides (${stock.L} mm faces); jaws close along ${gripAxis}.`,
      `Grip only the bottom ${jawDepth} mm. Put parallels under the stock so ${r1(H + settings.allowTop + 1)} mm sticks out above the jaws.`,
      'Tap the stock down with a soft mallet so it sits flat on the parallels (parallels must not move).',
      `Work zero: X/Y = stock centre (edge finder / probe). Z0 = part top after facing.`,
    ];
    s1.clampZones = { type: 'vise', gripAxis, jawDepth, stock, side: 'bottom' };
  } else if (hold === 'clamps') {
    s1.clamp = [
      `Stock: ${stock.L} x ${stock.W} x ${stock.H} mm plate (part ${r1(L)} x ${r1(W)} + ${sideAllow + clampMargin} mm border for clamps).`,
      thin ? 'Part is thin and wide: do NOT hold in the vise (it bends). Use 4 strap/step clamps on the border of the plate, on a sacrificial plate or parallels.' : `Part is wider than your vise (${settings.viseOpening} mm). Clamp straight on the table with strap clamps.`,
      'Put clamps only on the extra border, outside the part outline. Keep clamp height below the tool path or move them between ops.',
      ...(an.holes.some(h => h.through && h.dir === main) ? ['Tip: drill the through holes first, then bolt the part down through its own holes to a fixture plate and remove the outer clamps before the profile cut.'] : []),
      'Work zero: X/Y from the plate centre or a corner, Z0 = top after facing.',
    ];
    s1.clampZones = { type: 'clamps', stock, margin: clampMargin };
  } else {
    s1.clamp = [
      `Stock: round bar Ø${stock.L} x ${stock.H} mm long.`,
      'Hold in a 3-jaw chuck bolted flat on the table, or a V-block / collet block in the vise.',
      `Grip ${jawDepth || 8} mm of the bar. Face side up.`,
      'Work zero: X/Y = bar centre (find with a probe or dial indicator), Z0 = top after facing.',
    ];
    s1.clampZones = { type: 'chuck', stock };
  }
  addMillOps(s1, main, true);

  // ---------- Setup 2: flip ----------
  const s2 = mk(flip, `Setup 2 — flip over, ${SIDE_NAME[flip]} side up`);
  s2.clamp = hold === 'vise' ? [
    'Remove chips and deburr Setup 1 edges. Flip the part over.',
    `Clamp on the finished side walls (${r1(gripAxis === 'Y' ? W : L)} mm across) with soft jaws or aluminium jaw covers, so the vise does not mark them.`,
    'Sit the finished top on parallels. Check it is flat with a dial indicator.',
    `Face off the ${grip + settings.allowTop} mm extra to the final height ${r1(H)} mm.`,
    'Work zero: X/Y = pick up the finished part edges again (same zero as Setup 1). Z0 = new top after facing.',
  ] : hold === 'clamps' ? [
    'Flip the plate. Clamp on the border again (or bolt through the finished holes).',
    'Face the bottom flat to final thickness.',
    'Cut off the clamp border last (profile through), holding the part with tabs or through its own holes.',
  ] : ['Flip the part, grip on the finished diameter with soft jaws. Face to length.'];
  s2.clampZones = hold === 'vise' ? { type: 'vise2', gripAxis, stock } : s1.clampZones;
  addMillOps(s2, flip, false);

  // ---------- side setups ----------
  sideSetups.forEach((side, i) => {
    const s = mk(side, `Setup ${3 + i} — ${SIDE_NAME[side]} up (part on its side)`);
    const ax = side[1];
    s.clamp = [
      `Turn the part so the ${SIDE_NAME[side].toLowerCase()} faces up.`,
      `Clamp in the vise on two finished faces. Use a square or dial to make it straight. Use soft jaws.`,
      `Work zero: pick up from finished faces. Z0 = ${SIDE_NAME[side].toLowerCase()} face.`,
    ];
    s.clampZones = { type: 'side', side, stock };
    const f = feats(side);
    // only holes and pockets on side setups (no facing / profile)
    const saveLen = s.ops.length;
    addMillOps(s, side, false);
    s.ops = s.ops.filter(o => !/^Face/.test(o.op));
  });

  // ---------- warnings ----------
  if (an.approx) warnings.push('STL file: no exact circles or faces, so hole sizes and radii are estimated. Use STEP for accurate results.');
  if (an.pockets.some(p => p.cornerR === null)) warnings.push('Some pockets have sharp inside corners in CAD. A milling tool always leaves a radius.');
  for (const h of holes) if (h.blocked) warnings.push(`${h.id} Ø${h.dia}: tool cannot reach it straight down on a 3-axis machine (undercut / hidden). Needs a special tool (T-slot / lollipop cutter) or design change.`);
  if (td3.some(d => d.steepPct > 60 && d.depth > 25)) warnings.push('Deep steep 3D walls: check ball nose reach and holder clearance in Mastercam simulation (Verify).');
  if (an.angled.length) warnings.push(`${an.angled.length} angled face(s) found: on a 3-axis machine use an angle plate / sine vise, or 3D-surface it with a ball nose (slow, step marks).`);
  if (H > settings.viseJawHeight * 2 && hold === 'vise') warnings.push(`Part is tall (${r1(H)} mm). Check the vise grip and tool reach. Consider holding on a longer grip.`);
  for (const h of holes) if (h.tap && !h.tapGuess) warnings.push(`${h.id}: marked as tapped but Ø${h.dia} is not a standard tap-drill size.`);

  // ---------- number ops, tool list ----------
  for (const st of setups) {
    const r3 = st.ops.filter(o => /OptiRough|Area Roughing/.test(o.mc?.tp || '') || /^3D rough/.test(o.op));
    if (!r3.length) continue;
    const rest = st.ops.filter(o => !r3.includes(o));
    let at = 0; rest.forEach((o, i) => { if (/^(Face|Rough)/.test(o.op)) at = i + 1; });
    st.ops = [...rest.slice(0, at), ...r3, ...rest.slice(at)];
  }
  let n = 1; for (const s of setups) for (const o of s.ops) { o.no = n++; const m = /(\d+(?:\.\d+)?) (?:mm )?deep|down to (\d+(?:\.\d+)?)|depth (\d+(?:\.\d+)?)|x (\d+(?:\.\d+)?) /.exec(o.op + ' ' + (o.ap || '') + ' ' + (o.note || '')); const dp = m ? parseFloat(m[1] || m[2] || m[3] || m[4]) : 0; if (o.tool && !o.tool.missing && o.tool.type !== 'note' && o.tool.type !== 'facemill') o.stickout = Math.max(Math.round(o.tool.dia * 2.5), Math.ceil(dp + 5)); }
  const tools = [...used.values()].sort((a, b) => (a.T || 999) - (b.T || 999));
  // estimate cycle (very rough): count
  return { mat, stock, hold, setups, tools, missing, warnings, holes, main, flip };
}
