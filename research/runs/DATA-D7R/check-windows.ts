// Hand check of data/windows/<trip>.json against overview spec 2.2 (trip-windows/1), until OVR-Ca adds the validator.
// Read-only. Usage: node research/runs/DATA-D7R/check-windows.ts [trip-id]
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const trip = process.argv[2] ?? "canadian-rockies-2029";
const { DATE_TEXT, HOUSEHOLD_TEXT } = await import(join(root, "core/src/privacy/dateless.ts"));
const { normaliseUrl, sourceId } = await import(join(root, "core/src/sources/normalize.ts"));

const f = JSON.parse(readFileSync(join(root, "data/windows", `${trip}.json`), "utf8"));
const sched = JSON.parse(readFileSync(join(root, "data/schedules", `${trip}.json`), "utf8"));
const errs: string[] = [];
const warn: string[] = [];
const e = (code: string, msg: string) => errs.push(`${code} ${msg}`);

// refs of the trip
const refs = new Set<string>();
const capDir = join(root, "data/capture", trip);
for (const file of readdirSync(capDir).filter((x) => x.endsWith(".json"))) {
  const d = JSON.parse(readFileSync(join(capDir, file), "utf8"));
  for (const r of d.records ?? d) refs.add(r.ref);
}

if (f.schema !== "trip-windows/1") e("E_SCHEMA", f.schema);
const W = f.windows as any[];
if (W.length < 2 || W.length > 4) e("E_WIN_COUNT", String(W.length));
if (new Set(W.map((w) => w.id)).size !== W.length) e("E_WIN_COUNT", "duplicate ids");
const def = W.find((w) => w.id === f.default);
if (!def) e("E_WIN_DEFAULT", f.default);
const days = Object.keys(sched.days).length;
if (f.length_days !== days) e("E_WIN_LENGTH", `${f.length_days} vs ${days}`);
if (def && JSON.stringify(def.sun) !== JSON.stringify(sched.season)) e("E_WIN_SUN", `${JSON.stringify(def.sun)} vs ${JSON.stringify(sched.season)}`);

const srcIds = new Set<string>();
for (const s of f.sources) {
  if (sourceId(normaliseUrl(s.url)) !== s.id) e("E_WIN_SRC", `source id ${s.id} is not the registry hash of ${s.url}`);
  srcIds.add(s.id);
}
const used = new Set<string>();
const checkSrc = (where: string, x: any, needSrc = true) => {
  const src: string[] = x.src ?? [];
  for (const id of src) { used.add(id); if (!srcIds.has(id)) e("E_WIN_SRC", `${where}: ${id} not in sources`); }
  if (needSrc && src.length === 0 && !(x.basis === "our_inference" && x.note)) e("E_WIN_SRC", `${where}: no src and no inference note`);
  if (x.basis === "our_inference" && !x.note) e("E_WIN_SRC", `${where}: inference without note`);
};
const texts: [string, string][] = [];
const DOY = (m: number, d: number) => new Date(Date.UTC(2027, m - 1, d)).getTime() / 864e5;
const LEN = (m: number, d: number) => DOY(m + 1 > 12 ? 1 : m + 1, 1) - DOY(m, 1);
for (const w of W) {
  const p = `windows.${w.id}`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(w.id)) e("E_WIN_ID", w.id);
  if (!["best", "good", "workable"].includes(w.verdict)) e("E_WIN_VERDICT", `${p} ${w.verdict}`);
  if (![1, 2, 3, 4, "last"].includes(w.start.week)) e("E_WIN_START", p);
  const span = DOY(w.sun.to[0], w.sun.to[1]) - DOY(w.sun.from[0], w.sun.from[1]) + 1;
  if (span !== f.length_days) e("E_WIN_LENGTH", `${p} sun span ${span}`);
  const wk = w.start.week === "last" ? LEN(w.start.month, 1) - 6 : (w.start.week - 1) * 7 + 1;
  if (w.sun.from[0] !== w.start.month || w.sun.from[1] !== wk) warn.push(`W_WIN_SUNSTART ${p} sun.from ${w.sun.from} vs first day of the start week ${wk}`);
  if (w.crowd) { checkSrc(`${p}.crowd`, w.crowd); if (!["lower", "similar", "rising", "high", "peak"].includes(w.crowd.level)) e("E_WIN_CROWD", p); texts.push([`${p}.crowd.note`, w.crowd.note ?? ""]); }
  if (w.plus.length > 4) e("E_WIN_LONG", `${p}.plus ${w.plus.length}`);
  if (w.minus.length > 4) e("E_WIN_LONG", `${p}.minus ${w.minus.length}`);
  for (const k of ["plus", "minus"]) w[k].forEach((x: any, i: number) => {
    const q = `${p}.${k}[${i}]`;
    if (x.text.length > 120) e("E_WIN_LONG", `${q} ${x.text.length} chars`);
    if (!["crowds", "weather", "access", "light", "wildlife", "price", "events", "school"].includes(x.factor)) e("E_WIN_FACTOR", q);
    checkSrc(q, x); texts.push([q, x.text]); if (x.note) texts.push([q + ".note", x.note]);
  });
  w.events.forEach((x: any, i: number) => { checkSrc(`${p}.events[${i}]`, x); texts.push([`${p}.events[${i}]`, x.rule]); });
  w.affects.forEach((x: any, i: number) => {
    const q = `${p}.affects[${i}]`;
    checkSrc(q, x); texts.push([q, x.why]); if (x.note) texts.push([q + ".note", x.note]);
    if (!refs.has(x.ref)) e("E_FK", `${q} ${x.ref}`);
  });
  w.unknown.forEach((x: any, i: number) => { texts.push([`${p}.unknown[${i}]`, x.text]); texts.push([`${p}.unknown[${i}].tried`, x.tried]); if (!x.searched) e("E_WIN_UNKNOWN", `${p}.unknown[${i}] no date`); });
  texts.push([`${p}.label`, w.label], [`${p}.best_for`, w.best_for]);
}
for (const s of f.sources) if (s.note) texts.push([`sources.${s.id}.note`, s.note]);
for (const [where, t] of texts) {
  if (DATE_TEXT.test(t)) e("E_WIN_DATE", `${where}: ${t}`);
  if (HOUSEHOLD_TEXT.test(t)) e("E_PRIVACY", `${where}: ${t}`);
  if (/\b(19|20)\d{2}\b/.test(t) && !/\d{4}-\d{2}/.test(t)) warn.push(`W_YEAR ${where}: bare year in text (allowed only as a provenance figure year)`);
}
const starts = W.map((w) => ({ id: w.id, d: DOY(w.sun.from[0], w.sun.from[1]) })).sort((a, b) => a.d - b.d);
for (let i = 1; i < starts.length; i++) if (starts[i].d - starts[i - 1].d < 7) warn.push(`W_WIN_CLOSE ${starts[i - 1].id} ${starts[i].id}`);
for (const s of srcIds) if (!used.has(s)) warn.push(`W_SRC_UNUSED ${s}`);
// privacy words the file must never carry
const raw = JSON.stringify(f);
for (const word of [/\bparty\b/i, /\bbooked\b/i, /\bhotel\b/i, /\bour (son|daughter|kid)\b/i, /Whitby|Toronto|Ontario home/i]) if (word.test(raw)) warn.push(`W_PRIVACY_WORD ${word}`);

console.log(`windows ${W.length}; default ${f.default}; sources ${srcIds.size}; texts scanned ${texts.length}`);
for (const w of warn) console.log("WARN", w);
for (const x of errs) console.log("ERROR", x);
console.log(errs.length ? `FAIL ${errs.length}` : "OK: every spec 2.2 rule that can be checked by hand passes");
process.exit(errs.length ? 1 : 0);
