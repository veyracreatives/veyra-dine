// Lead finder: looks for restaurants/cafes (Dine In) and sports academies
// (Academy) in Navi Mumbai and Thane. Free source: OpenStreetMap.
// Better source (phones for most places): Google Places, when GOOGLE_PLACES_KEY is set.
import { db, save } from "./store.js";
import { draftOpener } from "./agent.js";

const OVERPASS = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass-api.de/api/interpreter"];
const FOOD = /^(restaurant|cafe|fast_food|bar|pub|food_court|ice_cream)$/;
const GENERIC = /^(department store|restaurant|cafe|hotel|canteen|food court|dhaba)$/i;
const CHAINS = /mc ?don|kfc|burger king|domino|pizza hut|subway|starbucks|havmor|haldiram|baskin|cafe coffee day/i;

export const AREAS = (process.env.LEAD_AREAS || "Vashi,Nerul,Kharghar,Belapur,Seawoods,Airoli,Ghansoli,Koparkhairane,Sanpada,Panvel,Thane West,Ghodbunder Road,Majiwada,Kalwa,Mulund").split(",").map(s => s.trim()).filter(Boolean);
const FOOD_Q = ["restaurant", "cafe"];
const SPORT_Q = ["sports academy", "football academy", "cricket academy", "badminton academy", "swimming classes", "skating classes", "karate classes"];

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "x" + Math.random().toString(36).slice(2, 8);
export function cleanPhone(p) {
  let d = String(p || "").split(/[;,/]/)[0].replace(/\D/g, "");
  if (d.startsWith("91") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10 || new Set(d).size < 4 || /^(1234|0000)/.test(d)) return "";
  return "91" + d;
}

async function add(item) {
  const id = "f-" + slug(item.name + (item.area ? "-" + item.area : ""));
  if (db.found[id] || CHAINS.test(item.name) || GENERIC.test(item.name.trim())) return false;
  for (const f of Object.values(db.found)) if (item.phone && f.phone === item.phone) return false;
  db.found[id] = { id, status: "New", foundAt: new Date().toISOString(), ...item };
  db.found[id].opener = await draftOpener(db.found[id]);
  return true;
}

async function fromGoogle(limit) {
  const key = process.env.GOOGLE_PLACES_KEY; if (!key) return 0;
  let n = 0;
  const jobs = [];
  for (const area of AREAS) { for (const q of FOOD_Q) jobs.push([q, area, "Dine In"]); for (const q of SPORT_Q) jobs.push([q, area, "Academy"]); }
  // rotate through jobs so each day covers different searches
  const start = (db.seen.googleCursor || 0) % jobs.length;
  for (let i = 0; i < jobs.length && n < limit; i++) {
    const [q, area, product] = jobs[(start + i) % jobs.length];
    db.seen.googleCursor = (start + i + 1) % jobs.length;
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.businessStatus" },
      body: JSON.stringify({ textQuery: `${q} in ${area}, Maharashtra`, regionCode: "IN", pageSize: 20 }),
    });
    if (!r.ok) { console.error("Google Places", r.status, (await r.text()).slice(0, 200)); break; }
    const j = await r.json();
    for (const p of j.places || []) {
      if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
      const phone = cleanPhone(p.nationalPhoneNumber);
      if (!phone) continue;
      if (await add({ name: p.displayName?.text || "", area, product, phone, address: p.formattedAddress || "", map: p.googleMapsUri || "", website: p.websiteUri || "", rating: p.rating || null, reviews: p.userRatingCount || 0, source: "Google Maps" })) n++;
      if (n >= limit) break;
    }
  }
  return n;
}

async function fromOSM(limit) {
  const q = `[out:json][timeout:120];(area["name"="Navi Mumbai"]["boundary"="administrative"];area["name"="Thane"]["boundary"="administrative"];)->.a;
(nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub|food_court)$"]["name"](area.a);nwr["leisure"~"^(sports_centre|fitness_centre|sports_hall)$"]["name"](area.a);nwr["club"="sport"]["name"](area.a);nwr["sport"]["name"]["leisure"!~"park|pitch|swimming_pool|track"](area.a););out center tags;`;
  let j = null;
  for (const u of OVERPASS) {
    try { const r = await fetch(u, { method: "POST", body: new URLSearchParams({ data: q }) }); if (r.ok) { j = await r.json(); break; } } catch {}
  }
  if (!j) return 0;
  let n = 0;
  for (const e of j.elements || []) {
    const t = e.tags || {};
    const phone = cleanPhone(t.phone || t["contact:phone"] || t["contact:mobile"]);
    if (!phone || t.brand) continue;
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    const area = t["addr:suburb"] || t["addr:city"] || "";
    if (await add({ name: t.name, area, product: FOOD.test(t.amenity || "") ? "Dine In" : "Academy", phone, address: [t["addr:street"], area].filter(Boolean).join(", "), map: `https://maps.google.com/?q=${lat},${lon}`, website: t.website || t["contact:website"] || "", source: "OpenStreetMap" })) n++;
    if (n >= limit) break;
  }
  return n;
}

export async function findLeads(limit = Number(process.env.LEADS_PER_DAY || 25)) {
  const started = Date.now();
  let g = 0, o = 0;
  try { g = await fromGoogle(limit); } catch (e) { console.error("finder google", e.message); }
  if (g < limit) { try { o = await fromOSM(limit - g); } catch (e) { console.error("finder osm", e.message); } }
  db.seen.lastFind = { at: new Date().toISOString(), google: g, osm: o, ms: Date.now() - started };
  save();
  return db.seen.lastFind;
}

export async function importSeed(list) {
  let n = 0;
  for (const l of list) if (await add(l)) n++;
  save();
  return n;
}
