// Validator for the capture family: capture/1 sidecars (E_CAP_*, W_CAP_*), data/vocab/types.json, data/capture/operators.json and
// crawl run records. Structure comes from the Zod schema; this file adds what a schema cannot hold: the tree rules, the type
// and layer rules, relation targets, derived relations, the operator and source rules, and the run record's consistency.
import { z } from "zod";
import * as E from "../schema/enums.ts";
import { PROPERTIES, PROPERTY_BY_KEY } from "../schema/capture/properties.ts";
import type { CaptureDoc, CaptureOperator } from "../schema/capture/records.ts";
import { captureRun } from "../schema/capture/records.ts";
import type { TypesFile } from "../schema/capture/typesFile.ts";
import { tableOf } from "../schema/index.ts";
import { applicabilityFile } from "../capture/generate.ts";
import { loadWorld } from "../capture/records.ts";
import type { World } from "../capture/records.ts";
import { resolveNode } from "../capture/resolve.ts";
import { checkTree, loadTypes, treeOf } from "../capture/tree.ts";
import { loadMap } from "../suitability/map.ts";
import { APPLICABILITY_PATHS, EXT_KINDS } from "../suitability/paths.ts";
import { RefResolver } from "../suitability/refs.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateApplicabilityRules } from "./applicability.ts";
import { checkTable, err, isObj } from "./rows.ts";
import type { Ctx, Row } from "./rows.ts";

type Emit = (code: string, path: string, message: string) => void;

/** Hosts that are only ever links (9.2). Same set as the suitability and relevance validators, plus Yelp. */
const LINK_ONLY_HOSTS: [RegExp, string][] = [
  [/(^|\.)alltrails\.com$/, "AllTrails"],
  [/(^|\.)komoot\.[a-z.]+$/, "Komoot"],
  [/(^|\.)gaiagps\.com$/, "Gaia GPS"],
  [/(^|\.)outdooractive\.com$/, "Outdooractive"],
  [/(^|\.)wikiloc\.com$/, "Wikiloc"],
  [/(^|\.)trailforks\.com$/, "Trailforks"],
  [/(^|\.)strava\.com$/, "Strava"],
  [/(^|\.)fatmap\.com$/, "FATMAP"],
  [/(^|\.)google\.[a-z.]+$/, "Google"],
  [/(^|\.)tripadvisor\.[a-z.]+$/, "Tripadvisor"],
  [/(^|\.)yelp\.[a-z.]+$/, "Yelp"],
  [/(^|\.)booking\.com$/, "Booking.com"],
  [/(^|\.)(viator|getyourguide|expedia|airbnb|civitatis)\.[a-z.]+$/, "a booking site"],
];
const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return "";
  }
};
const linkOnly = (u: string): string | null => LINK_ONLY_HOSTS.find(([re]) => re.test(hostOf(u)))?.[1] ?? null;

function describeIssue(issue: z.core.$ZodIssue): string {
  const path = "/" + issue.path.join("/");
  const field = String(issue.path[issue.path.length - 1] ?? "the file");
  switch (issue.code) {
    case "invalid_value":
      return `${path}: "${field}" must be one of ${(issue.values ?? []).map((v) => JSON.stringify(v)).join(", ")}. Example: ${JSON.stringify(issue.values?.[0] ?? "...")}.`;
    case "invalid_type":
      return `${path}: "${field}" must be a ${issue.expected}. Example: see data/capture/README.md.`;
    case "unrecognized_keys":
      return `${path}: unknown key${issue.keys.length > 1 ? "s" : ""} ${issue.keys.map((k) => `"${k}"`).join(", ")}. Remove ${issue.keys.length > 1 ? "them" : "it"} or check the spelling against data/schema/generated/schema.json.`;
    case "invalid_format":
      return `${path}: "${field}" is not in the expected format. Example: a type id is "water.river.rafting", a date is "2026-10-18".`;
    default:
      return `${path}: "${field}" ${issue.message}. Example: see data/capture/README.md.`;
  }
}

/** The generic table check, with its E_SCHEMA findings reported under this family's code. */
function structural(doc: Row, table: string, ctx: Ctx): boolean {
  const sub: Ctx = { refs: ctx.refs, errors: [], warnings: [], schemaBroken: false };
  checkTable(tableOf("sidecar", table), doc, "", sub);
  for (const e of sub.errors) err(ctx, "E_CAP_SCHEMA", e.path, e.message);
  for (const w of sub.warnings) ctx.warnings.push(w);
  if (sub.schemaBroken || sub.errors.length > 0) ctx.schemaBroken = true;
  return !ctx.schemaBroken;
}

// ---------------------------------------------------------------------------------------------------- types.json
export function validateCaptureTypes(doc: unknown, ctx: Ctx): void {
  const root = ctx.refs.root;
  if (!isObj(doc)) {
    err(ctx, "E_CAP_SCHEMA", "", "the file must be one JSON object with schema, note, updated, profiles, layers and nodes.");
    ctx.schemaBroken = true;
    return;
  }
  if (!structural(doc, "capture_types", ctx)) return;
  const file = doc as unknown as TypesFile;
  let classes: Set<string> | null = null;
  const cp = join(root, "data", "vocab", "relevance-classes.json");
  if (existsSync(cp)) {
    try {
      classes = new Set((JSON.parse(readFileSync(cp, "utf8")) as { classes: { key: string }[] }).classes.map((c) => c.key));
    } catch {
      classes = null;
    }
  }
  const map = loadMap(root);
  const issues = checkTree(file, {
    propertyKeys: new Set(PROPERTIES.map((p) => p.key)),
    profileOk: (n) => n in file.profiles,
    relevanceClasses: classes,
    gradeSystems: new Set(map.systems.map((s) => s.id)),
    extKinds: new Set(EXT_KINDS),
    suitabilityPaths: new Set(APPLICABILITY_PATHS),
  });
  for (const i of issues) err(ctx, "E_CAP_TREE", `/nodes/${i.id}`, `${i.id}: ${i.message}.`);
  // every grade system the tree names must also be a value of GRADE_SYSTEM
  for (const n of file.nodes) for (const s of n.effort?.scales ?? []) if (!(E.GRADE_SYSTEM as readonly string[]).includes(s)) err(ctx, "E_CAP_TREE", `/nodes/${n.id}`, `${n.id}: effort scale "${s}" is not in GRADE_SYSTEM (core/src/schema/enums.ts). Append it there.`);
  // the profile rows are the applicability file; run its rules on the generated copy
  const gen = JSON.parse(applicabilityFile(file).text) as Row;
  const sub: Ctx = { refs: ctx.refs, errors: [], warnings: [], schemaBroken: false };
  validateApplicabilityRules(gen, sub);
  for (const e of sub.errors) err(ctx, "E_CAP_PROFILE", e.path.replace(/^\/profiles/, "/profiles"), e.message);
}

// ---------------------------------------------------------------------------------------------------- operators
export function validateCaptureOperators(doc: unknown, ctx: Ctx): void {
  if (!isObj(doc)) {
    err(ctx, "E_CAP_SCHEMA", "", "the file must be one JSON object with schema, updated and operators.");
    ctx.schemaBroken = true;
    return;
  }
  if (!structural(doc, "capture_operators", ctx)) return;
  const seen = new Set<string>();
  (doc.operators as CaptureOperator[]).forEach((o, i) => {
    if (seen.has(o.ref)) err(ctx, "E_CAP_OPERATORS", `/operators/${i}/ref`, `operator ${o.ref} appears twice. Keep one record per operator.`);
    seen.add(o.ref);
    for (const k of ["url", "terms_url", "waiver_url"] as const) {
      const u = o[k];
      if (u && linkOnly(u)) err(ctx, "E_CAP_LINK_ONLY", `/operators/${i}/${k}`, `operator ${o.ref} points at ${linkOnly(u)}, a link-only platform. Use the operator's own page.`);
    }
  });
}

// ---------------------------------------------------------------------------------------------------- run record
export function validateCaptureRun(doc: unknown, ctx: Ctx): void {
  if (!isObj(doc)) {
    err(ctx, "E_CAP_SCHEMA", "", "the file must be one JSON object with schema, run, started, agent, model, scope, hosts and results.");
    ctx.schemaBroken = true;
    return;
  }
  const parsed = captureRun.safeParse(doc);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) err(ctx, "E_CAP_SCHEMA", "/" + issue.path.join("/"), describeIssue(issue));
    ctx.schemaBroken = true;
    return;
  }
  const run = parsed.data;
  const hosts = new Set(run.hosts.map((h) => h.host));
  const scopeRefs = new Set(run.scope.refs ?? []);
  run.results.forEach((r, i) => {
    const base = `/results/${i}`;
    if (!PROPERTY_BY_KEY.has(r.field)) err(ctx, "E_CAP_RUN", `${base}/field`, `field "${r.field}" is not a property of the registry. See: node core/bin/capture.ts fields --type <id>.`);
    if (scopeRefs.size > 0 && !scopeRefs.has(r.ref)) err(ctx, "E_CAP_RUN", `${base}/ref`, `ref ${r.ref} is not in the run's scope.refs.`);
    if (r.outcome === "blocked" && (!r.reason || !r.host)) err(ctx, "E_CAP_RUN", base, `a blocked result names the host and the reason (robots, terms, 404, 429, login). Example: {"outcome": "blocked", "host": "reservations.ontarioparks.ca", "reason": "terms"}.`);
    if (r.outcome === "blocked" && r.host && !hosts.has(r.host)) err(ctx, "E_CAP_RUN", `${base}/host`, `host ${r.host} is not listed in hosts.`);
    if (r.outcome === "searched_none" && (!r.tried || r.tried.length === 0)) err(ctx, "E_CAP_RUN", base, `searched_none lists the pages tried. Example: {"outcome": "searched_none", "tried": ["https://example.org/facilities"]}.`);
    if ((r.outcome === "filled" || r.outcome === "conflict") && !r.src) err(ctx, "E_CAP_RUN", base, `a ${r.outcome} result names its source row. Example: "src": "src-0012".`);
  });
  for (const h of run.hosts) {
    if (h.robots === "forbidden" && h.requests > 0 && h.status === "ok") err(ctx, "E_CAP_RUN", `/hosts`, `host ${h.host} forbids automated access by robots.txt but the run made ${h.requests} request(s) and reports ok. Stop the host (status blocked) and use a single-page read.`);
    if (h.terms === "forbidden" && h.requests > 0 && h.status === "ok") err(ctx, "E_CAP_RUN", `/hosts`, `host ${h.host} forbids automated access in its terms but the run made ${h.requests} request(s) and reports ok. Terms are obeyed even where a technical block is absent (9.2).`);
  }
}

// ---------------------------------------------------------------------------------------------------- capture sidecar
const RELATION_FIELDS = ["reaches", "passes", "part_of", "starts_at", "ends_at", "on", "at", "run_by", "parks_for", "serves", "combo_with", "alternative_to", "variant_of"] as const;

function targetsOf(rec: Row, field: string): string[] {
  const v = rec[field];
  if (v === undefined) return [];
  if (typeof v === "string") return [v];
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : isObj(x) && typeof x.ref === "string" ? x.ref : "")).filter((x) => x !== "");
}

export function validateCapture(doc: unknown, ctx: Ctx, world?: World): void {
  const root = ctx.refs.root;
  const E_ = (code: string, path: string, message: string): void => err(ctx, code, path, message);
  const W = (code: string, path: string, message: string): void => void ctx.warnings.push({ code, path, message });
  if (!isObj(doc)) {
    E_("E_CAP_SCHEMA", "", "the file must be one JSON object with schema, trip, lane, researched, agent, model, sources and records.");
    ctx.schemaBroken = true;
    return;
  }
  // reached_by is derived: report it, then parse without it
  const clone = structuredClone(doc) as Row;
  (Array.isArray(clone.records) ? (clone.records as unknown[]) : []).forEach((r, i) => {
    if (isObj(r) && "reached_by" in r) {
      E_("E_CAP_REL_DERIVED", `/records/${i}/reached_by`, `reached_by is the derived inverse of reaches and is never stored. Remove it; the place's "How to get there" is computed from the routes that reach it.`);
      delete r.reached_by;
    }
  });
  const t = tableOf("sidecar", "capture");
  const parsed = t.schema.safeParse(clone);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const p = issue.path;
      if (p[0] === "sources" && typeof p[1] === "number" && p[2] === "read") E_("E_CAP_SRC", "/" + p.slice(0, 3).join("/"), `source ${String((clone.sources as Row[])?.[p[1]]?.id ?? p[1])} has no read date. Give the date the page was fetched. Example: "read": "2026-10-18".`);
      else E_("E_CAP_SCHEMA", "/" + p.join("/"), describeIssue(issue));
    }
    ctx.schemaBroken = true;
    return;
  }
  const d = parsed.data as unknown as CaptureDoc;
  const tree = treeOf(loadTypes(root));
  const w = world ?? loadWorld(root);
  const resolver = new RefResolver(root);
  const ids = new Set<string>();
  d.sources.forEach((s, i) => {
    if (ids.has(s.id)) E_("E_CAP_SRC", `/sources/${i}/id`, `source id "${s.id}" appears twice. Give each source its own id. Example: "src-0002".`);
    ids.add(s.id);
    const hit = linkOnly(s.url);
    if (hit) E_("E_CAP_LINK_ONLY", `/sources/${i}/url`, `source ${s.id} is ${hit}, a link-only platform: its figures are never data. Cite the operator or the land manager, and keep ${hit} as a link.`);
    const crawled = s.method === "crawl" || s.method === "api";
    if (crawled && !s.run) E_("E_CAP_METHOD", `/sources/${i}/run`, `source ${s.id} was taken by ${s.method} but names no run. Give the run id of its data/capture/runs/<run>.json. Example: "run": "crawl-2026-10-21-ontario-parks".`);
    if (s.run && !crawled) E_("E_CAP_METHOD", `/sources/${i}/method`, `source ${s.id} names run "${s.run}" but its method is ${s.method ?? "not stated"}. A run id goes with method crawl or api.`);
  });
  const own = new Set(d.records.map((r) => r.ref));
  const known = (ref: string): string | null => {
    if (own.has(ref) || w.cap.has(ref) || w.alias.has(ref) || w.suit.has(ref) || w.rel.has(ref)) return null;
    return resolver.why(ref);
  };
  const seen = new Map<string, number>();
  d.records.forEach((r, i) => {
    const base = `/records/${i}`;
    const row = r as unknown as Row;
    const why = resolver.why(r.ref);
    if (why) E_("E_CAP_REF", `${base}/ref`, `ref "${r.ref}" does not resolve: ${why}. A new record cut out of another is part/<parent ref>#<slug> or offer/<parent ref>#<product>.`);
    const first = seen.get(r.ref);
    if (first !== undefined) E_("E_CAP_DUP_REF", `${base}/ref`, `ref "${r.ref}" appears in records ${first} and ${i} of this file. Keep one record per ref.`);
    else seen.set(r.ref, i);
    const other = w.cap.get(r.ref);
    if (other && other.file && !other.file.endsWith(`/${d.trip}/${d.lane}.json`) && first === undefined && other.trip === d.trip && !ctx.refs.root.includes("\u0000")) {
      // the same trip must not carry a ref in two files (the loader keeps the first); ignore the file being validated
      if (!sameFile(other.file, d.trip, d.lane)) E_("E_CAP_DUP_REF", `${base}/ref`, `ref "${r.ref}" is also in ${other.file.slice(root.length + 1)}. Keep one record per ref.`);
    }
    const node = resolveNode(r.type, loadTypes(root));
    if (!node) {
      E_("E_CAP_TYPE", `${base}/type`, `type "${r.type}" is not in data/vocab/types.json. Find the nearest with: node core/bin/capture.ts types --tree. Example: "water.river.rafting".`);
      return;
    }
    if (node.level === "domain" || (node.level === "category" && !tree.byId.get(r.type)?.category)) E_("E_CAP_TYPE", `${base}/type`, `type "${r.type}" is a ${node.level}, not a type. Give a type or subtype id. Example: "${(tree.children.get(r.type) ?? [])[0] ?? "water.river.rafting"}".`);
    if (!node.records.includes(r.layer)) E_("E_CAP_LAYER", `${base}/layer`, `layer "${r.layer}" is not allowed for ${r.type}; it is a ${node.records.join(" or ")}. A summit is a place, a trail is a route, a rafting trip is an offer.`);
    // the suitability record of the same ref must agree: kind and subkind are derived from the type for old readers
    const sr = w.suit.get(r.ref)?.rec;
    if (sr?.subkind) {
      const legacy = tree.legacy.get(`${sr.kind}/${sr.subkind}`);
      const lp = legacy ? resolveNode(legacy, loadTypes(root))?.profile : null;
      if (lp && node.profile && lp !== node.profile) E_("E_CAP_TYPE", `${base}/type`, `type ${r.type} has the suitability profile "${node.profile}" but the suitability record of ${r.ref} is ${sr.kind}/${sr.subkind}, which has "${lp}". Make the kind and subkind of that record match the type, or correct the type.`);
    }
    // relations
    for (const f of RELATION_FIELDS) {
      const targets = targetsOf(row, f);
      if (targets.length === 0) continue;
      const def = PROPERTY_BY_KEY.get(f);
      if (def?.layers && !def.layers.includes(r.layer)) E_("E_CAP_REL_KIND", `${base}/${f}`, `"${f}" is not allowed on a ${r.layer}. It is a relation of ${def.layers.join(" or ")} records (capture contract 2.5).`);
      for (const tg of targets) {
        if (tg === r.ref) E_("E_CAP_REL_REF", `${base}/${f}`, `"${f}" points at the record itself.`);
        else if (f === "run_by") {
          if (!w.operators.has(tg)) E_("E_CAP_OPERATOR", `${base}/run_by`, `operator "${tg}" is not in data/capture/operators.json. Add it there (name and URL), or leave run_by out.`);
        } else {
          const k = known(tg);
          if (k) E_("E_CAP_REL_REF", `${base}/${f}`, `"${f}" names ${tg}, which resolves to nothing: ${k}.`);
        }
      }
    }
    for (const a of r.aliases ?? []) {
      const k = resolver.why(a);
      if (k) E_("E_CAP_REF", `${base}/aliases`, `alias "${a}" does not resolve: ${k}.`);
      if (a === r.ref) E_("E_CAP_REF", `${base}/aliases`, `alias "${a}" is the record's own ref.`);
    }
    // values: sources and states
    const vals: [string, unknown][] = [["season", r.season], ["best_window", r.best_window], ["best_time", r.best_time], ["hours", r.hours], ["duration_min", r.duration_min], ["activity_min", r.activity_min], ["price", r.price], ["window", r.window], ["book_url", r.book_url]];
    for (const [k, v] of vals) {
      if (!v) continue;
      const x = v as { v: unknown; state: string; basis: string | null; src: string[]; on?: string; tried?: string[] };
      const path = `${base}/${k}`;
      if (x.state === "value" && (x.v === null || x.basis === null)) E_("E_CAP_SCHEMA", path, `"${k}" has state "value" but no v or no basis. Example: {"v": ..., "state": "value", "basis": "operator_info", "src": ["src-0001"]}.`);
      if (x.state !== "value" && x.v !== null) E_("E_CAP_SCHEMA", path, `"${k}" has state "${x.state}" so v must be null.`);
      if (x.state === "searched_none" && (!x.on || !x.tried || x.tried.length === 0)) E_("E_CAP_SCHEMA", path, `"${k}" is searched_none without "on" and "tried". Say when you looked and what you tried.`);
      for (const s of x.src) if (!ids.has(s)) E_("E_CAP_SRC", `${path}/src`, `src names ${JSON.stringify(s)}, which is not in this file's sources. Add it there or remove it. Example: "src-0001".`);
      if (x.state === "value" && x.src.length === 0 && x.basis !== "our_inference") E_("E_CAP_SRC", path, `"${k}" has a value but no source. Cite the page it came from, or use basis our_inference with a note.`);
    }
    for (const [j, l] of (r.links ?? []).entries()) {
      for (const s of l.src ?? []) if (!ids.has(s)) E_("E_CAP_SRC", `${base}/links/${j}/src`, `src names ${JSON.stringify(s)}, which is not in this file's sources.`);
      if ((E.CAP_LINK_ONLY_KIND as readonly string[]).includes(l.kind) && l.state === "filled" && l.url && !l.on) W("W_CAP_NA_FIELD", `${base}/links/${j}`, `a ${l.kind} link is link-only: record the date it was found (found_in_search with "on"), and never read its figures.`);
      if (l.url && linkOnly(l.url) && !(E.CAP_LINK_ONLY_KIND as readonly string[]).includes(l.kind)) E_("E_CAP_LINK_ONLY", `${base}/links/${j}/url`, `a ${l.kind} link points at ${linkOnly(l.url)}. That platform is a link-only kind (alltrails, komoot, gaia, outdooractive, wikiloc, trailforks, reseller), never official.`);
    }
    // present but not asked
    const rl = node.layers[r.layer];
    if (rl) for (const k of ["season", "hours", "price", "window", "best_window", "best_time", "duration_min", "activity_min", "book_url"] as const) {
      if ((r as unknown as Row)[k] !== undefined && !(k in rl.base)) W("W_CAP_NA_FIELD", `${base}/${k}`, `${r.type} (${r.layer}) never asks for "${k}", but the record holds one. Remove it, or correct the type.`);
    }
  });
}

function sameFile(file: string, trip: string, lane: string): boolean {
  return file.replace(/\\/g, "/").endsWith(`/capture/${trip}/${lane}.json`);
}
