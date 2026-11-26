import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const occt = await require('occt-import-js')();
const { analyzePart } = await import('./ui/analyze.js');
export function load(file){
  const buf = new Uint8Array(fs.readFileSync(file));
  const r = file.endsWith('.step')? occt.ReadStepFile(buf,null): occt.ReadIgesFile(buf,null);
  const P=[],N=[],T=[],F=[]; let vo=0, to=0;
  for(const m of r.meshes){ const p=m.attributes.position.array, n=m.attributes.normal?.array, ix=m.index.array;
    P.push(...p); N.push(...(n||new Array(p.length).fill(0))); for(const i of ix) T.push(i+vo);
    for(const f of m.brep_faces) F.push({first:f.first+to,last:f.last+to}); vo+=p.length/3; to+=ix.length/3; }
  return {pos:new Float32Array(P),nrm:new Float32Array(N),tri:new Uint32Array(T),faces:F};
}
const f = process.argv[2]; const t0=Date.now();
const a = analyzePart(load(f), process.argv[3]||'+Z');
console.log('ms',Date.now()-t0, 'faces',a.faceCount, JSON.stringify(a.faceKinds.reduce((m,k)=>(m[k]=(m[k]||0)+1,m),{})));
console.log('bbox',a.bbox.size, 'round',a.roundPart,'sides',JSON.stringify(a.sides));
for(const h of a.holes) console.log(h.id,h.dir,'dia',h.dia,'depth',h.depth,'thr',h.through,'cb',JSON.stringify(h.cbore),'csk',JSON.stringify(h.csk),'tip',h.drillPoint,'pos',h.pos.join(','));
for(const p of a.pockets) console.log(p.id,p.kind,p.dir,'depth',p.depth,'w',p.width,'l',p.length,'cR',p.cornerR,'fR',p.floorR);
console.log('corners',a.corners.map(c=>c.r+(c.concave?'c':'v')).join(' '),'fillets',a.fillets.map(c=>c.type+':'+c.r).join(' '));
console.log('chamfers',a.chamfers.length,'angled',a.angled.length,'surf',a.surfaces.length,'bosses',a.bosses.map(b=>b.dia));
const { makePlan } = await import('./ui/plan.js'); const { defaultLibrary, DEFAULT_SETTINGS } = await import('./ui/data.js');
const pl = makePlan(a, defaultLibrary(), {...DEFAULT_SETTINGS, material: process.argv[4]||'alu'});
console.log('STOCK',JSON.stringify(pl.stock),pl.hold);
for(const s of pl.setups){ console.log('##',s.title); s.clamp.forEach(c=>console.log('  -',c)); for(const o of s.ops) console.log(`  ${o.no}. ${o.op} | ${o.tool.label||o.tool.type+' '+o.tool.dia} | S${o.rpm} F${o.feed} | ${o.ap||''} | ${o.ae||''} | so:${o.stickout||''} | ${o.note||''}`); }
console.log('TOOLS', pl.tools.map(t=>t.type+t.dia).join(' ')); console.log('MISSING',pl.missing); console.log('WARN',pl.warnings);
