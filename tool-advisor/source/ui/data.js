// Materials, cutting data and default tool library.
// Cutting data = conservative starting values for a normal VMC. Operator must verify.

export const MATERIALS = [
  // vcC: carbide end mill m/min, vcH: HSS end mill, vdH: HSS drill, vdC: carbide drill, vt: tap
  // fz: chip load per tooth = fz * D (mm), fd: drill feed per rev = fd * D (mm)
  // ae/ap: roughing width / depth as fraction of D (side milling)
  { id: 'alu', name: 'Aluminium (6061 / 6082 / HE30)', vcC: 300, vcH: 90, vdH: 60, vdC: 150, vt: 15, fz: 0.010, fd: 0.020, ae: 0.35, ap: 1.0, coolant: 'Flood coolant or mist. Clear chips well, aluminium sticks to the tool.' },
  { id: 'ms', name: 'Mild steel (MS / EN8 / C45)', vcC: 120, vcH: 25, vdH: 22, vdC: 80, vt: 8, fz: 0.005, fd: 0.015, ae: 0.2, ap: 1.0, coolant: 'Flood coolant.' },
  { id: 'alloy', name: 'Alloy steel (EN19 / EN24 / 4140)', vcC: 90, vcH: 18, vdH: 15, vdC: 60, vt: 6, fz: 0.004, fd: 0.012, ae: 0.15, ap: 1.0, coolant: 'Flood coolant.' },
  { id: 'ss', name: 'Stainless steel (304 / 316)', vcC: 80, vcH: 15, vdH: 10, vdC: 50, vt: 4, fz: 0.004, fd: 0.010, ae: 0.15, ap: 0.8, coolant: 'Lots of flood coolant. Do not let the tool rub, keep it cutting.' },
  { id: 'ci', name: 'Cast iron (FG / SG)', vcC: 110, vcH: 20, vdH: 20, vdC: 80, vt: 8, fz: 0.005, fd: 0.018, ae: 0.25, ap: 1.0, coolant: 'Dry with air blast (cast iron dust + coolant = sludge).' },
  { id: 'brass', name: 'Brass / Bronze', vcC: 200, vcH: 60, vdH: 50, vdC: 120, vt: 12, fz: 0.007, fd: 0.020, ae: 0.3, ap: 1.0, coolant: 'Dry or light coolant. Use 0° rake drills if they grab.' },
  { id: 'tool', name: 'Tool steel annealed (D2 / EN31 / OHNS)', vcC: 70, vcH: 12, vdH: 10, vdC: 45, vt: 4, fz: 0.0035, fd: 0.010, ae: 0.12, ap: 0.8, coolant: 'Flood coolant.' },
  { id: 'plastic', name: 'Plastic (Delrin / Nylon / Acrylic)', vcC: 250, vcH: 100, vdH: 60, vdC: 120, vt: 15, fz: 0.010, fd: 0.025, ae: 0.4, ap: 1.0, coolant: 'Air blast only. Sharp tools, do not let it melt.' },
];

// Metric coarse taps: nominal, pitch, tap drill
export const TAPS = [
  { m: 3, p: 0.5, d: 2.5 }, { m: 4, p: 0.7, d: 3.3 }, { m: 5, p: 0.8, d: 4.2 },
  { m: 6, p: 1.0, d: 5.0 }, { m: 8, p: 1.25, d: 6.8 }, { m: 10, p: 1.5, d: 8.5 },
  { m: 12, p: 1.75, d: 10.2 }, { m: 14, p: 2.0, d: 12.0 }, { m: 16, p: 2.0, d: 14.0 },
  { m: 20, p: 2.5, d: 17.5 },
];

export const TOOL_TYPES = {
  facemill: 'Face mill', endmill: 'End mill', ballnose: 'Ball nose', bullnose: 'Bull nose (corner R)',
  drill: 'Drill', spotdrill: 'Spot / centre drill', chamfer: 'Chamfer mill', tap: 'Tap',
  reamer: 'Reamer', cornerround: 'Corner rounding', boring: 'Boring bar',
};

let n = 0;
const t = (type, dia, o = {}) => ({ id: 'd' + (++n), type, dia, flutes: o.z ?? 4, fluteLen: o.fl ?? Math.round(dia * 3), reach: o.reach ?? Math.round(dia * 4 + 10), cornerR: o.r ?? 0, mat: o.mat ?? 'Carbide', pitch: o.p ?? 0, angle: o.a ?? 0, note: o.note ?? '' });

export function defaultLibrary() {
  n = 0;
  const lib = [
    t('facemill', 50, { z: 4, fl: 6, reach: 60, note: 'Insert face mill' }),
    ...[3, 4, 5, 6, 8, 10, 12, 16].map(d => t('endmill', d, { z: d <= 6 ? 3 : 4 })),
    ...[4, 6, 8, 10].map(d => t('ballnose', d, { z: 2 })),
    t('spotdrill', 10, { z: 2, fl: 10, a: 90, mat: 'HSS' }),
    t('chamfer', 10, { z: 2, fl: 5, a: 90 }),
    ...[2.5, 3.3, 4.2, 5, 6, 6.6, 6.8, 8, 8.5, 9, 10, 10.2, 11, 12, 13].map(d => t('drill', d, { z: 2, fl: Math.round(d * 6 + 10), reach: Math.round(d * 8 + 20), mat: 'HSS' })),
    ...[[3, .5], [4, .7], [5, .8], [6, 1], [8, 1.25], [10, 1.5], [12, 1.75]].map(([d, p]) => t('tap', d, { z: 3, fl: d * 3, reach: d * 6 + 30, p, mat: 'HSS' })),
    ...[6, 8, 10].map(d => t('reamer', d, { z: 6, fl: d * 3, mat: 'HSS', note: 'H7' })),
  ];
  lib.forEach((x, i) => x.T = i + 1);
  return lib;
}

export const DEFAULT_SETTINGS = {
  material: 'alu',
  maxRpm: 8000,
  maxFeed: 10000,
  viseOpening: 150,
  viseJawHeight: 40,
  allowSide: 2,      // stock extra on each side (mm)
  allowTop: 1,       // facing allowance on top (mm)
  gripExtra: 7,      // extra stock height to hold in vise in setup 1 (mm)
  finishStock: 0.3,  // left for finishing (mm)
  scallop: 0.01,     // 3D finish scallop height (mm)
  up: '+Z',
};
