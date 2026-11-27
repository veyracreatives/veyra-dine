// Tiny JSON database with atomic writes and daily backups.
import fs from "node:fs";
import path from "node:path";
const DIR = process.env.DATA_DIR || path.resolve("data");
const FILE = path.join(DIR, "db.json");
fs.mkdirSync(path.join(DIR, "backups"), { recursive: true });

const empty = () => ({ chats: {}, found: {}, settings: { botOn: true }, seen: {} });
export const db = fs.existsSync(FILE) ? { ...empty(), ...JSON.parse(fs.readFileSync(FILE, "utf8")) } : empty();

let timer = null;
export function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
  }, 200);
}
export function saveNow() { clearTimeout(timer); const tmp = FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, FILE); }
export function backup() {
  const day = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(DIR, "backups", `db-${day}.json`), JSON.stringify(db));
  const files = fs.readdirSync(path.join(DIR, "backups")).sort();
  for (const f of files.slice(0, Math.max(0, files.length - 30))) fs.unlinkSync(path.join(DIR, "backups", f));
}
export const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;
