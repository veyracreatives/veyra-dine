// Mastercam-style naming and parameter pages for each operation.
const f1 = v => (v == null || v === '' ? '' : Number(v).toFixed(1));
const f3 = v => Number(v).toFixed(3);

export function mcTool(t) {
  if (!t) return '';
  if (t.missing) return t.label;
  if (t.type === 'note') return t.label;
  const n = `#${t.T ?? '?'} - `;
  const d = `M${Number(t.dia).toFixed(2)}`;
  switch (t.type) {
    case 'endmill': return `${n}${d} FLAT ENDMILL`;
    case 'ballnose': return `${n}${d} BALL ENDMILL`;
    case 'bullnose': return `${n}${d} BULL ENDMILL ${f1(t.cornerR)} RAD`;
    case 'facemill': return `${n}${d} FACE MILL`;
    case 'drill': return `${n}${d} DRILL`;
    case 'spotdrill': return `${n}${d} SPOT DRILL ${t.angle || 90} DEG`;
    case 'chamfer': return `${n}${d} CHAMFER MILL ${t.angle || 90} DEG`;
    case 'tap': return `${n}M${t.dia} x ${t.pitch} TAP RH`;
    case 'reamer': return `${n}${d} REAMER`;
    case 'cornerround': return `${n}CORNER ROUND ${f1(t.cornerR)} RAD`;
    case 'boring': return `${n}${d} BORING BAR`;
    default: return `${n}${d} ${t.type.toUpperCase()}`;
  }
}

// returns { title, sections: [[heading, [[label, value], ...]], ...] }
export function mcPage(o, setupIdx, mat) {
  const mc = o.mc || {}; const t = o.tool || {};
  const isDrill = mc.tp === 'Drill';
  const sec = [];
  const tool = [['Tool', mcTool(t)]];
  if (!t.missing && t.type !== 'note') {
    if (t.cornerR) tool.push(['Corner radius', f1(t.cornerR)]);
    if (o.rpm) tool.push(['Spindle speed', `${o.rpm} RPM`]);
    if (o.feed) tool.push(['Feed rate', `${o.feed} mm/min`]);
    if (o.feed) tool.push(['Plunge rate', `${isDrill ? o.feed : Math.round(o.feed * 0.4)} mm/min`]);
    if (o.feed && !isDrill) tool.push(['Retract rate', `${Math.min(5000, o.feed * 2)} mm/min`]);
    if (o.fz) tool.push(['Feed per tooth', `${f3(o.fz)} mm`]);
    if (o.stickout) tool.push(['Stick-out (min)', `${o.stickout} mm`]);
    tool.push(['Coolant', mat?.id === 'ci' || mat?.id === 'plastic' ? 'Air blast (M7)' : 'Flood (M8)']);
  }
  sec.push(['Tool', tool]);
  const cut = [];
  if (mc.cycle) cut.push(['Cycle', mc.cycle]);
  if (mc.mode) cut.push(['Cut parameters', mc.mode]);
  if (mc.style) cut.push(['Cutting method', mc.style]);
  if (mc.step) cut.push(['Stepover', mc.step]);
  if (mc.stw != null) cut.push(['Stock to leave on walls', f1(mc.stw)]);
  if (mc.stf != null) cut.push(['Stock to leave on floors', f1(mc.stf)]);
  if (mc.cuts) cut.push([isDrill ? 'Note' : 'Depth cuts', mc.cuts]);
  if (mc.peck) cut.push(['1st peck / peck', `${f1(mc.peck)} / ${f1(mc.peck)}`]);
  if (isDrill && mc.tip != null) cut.push(['Tip comp', mc.tip ? `ON, breakthrough ${f1(mc.brk || 0)}` : 'OFF']);
  if (!cut.length && o.ap) cut.push(['Depth', o.ap]);
  if (cut.length) sec.push([isDrill ? 'Drill cycle' : 'Cut parameters', cut]);
  if (!t.missing && t.type !== 'note' && mc.tp) {
    const top = mc.top != null ? mc.top : 0;
    sec.push(['Linking parameters', [
      ['Clearance', '50.0 (Absolute)'],
      ['Retract', isDrill ? '5.0 (Absolute)' : '10.0 (Absolute)'],
      ['Feed plane', isDrill ? '3.0 (Incremental)' : '3.0 (Incremental)'],
      ['Top of stock', `${f1(top)} (Absolute)`],
      ['Depth', mc.z == null ? 'from surface model' : `${f1(mc.z)} (Absolute)`],
    ]]);
  }
  const title = mc.tp || (t.missing ? 'Toolpath' : 'Manual');
  return { title, sections: sec };
}

export const WCS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59'];
export const PLANE = { '+Z': 'TOP', '-Z': 'BOTTOM', '+X': 'RIGHT', '-X': 'LEFT', '+Y': 'BACK', '-Y': 'FRONT' };
