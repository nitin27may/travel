// The rules of capture contract 9.7 that need the raw lane records and the migration ledger. The shape is the table
// capture_supersedes (schema); what a schema cannot say is here: the source rule, the stale check, the ledger rule, the path rule.
import { createHash } from "node:crypto";
import type { SupersedeEntry, SupersedesFile } from "../schema/capture/records.ts";
import { SUPERSEDE_BASES } from "../schema/capture/records.ts";
import { normaliseUrl } from "../sources/normalize.ts";
import { LEDGER_PATH } from "./migrate.ts";
import type { Ledger } from "./migrate.ts";
import { loadWorld, readJson } from "./records.ts";
import { getAt, isValLike, sameValue } from "./supersede.ts";

export interface SupIssue { code: string; path: string; message: string; warning?: boolean }

const leafHash = (leaf: string): string => createHash("sha1").update(leaf).digest("hex").slice(0, 12);

/** The leaves of a value the way the ledger writes them ("path=value"), for the Val at `path`. */
function leavesAt(path: string, v: unknown): string[] {
  const out: string[] = [];
  const walk = (x: unknown, p: string): void => {
    if (Array.isArray(x)) {
      if (x.length === 0) out.push(`${p}=[]`);
      x.forEach((y) => walk(y, p + "[]"));
    } else if (x !== null && typeof x === "object") {
      const keys = Object.keys(x as object);
      if (keys.length === 0) out.push(`${p}={}`);
      for (const k of keys) walk((x as Record<string, unknown>)[k], `${p}.${k}`);
    } else out.push(`${p}=${JSON.stringify(x)}`);
  };
  walk(v, `${path}.v`);
  return out;
}

/** Same JSON kind and, for an object, the same keys: the shape of the Val being replaced. */
function sameShape(a: unknown, b: unknown): boolean {
  if (a === null || b === null) return a === b || a === null || b === null;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b);
  if (typeof a === "object" || typeof b === "object") {
    if (typeof a !== "object" || typeof b !== "object") return false;
    return sameValue(Object.keys(a as object).sort(), Object.keys(b as object).sort());
  }
  return typeof a === typeof b;
}

const LINK_ONLY = /(^|\.)(alltrails|komoot|gaiagps|outdooractive|wikiloc|trailforks|strava|fatmap|tripadvisor|yelp|booking)\.|(^|\.)google\./;

export function checkSupersedes(root: string, file: SupersedesFile): SupIssue[] {
  const issues: SupIssue[] = [];
  const add = (code: string, i: number, message: string, field = ""): void => void issues.push({ code, path: `/entries/${i}${field}`, message });
  const world = loadWorld(root, undefined, [], { supersede: false });
  const ledger = readJson<Ledger>(`${root}/${LEDGER_PATH}`);
  const held = (layer: "suitability" | "relevance"): Set<string> => new Set((ledger?.[layer]?.held ?? []).map((h) => h.split("*")[0]!));
  const sources = new Map(file.sources.map((s) => [s.id, s]));
  for (const s of file.sources) {
    try {
      if (LINK_ONLY.test(new URL(s.url).hostname.toLowerCase())) issues.push({ code: "E_CAP_LINK_ONLY", path: `/sources/${s.id}`, message: `source ${s.id} is on a link-only platform; only an official or operator page can supersede.` });
    } catch {
      issues.push({ code: "E_SUP_SRC", path: `/sources/${s.id}`, message: `source ${s.id} has a url that does not parse.` });
    }
  }
  const seen = new Set<string>();
  file.entries.forEach((e: SupersedeEntry, i) => {
    const id = `${e.id} (${e.ref} ${e.path})`;
    const key = `${e.layer}|${e.ref}|${e.path}`;
    if (seen.has(key)) add("E_SUP_DUP", i, `${id}: a second entry for the same ref and path. Keep one; edit it.`);
    seen.add(key);
    if (!(SUPERSEDE_BASES as readonly string[]).includes(e.value.basis)) {
      add("E_SUP_BASIS", i, `${id}: basis "${e.value.basis}" cannot supersede. Only ${SUPERSEDE_BASES.join(", ")}; a community or inference re-read stays a conflict.`, "/value/basis");
    }
    if (e.value.src.length === 0) add("E_SUP_SRC", i, `${id}: no source. An override without a source is rejected; name the official page.`, "/value/src");
    for (const s of e.value.src) if (!sources.has(s)) add("E_SUP_SRC", i, `${id}: source ${s} is not in this file's sources.`, "/value/src");
    if (e.value.src.length > 0 && e.value.src.every((s) => sources.get(s)?.kind !== "official" && sources.get(s)?.kind !== "operator")) {
      add("E_SUP_BASIS", i, `${id}: no cited source is an official or operator page.`, "/value/src");
    }
    if (e.layer === "capture") {
      add("E_SUP_NOT_LEDGER", i, `${id}: capture records are post-migration, so there is no ledger leaf to keep. Edit the value in place.`, "/layer");
      return;
    }
    const located = (e.layer === "suitability" ? world.suit : world.rel).get(e.ref) ?? (e.layer === "suitability" ? world.suit : world.rel).get(world.alias.get(e.ref) ?? "");
    if (!located) {
      add("E_SUP_PATH", i, `${id}: no ${e.layer} record has this ref.`, "/ref");
      return;
    }
    const cur = getAt(located.rec, e.path);
    if (!isValLike(cur)) {
      add("E_SUP_PATH", i, `${id}: ${e.path} is not a value (v, state, basis, src) in the record that wins for ${e.ref}.`, "/path");
      return;
    }
    if (!sameValue(cur.v, e.was)) {
      add("E_SUP_STALE", i, `${id}: was is ${JSON.stringify(e.was)} but the stored value is ${JSON.stringify(cur.v)}. The override is stale; re-read and update it.`, "/was");
      return;
    }
    const h = held(e.layer);
    const lost = leavesAt(e.path, cur.v).filter((l) => !h.has(leafHash(l)));
    if (lost.length > 0) add("E_SUP_NOT_LEDGER", i, `${id}: the stored value is not a pre-migration leaf (${lost[0]}). A post-migration value is edited in place; it needs no override.`, "/was");
    if (!sameShape(cur.v, e.value.v) || (e.value.state === "value" && e.value.v === null)) {
      add("E_SUP_SCHEMA", i, `${id}: the new value does not have the shape of the one it replaces (${JSON.stringify(cur.v)}).`, "/value/v");
    }
    const laneSrc = (world.suit.get(e.ref) ?? world.rel.get(e.ref))?.file;
    const lane = laneSrc ? readJson<{ sources?: { url: string }[] }>(laneSrc) : null;
    for (const s of e.value.src) {
      const row = sources.get(s);
      if (row && lane && !(lane.sources ?? []).some((x) => normaliseUrl(x.url) === normaliseUrl(row.url))) {
        issues.push({ code: "W_SUP_LANE_SRC", path: `/entries/${i}/value/src`, message: `${id}: ${row.url} is not in the lane file's sources, so the page shows the basis without a source link.`, warning: true });
      }
    }
  });
  return issues;
}
