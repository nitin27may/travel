// Validator for the capture family: capture/1 sidecars (E_CAP_*, W_CAP_*), data/vocab/types.json, data/capture/operators.json and
// crawl run records. Structure comes from the Zod schema; this file adds what a schema cannot hold: the tree rules, the type
// and layer rules, relation targets, derived relations, the operator and source rules, and the run record's consistency.
import { z } from "zod";
import * as E from "../schema/enums.ts";
import { PROPERTIES, PROPERTY_BY_KEY } from "../schema/capture/properties.ts";
import type { CaptureDoc, CaptureOperator, CaptureRecord } from "../schema/capture/records.ts";
import { RELATION_RULES, describeEndpoints, nestedWrapper, protectedRefRule, sourceAllowed, targetAllowed, targetsOf, typeUnder } from "../schema/capture/relations.ts";
import type { NodeFacts, OfferClass } from "../schema/capture/relations.ts";
import { captureRun } from "../schema/capture/records.ts";
import type { TypesFile } from "../schema/capture/typesFile.ts";
import { tableOf } from "../schema/index.ts";
import { applicabilityFile } from "../capture/generate.ts";
import { unknownRecordKeys } from "./keep.ts";
import { completeness } from "../capture/engine.ts";
import { loadWorld } from "../capture/records.ts";
import { checkSupersedes } from "../capture/supersedeCheck.ts";
import { inStore, levelOf, levelOfLink, severityOf } from "../capture/gapBudget.ts";
import { loadPlacement, placementFindings } from "../capture/placementBlock.ts";
import { recordTier } from "../capture/tiers.ts";
import type { SupersedesFile } from "../schema/capture/records.ts";
import type { World } from "../capture/records.ts";
import { resolveNode } from "../capture/resolve.ts";
import { categoryOf, checkTree, loadTypes, treeOf } from "../capture/tree.ts";
import { loadMap } from "../suitability/map.ts";
import { APPLICABILITY_PATHS, EXT_KINDS } from "../suitability/paths.ts";
import { RefResolver } from "../suitability/refs.ts";
import { PHOTO_LICENCE_ALLOWED, photoLicenceOk } from "../capture/photoLicence.ts";
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

/** The value keys a record may hold only where its type asks for them (W_CAP_NA_FIELD). */
const HELD_VALUE_KEYS = ["season", "hours", "price", "window", "best_window", "best_time", "duration_min", "activity_min", "book_url", "check_in_out", "fills_by", "closures", "groceries", "address"] as const;

/** The order of two closure dates of the same form (YYYY, YYYY-MM, YYYY-MM-DD or MM-DD); null when the forms differ. */
const closureOrder = (from: string, to: string): number | null => {
  const recurring = (d: string): boolean => /^\d{2}-\d{2}$/.test(d);
  if (recurring(from) !== recurring(to)) return null;
  if (recurring(from)) return 0; // MM-DD may wrap the year (12-01 to 03-31): a valid winter closure, so any order is allowed
  const n = Math.min(from.length, to.length);
  return from.slice(0, n) <= to.slice(0, n) ? 0 : -1;
};

/**
 * What the schema cannot say about the values RIS-H gave a home (catalogue-intake 5.3): a range is low to high, the time on the
 * activity fits inside the door-to-door time, a one-off closure does not end before it starts, and a booking page is the
 * operator's own, never a link-only platform. Each finding names the fix. Exported for the unit tests.
 */
export function homedValueFindings(r: CaptureDoc["records"][number]): { code: string; key: string; message: string }[] {
  const out: { code: string; key: string; message: string }[] = [];
  const range = (k: "duration_min" | "activity_min"): [number, number] | null => (r[k]?.state === "value" && r[k]?.v ? (r[k]!.v as [number, number]) : null);
  for (const k of ["duration_min", "activity_min"] as const) {
    const v = range(k);
    if (v && v[0] > v[1]) out.push({ code: "E_CAP_SCHEMA", key: k, message: `"${k}" is [${v[0]}, ${v[1]}]: the low end is above the high end. Give minutes low to high. Example: [120, 180] for "2 to 3 hours".` });
  }
  const d = range("duration_min"), a = range("activity_min");
  if (d && a && a[1] > d[1]) out.push({ code: "E_CAP_SCHEMA", key: "activity_min", message: `"activity_min" (up to ${a[1]} min) is longer than "duration_min" (up to ${d[1]} min). The time on the activity is part of the door-to-door time; check both against the operator page.` });
  if (r.closures?.state === "value") for (const [j, c] of (r.closures.v ?? []).entries()) {
    if (c.to !== undefined && closureOrder(c.from, c.to) === -1) out.push({ code: "E_CAP_SCHEMA", key: `closures/v/${j}`, message: `closure ${j} ends (${c.to}) before it starts (${c.from}). Leave "to" out for an open-ended closure.` });
    if (c.to !== undefined && closureOrder(c.from, c.to) === null) out.push({ code: "E_CAP_SCHEMA", key: `closures/v/${j}`, message: `closure ${j} mixes a yearly MM-DD date with a calendar date (${c.from} to ${c.to}). Use MM-DD at both ends for a closure that recurs every year, a calendar date at both ends otherwise.` });
  }
  if (r.book_url?.state === "value" && typeof r.book_url.v === "string") {
    const hit = linkOnly(r.book_url.v);
    if (hit) out.push({ code: "E_CAP_LINK_ONLY", key: "book_url", message: `book_url points at ${hit}, a link-only platform. Give the operator's own booking page; keep the platform as a link.` });
  }
  return out;
}

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

// ---------------------------------------------------------------------------------------------------- supersedes (9.7)
export function validateCaptureSupersedes(doc: unknown, ctx: Ctx): void {
  if (!isObj(doc)) {
    err(ctx, "E_CAP_SCHEMA", "", "the file must be one JSON object with schema, sources and entries.");
    ctx.schemaBroken = true;
    return;
  }
  if (!structural(doc, "capture_supersedes", ctx)) return;
  for (const i of checkSupersedes(ctx.refs.root, doc as unknown as SupersedesFile)) {
    if (i.warning) ctx.warnings.push({ code: i.code, path: i.path, message: i.message });
    else err(ctx, i.code, i.path, i.message);
  }
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
    if (r.outcome === "ask" && (!r.to || !r.question)) err(ctx, "E_CAP_RUN", base, `an ask result names who it goes to and the question. Example: {"outcome": "ask", "to": "Alpine Stables", "contact_url": "https://example.org/contact", "question": "What is the weight limit for rides over 2 hours?"}.`);
    if (r.outcome !== "ask" && (r.to || r.contact_url || r.question)) err(ctx, "E_CAP_RUN", base, `to, contact_url and question belong to an ask result; this one is ${r.outcome}.`);
    if (r.contact_url && linkOnly(r.contact_url)) err(ctx, "E_CAP_LINK_ONLY", `${base}/contact_url`, `the contact page is ${linkOnly(r.contact_url)}, a link-only platform. Use the operator's own contact page.`);
  });
  for (const h of run.hosts) {
    if (h.robots === "forbidden" && h.requests > 0 && h.status === "ok") err(ctx, "E_CAP_RUN", `/hosts`, `host ${h.host} forbids automated access by robots.txt but the run made ${h.requests} request(s) and reports ok. Stop the host (status blocked) and use a single-page read.`);
    if (h.terms === "forbidden" && h.requests > 0 && h.status === "ok") err(ctx, "E_CAP_RUN", `/hosts`, `host ${h.host} forbids automated access in its terms but the run made ${h.requests} request(s) and reports ok. Terms are obeyed even where a technical block is absent (9.2).`);
  }
}

// ---------------------------------------------------------------------------------------------------- capture sidecar
/** Why a derived name is never stored, and where its value comes from. */
function derivedMessage(k: string): string {
  if (k === "reached_by") return `reached_by is the derived inverse of reaches and is never stored. Remove it; the place's "How to get there" is computed from the routes that reach it.`;
  if (k === "members_all") return `members_all is the containment closure, computed by the graph index. Remove it; name the container on each member with part_of.`;
  if (k === "requirements") return `requirements are computed from the record's chain (entity-graph 7.2). Remove them; store each fee or permit as an access offer at the container that imposes it.`;
  const rule = RELATION_RULES.find((r) => r.inverse === k);
  return `${k} is the derived inverse of ${rule ? rule.key : "a stored relation"} and is never stored. Remove it; store the link once, as ${rule ? rule.key : "the relation"} on the other record (entity-graph 5.1).`;
}

const an = (layer: string): string => (/^[aeiou]/.test(layer) ? `an ${layer}` : `a ${layer}`);

/** A record's booking page: its book_url value, else its first booking link. */
const bookingPage = (r: CaptureRecord): string | null =>
  (r.book_url?.state === "value" && typeof r.book_url.v === "string" ? r.book_url.v : null) ?? r.links?.find((l) => l.kind === "booking" && l.url)?.url ?? null;

/** The link kinds a member inherits from its container by fallback (entity-graph 7.1): a copy of the container's is W_CAP_INHERITED_COPY. */
const INHERITED_LINK_KINDS = ["conditions", "status", "booking"];

export function validateCapture(doc: unknown, ctx: Ctx, world?: World): void {
  const root = ctx.refs.root;
  const E_ = (code: string, path: string, message: string): void => err(ctx, code, path, message);
  const W = (code: string, path: string, message: string): void => void ctx.warnings.push({ code, path, message });
  if (!isObj(doc)) {
    E_("E_CAP_SCHEMA", "", "the file must be one JSON object with schema, trip, lane, researched, agent, model, sources and records.");
    ctx.schemaBroken = true;
    return;
  }
  // derived inverses (entity-graph 5.2): report each, then parse without it
  const clone = structuredClone(doc) as Row;
  (Array.isArray(clone.records) ? (clone.records as unknown[]) : []).forEach((r, i) => {
    if (isObj(r)) for (const k of E.CAP_RELATION_DERIVED) {
      if (!(k in r)) continue;
      E_("E_CAP_REL_DERIVED", `/records/${i}/${k}`, derivedMessage(k));
      delete r[k];
    }
    // a window phase is one level deep (protected-area-entry C3): report a nested `then` here, then parse without it
    const win = isObj(r) && isObj(r.window) && isObj(r.window.v) ? (r.window.v as Row) : null;
    if (win && isObj(win.then) && "then" in win.then) {
      E_("E_WINDOW_THEN", `/records/${i}/window/v/then/then`, `a window's "then" is one second phase and has no "then" of its own. Keep a third phase in the window's fallback text (protected-area-entry, Gotchas).`);
      delete (win.then as Row).then;
    }
    // the keep rule (spec 2): a key that is no registry property, no capture/1 schema key and not meta is reported once, then dropped
    if (isObj(r)) for (const k of unknownRecordKeys(r)) {
      E_("E_KEEP_UNKNOWN", `/records/${i}/${k}`, `"${k}" is not a registry property, a capture/1 schema key or meta. Store a fact only as a property that serves K1 to K7 (node core/bin/capture.ts fields --type <id>); row facts go in meta; reasoning stays in research/runs/.`);
      delete r[k];
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
  const w = world ?? loadWorld(root, ctx.file);
  // the whole world with this document in it, for the completeness engine
  const full = world ?? loadWorld(root, ctx.file, [d]);
  const resolver = new RefResolver(root);
  // the placement block and the tiers (3.7): severity by the gap budget's pinned refs, the file's place in the store, the towns layer
  const pw = loadPlacement(root, full);
  const sev = severityOf(root, pw.townsLayer);
  const store = inStore(root, ctx.file);
  const emit = (code: string, refs: string[], path: string, message: string): void => (levelOf(code, refs, store, sev) === "error" ? E_(code, path, message) : W(code, path, message));
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
  // ---- the graph helpers the relation rules need (entity-graph 5 and 6) ----
  const primaryOf = (ref: string): string => full.alias.get(ref) ?? ref;
  const recOf = (ref: string): CaptureRecord | null => full.cap.get(primaryOf(ref))?.rec ?? null;
  const classOf = new Map<string, OfferClass | null>();
  const facts = (x: CaptureRecord): NodeFacts => {
    if (!classOf.has(x.type)) classOf.set(x.type, (resolveNode(x.type, loadTypes(root))?.layers.offer?.offer_class ?? null) as OfferClass | null);
    return { layer: x.layer, type: x.type, offerClass: (x.offer_class as OfferClass | undefined) ?? (x.layer === "offer" ? classOf.get(x.type) ?? null : null) };
  };
  /** a target fault warns on a pinned record or a known fault (the gap budget's `known`), unless the code is strict; a draft warns */
  const relLevel = (code: string, refs: string[], rel: string, tg: string): "error" | "warning" => levelOfLink(code, refs, rel, tg, store, sev);
  // covers_areas membership (6.1 rule 2): area id -> the protected areas that cover it
  const coverIdx = new Map<string, string[]>();
  for (const { rec } of full.cap.values()) for (const a of rec.covers_areas ?? []) coverIdx.set(a, [...(coverIdx.get(a) ?? []), rec.ref]);
  /**
   * The direct containers of a record: its explicit part_of (6.1 rule 1, which wins), else the protected areas covering its area. A
   * record that itself has covers_areas is never an area member of another protected area (EG-R0 M1): only its explicit part_of
   * places it, so two parks over one area (a peace park over a national park) do not contain each other.
   * TODO(EG-I): replace with the one containment function EG-I exports from its graph module (a follow-up merge task unifies
   * them); it must keep this rule.
   */
  const containersOf = (ref: string): string[] => {
    const x = recOf(ref);
    if (!x) return [];
    // a self-link is E_CAP_REL_REF already, so it is not a loop here
    if (x.part_of && x.part_of.length > 0) return [...new Set(x.part_of.map(primaryOf))].filter((p) => p !== x.ref);
    if ((x.covers_areas?.length ?? 0) > 0) return [];
    return x.area_id ? (coverIdx.get(x.area_id) ?? []).filter((p) => p !== x.ref) : [];
  };
  /** the requirement offers (access.pass) at or on a record */
  const requirementsAt = (ref: string): string[] => {
    const inc = full.incoming.get(ref);
    return [...(inc?.offers_at ?? []), ...(inc?.offers_on ?? [])].filter((o) => typeUnder(recOf(o)?.type ?? "", "access.pass"));
  };
  /** every container up the chain, nearest first, without the record itself */
  const ancestorsOf = (ref: string): string[] => {
    const out: string[] = [];
    const seenA = new Set([ref]);
    const queue = containersOf(ref);
    while (queue.length > 0) {
      const a = queue.shift()!;
      if (seenA.has(a)) continue;
      seenA.add(a);
      out.push(a);
      queue.push(...containersOf(a));
    }
    return out;
  };
  /** a loop back to `start` through `next`, as the path, or null */
  const cycleOf = (start: string, next: (x: string) => string[]): string[] | null => {
    const stack: [string, string[]][] = [[start, [start]]];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const [x, path] = stack.pop()!;
      for (const y of next(x)) {
        if (y === start) return [...path, y];
        if (visited.has(y)) continue;
        visited.add(y);
        stack.push([y, [...path, y]]);
      }
    }
    return null;
  };
  /** W_CAP_INHERITED_COPY (7.1): links and requirement offers a container already holds */
  const inheritedCopies = (r: CaptureRecord): string[] => {
    const out: string[] = [];
    const anc = ancestorsOf(r.ref);
    for (const l of r.links ?? []) {
      if (!l.url || !INHERITED_LINK_KINDS.includes(l.kind)) continue;
      const from = anc.find((a) => (recOf(a)?.links ?? []).some((x) => x.kind === l.kind && x.url === l.url));
      if (from) out.push(`the ${l.kind} link ${l.url} is the same as the one on ${from}, which this record inherits (entity-graph 7.1). Remove it here.`);
    }
    if (r.layer === "offer" && typeUnder(r.type, "access.pass")) {
      const page = bookingPage(r);
      if (page) for (const t of r.at ?? []) for (const a of ancestorsOf(primaryOf(t))) {
        const twin = (full.incoming.get(a)?.offers_at ?? []).find((o) => o !== r.ref && recOf(o)?.type === r.type && bookingPage(recOf(o)!) === page);
        if (twin) out.push(`${r.ref} repeats ${twin} (same type ${r.type} and booking page ${page}), which is at ${a} up the chain of ${t}; members inherit it (entity-graph 7.2). Remove the copy.`);
      }
    }
    return out;
  };
  /**
   * W_PARK_AREA (protected-area-entry 4.1): the store area named after a protected area, or null. Named after it means the area's own
   * slug (the last part of its id) is the park's page slug or its name as a slug, in the same country as the park's area_id.
   */
  const parkAreaNamed = (x: CaptureRecord): string | null => {
    const slugs = new Set([x.ref, ...(x.aliases ?? [])].flatMap((ref) => /^place\/([a-z0-9-]+)$/.exec(ref)?.[1] ?? []));
    if (x.name) slugs.add(x.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
    const cc = x.area_id?.split("/")[0];
    for (const a of pw.tree.areaIds) if (slugs.has(a.split("/").pop() ?? "") && (!cc || a.split("/")[0] === cc)) return a;
    return null;
  };
  const hintOf = (rel: string, layer: string): string => {
    if ((rel === "parks_for" || rel === "serves") && layer === "offer") return " A meeting place or launch of an offer is the offer's starts_at, not a parks_for of the place.";
    if (rel === "on" && layer === "place") return " An offer on a river or lake place is at it; on is for routes.";
    if (rel === "starts_at" && layer === "route") return " Start at a place: the lift's top or bottom station, not the line.";
    return "";
  };

  const seen = new Map<string, number>();
  d.records.forEach((r, i) => {
    const base = `/records/${i}`;
    const row = r as unknown as Row;
    const why = resolver.why(r.ref);
    if (why) E_("E_CAP_REF", `${base}/ref`, `ref "${r.ref}" does not resolve: ${why}. A new record cut out of another is part/<parent ref>#<slug> or offer/<parent ref>#<product>.`);
    const nested = nestedWrapper(r.ref);
    if (nested) E_("E_CAP_REF", `${base}/ref`, `ref "${r.ref}" ${nested}.`);
    const first = seen.get(r.ref);
    if (first !== undefined) E_("E_CAP_DUP_REF", `${base}/ref`, `ref "${r.ref}" appears in records ${first} and ${i} of this file. Keep one record per ref.`);
    else seen.set(r.ref, i);
    const other = w.cap.get(r.ref);
    if (other && first === undefined) E_("E_CAP_DUP_REF", `${base}/ref`, `ref "${r.ref}" is also in ${other.file.startsWith(root) ? other.file.slice(root.length + 1) : other.file}. Keep one record per ref.`);
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
    // where draw lives (relevance rules 3.7): the place a visitor comes to see, unless the route is itself the experience
    if (r.route_is_attraction && r.layer !== "route") E_("E_CAP_DRAW_LAYER", `${base}/route_is_attraction`, `route_is_attraction is for routes; ${r.ref} is a ${r.layer}.`);
    if (r.route_is_attraction && !r.attraction_reason) E_("E_CAP_DRAW_LAYER", `${base}/attraction_reason`, `route_is_attraction needs attraction_reason: say why the route itself is the thing visited (a circuit, a scenic drive, a ride).`);
    if (r.layer === "route" && !r.route_is_attraction && full.rel.has(r.ref)) E_("E_CAP_DRAW_LAYER", `${base}/route_is_attraction`, `${r.ref} is a route with a relevance record (draw, class). Draw belongs to the place the route reaches: move the record to it, or set route_is_attraction: true with attraction_reason when the route is itself the experience.`);
    // the ref grammar's top-level rule for protected areas (4.4 rule 4)
    const top = protectedRefRule(r.type, [r.ref, ...(r.aliases ?? [])]);
    // a zone names the protected area it sits in (E_PARK_ZONE); when its ref already breaks the zone branch of E_CAP_REF_TOP, that one
    // finding says both, so a zone is never reported twice
    const zoneParent = r.type === "nature.protected.zone" ? (r.part_of ?? []).some((p) => typeUnder(recOf(p)?.type ?? "", "nature.protected")) : true;
    const zoneFix = "name the protected area it sits in with part_of (a nature.protected record)";
    if (top) emit("E_CAP_REF_TOP", [r.ref, ...(r.aliases ?? [])], `${base}/ref`, `${r.ref} (${r.type}): ${top}${zoneParent ? "" : `; also ${zoneFix}`}.`);
    else if (!zoneParent) E_("E_PARK_ZONE", `${base}/part_of`, `${r.ref} is a protected-area zone but ${(r.part_of ?? []).length ? `none of its part_of (${(r.part_of ?? []).join(", ")}) is a protected area` : "it has no part_of"}: ${zoneFix}. Example: "part_of": ["place/yoho-national-park"].`);
    if (r.layer === "place" && typeUnder(r.type, "nature.protected") && r.type !== "nature.protected.zone") {
      const named = parkAreaNamed(r);
      if (named && !(r.covers_areas ?? []).includes(named)) W("W_PARK_AREA", `${base}/covers_areas`, `the locations store has the area ${named}, named after ${r.ref}, but covers_areas does not name it. Add it, so every record in that area is a member of the park; or give the records explicit part_of if the area is wider than the park.`);
    }
    // the requirement's own blocks (protected-area-entry 5.1 C1, C2, C3)
    if (r.summary !== undefined && r.layer !== "offer") E_("E_CAP_SCHEMA", `${base}/summary`, `summary on the capture record is for offers only (they have no relevance record). A ${r.layer}'s summary is the "why" of its relevance record.`);
    if (r.entry && !(r.layer === "offer" && typeUnder(r.type, "access.pass"))) E_("E_ENTRY_SCHEMA", `${base}/entry`, `entry is the block of a requirement: an access.pass offer (entry fee, pass, permit, timed entry, seat). ${r.ref} is ${an(r.layer)} of type ${r.type}. Store the requirement as its own access.pass offer at this record.`);
    for (const [j, t] of (r.entry?.v?.for_types ?? []).entries()) if (!tree.byId.has(t)) E_("E_ENTRY_SCHEMA", `${base}/entry/v/for_types/${j}`, `for_types names "${t}", which is not a node of data/vocab/types.json. Give a type prefix the permit applies to. Example: "water.fishing".`);
    const wv = r.window?.state === "value" ? r.window.v : null;
    if (wv?.then && (wv.rule === "anytime" || wv.rule === "on_arrival")) E_("E_WINDOW_THEN", `${base}/window/v/then`, `a window with rule ${wv.rule} has no second phase: it is open the whole time. Remove "then", or give the first phase its own rule (fixed_date, lottery, monthly_release, rolling, same_day).`);
    // a member's own sourced "nothing needed" hides what it would inherit (entity-graph 5.2, 7.1): listed for review
    const ac = full.rel.get(r.ref)?.rec.access_cost;
    if (ac?.state === "no_limit" && (ac.src?.length ?? 0) > 0) {
      const inherited = ancestorsOf(r.ref).flatMap((a) => requirementsAt(a).map((o) => `${o} (at ${a})`));
      if (inherited.length > 0) W("W_ENTRY_OVERRIDE", base, `${r.ref} says, with a source, that no entry fee or permit is needed (access_cost no_limit), which removes ${inherited.length} requirement${inherited.length > 1 ? "s" : ""} it would inherit: ${inherited.slice(0, 4).join(", ")}${inherited.length > 4 ? `, +${inherited.length - 4} more` : ""}. Check the source; if the record is outside the park, give it part_of instead.`);
    }
    // relations (RELATION_RULES, entity-graph 5.1 and 5.2)
    const own0 = [r.ref, ...(r.aliases ?? [])];
    const me = facts(r);
    for (const rule of RELATION_RULES) {
      const f = rule.key;
      const all = targetsOf(row, f);
      if (all.length === 0) continue;
      // one link per target (EG-R0 S10): a repeat, by ref or by alias, is reported and never counts toward cardinality
      const firstOf = new Map<string, string>();
      for (const tg of all) if (!firstOf.has(primaryOf(tg))) firstOf.set(primaryOf(tg), tg);
      const targets = [...firstOf.values()];
      if (targets.length < all.length) W("W_CAP_REL_DUP", `${base}/${f}`, `"${f}" names the same record more than once (${all.filter((t, j) => all.findIndex((u) => primaryOf(u) === primaryOf(t)) !== j).join(", ")}, counting aliases). Keep one.`);
      if (!sourceAllowed(rule, me)) E_("E_CAP_REL_KIND", `${base}/${f}`, `"${f}" is not allowed on ${an(r.layer)} of type ${r.type}. It is a relation of ${describeEndpoints(rule.source)} (entity-graph 5.1).`);
      for (const m of rule.max) {
        if (m.layer && m.layer !== r.layer) continue;
        if (targets.length <= m.n) continue;
        const msg = `"${f}" names ${targets.length} records; ${m.layer ? `a ${m.layer}` : "a record"} holds at most ${m.n}${m.code === "W_CAP_REL_PARENTS" ? " (the first is the breadcrumb default; a third parent usually means one is an area member already)" : ""}.`;
        if (m.code.startsWith("E_")) E_(m.code, `${base}/${f}`, msg);
        else W(m.code, `${base}/${f}`, msg);
      }
      for (const tg of targets) {
        // the record itself, by its ref or one of its aliases (EG-R0 S5)
        if (primaryOf(tg) === r.ref || own0.includes(tg)) {
          E_("E_CAP_REL_REF", `${base}/${f}`, `"${f}" points at the record itself${tg !== r.ref ? ` (${tg} is its own alias)` : ""}.`);
          continue;
        }
        if (rule.shape === "areas") {
          if (!pw.tree.areaIds.has(tg)) E_("E_PARK_AREA", `${base}/${f}`, `covers_areas names "${tg}", which is not an area of data/locations/locations.json${pw.tree.ids.has(tg) ? " (it is a country or region: a park covers areas, never a whole region)" : ""}. Use an area id of the store, or add the area there first (the location skill). Example: "CA/AB/banff-national-park".`);
          continue;
        }
        if (f === "run_by") {
          if (!w.operators.has(tg)) E_("E_CAP_OPERATOR", `${base}/run_by`, `operator "${tg}" is not in data/capture/operators.json. Add it there (name and URL), or leave run_by out.`);
          continue;
        }
        const k = known(tg);
        if (k) {
          E_("E_CAP_REL_REF", `${base}/${f}`, `"${f}" names ${tg}, which resolves to nothing: ${k}.`);
          continue;
        }
        const tr = recOf(tg);
        if (!tr) continue; // a scope item or legacy row with no capture record: its kind is not known yet
        const tf = facts(tr);
        if (!targetAllowed(rule, tf, r.layer)) {
          const code = "E_CAP_REL_TARGET";
          const msg = `"${f}" names ${tg}, ${an(tr.layer)} (${tr.type}); ${f} points at ${describeEndpoints(rule.target)}.${hintOf(f, tr.layer)}`;
          if (relLevel(code, own0, f, tg) === "error") E_(code, `${base}/${f}`, msg);
          else W(code, `${base}/${f}`, msg);
        }
        if (rule.same) {
          const sameLayer = tr.layer === r.layer;
          const sameCat = !rule.same.category || categoryOf(tree, tr.type) === categoryOf(tree, r.type);
          if (!sameLayer || !sameCat) {
            const code = rule.oneLevel ? "E_CAP_VARIANT" : "E_CAP_REL_TARGET";
            const msg = `"${f}" names ${tg}, ${an(tr.layer)} of category ${categoryOf(tree, tr.type)}; ${f} joins records of the same layer${rule.same.category ? " and category" : ""} (this is ${an(r.layer)} of ${categoryOf(tree, r.type)}).`;
            if (code === "E_CAP_VARIANT" || relLevel(code, own0, f, tg) === "error") E_(code, `${base}/${f}`, msg);
            else W(code, `${base}/${f}`, msg);
          }
        }
        if (rule.oneLevel && tr.variant_of) E_("E_CAP_VARIANT", `${base}/${f}`, `"${f}" names ${tg}, which is itself a variant of ${tr.variant_of}. One level only: point at the primary, ${tr.variant_of}.`);
        if (rule.symmetric && targetsOf(tr as unknown as Row, f).some((x) => primaryOf(x) === r.ref || (r.aliases ?? []).includes(x))) {
          E_("E_CAP_REL_SYM", `${base}/${f}`, `"${f}" is stored on both ${r.ref} and ${tg}. A symmetric link is stored once, on either side; remove one.`);
        }
      }
    }
    // loops (part_of counting covers_areas membership, variant_of)
    const loop = cycleOf(r.ref, (x) => containersOf(x));
    if (loop) E_("E_CAP_REL_CYCLE", `${base}/part_of`, `containment loops: ${loop.join(" -> ")}. A container never sits inside its own member; remove one part_of, or set part_of on the record that sits in the wrong covered area.`);
    const vloop = cycleOf(r.ref, (x) => {
      const v = recOf(x)?.variant_of;
      return v && primaryOf(v) !== x ? [primaryOf(v)] : [];
    });
    if (vloop) E_("E_CAP_REL_CYCLE", `${base}/variant_of`, `variant_of loops: ${vloop.join(" -> ")}. One record is the primary and has no variant_of.`);
    // facts copied from a container (7.1: fallback links, requirements up the chain)
    for (const msg of inheritedCopies(r)) W("W_CAP_INHERITED_COPY", base, msg);
    for (const a of r.aliases ?? []) {
      const k = resolver.why(a);
      if (k) E_("E_CAP_REF", `${base}/aliases`, `alias "${a}" does not resolve: ${k}.`);
      if (a === r.ref) E_("E_CAP_REF", `${base}/aliases`, `alias "${a}" is the record's own ref.`);
    }
    // values: sources and states
    const vals: [string, unknown][] = [["geonames_id", r.geonames_id], ["near_town", r.near_town], ["near_town_km", r.near_town_km], ["season", r.season], ["best_window", r.best_window], ["best_time", r.best_time], ["hours", r.hours], ["duration_min", r.duration_min], ["activity_min", r.activity_min], ["check_in_out", r.check_in_out], ["price", r.price], ["window", r.window], ["entry", r.entry], ["book_url", r.book_url], ["fills_by", r.fills_by], ["closures", r.closures], ["groceries", r.groceries], ["address", r.address],
      // osm_ref as a Val (LT-C); a bare id string carries no provenance of its own
      ...(r.osm_ref && typeof r.osm_ref === "object" ? [["osm_ref", r.osm_ref] as [string, unknown]] : [])];
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
    for (const f of homedValueFindings(r)) E_(f.code, `${base}/${f.key}`, f.message);
    for (const [j, l] of (r.links ?? []).entries()) {
      for (const s of l.src ?? []) if (!ids.has(s)) E_("E_CAP_SRC", `${base}/links/${j}/src`, `src names ${JSON.stringify(s)}, which is not in this file's sources.`);
      if ((E.CAP_LINK_ONLY_KIND as readonly string[]).includes(l.kind) && l.state === "filled" && l.url && !l.on) W("W_CAP_NA_FIELD", `${base}/links/${j}`, `a ${l.kind} link is link-only: record the date it was found (found_in_search with "on"), and never read its figures.`);
      if (l.url && linkOnly(l.url) && !(E.CAP_LINK_ONLY_KIND as readonly string[]).includes(l.kind)) E_("E_CAP_LINK_ONLY", `${base}/links/${j}/url`, `a ${l.kind} link points at ${linkOnly(l.url)}. That platform is a link-only kind (alltrails, komoot, gaia, outdooractive, wikiloc, trailforks, reseller), never official.`);
    }
    // photo licences stay on the allowlist (media.md 6, DD-3)
    for (const [j, p] of (r.photos ?? []).entries()) {
      if (!photoLicenceOk(p.licence)) E_("E_CAP_PHOTO_LICENCE", `${base}/photos/${j}/licence`, `photo licence "${p.licence}" is not on the allowlist (${PHOTO_LICENCE_ALLOWED.join(", ")}). NC, ND, all rights reserved and the Unsplash and Pexels licences are refused (DD-3); leave the photo out, or keep a link to its page instead.`);
    }
    // the completeness engine: required properties no value answers
    if (full) {
      const c = completeness(full, r.ref);
      if (c && c.level !== "usable" && c.level !== "complete" && c.level !== "usable_partial") {
        const miss = [...c.missingBase, ...c.conditionalMissing];
        if (miss.length > 0) W("W_CAP_BELOW_USABLE", base, `${r.type} (${r.layer}) is ${c.level}: ${miss.length} required propert${miss.length > 1 ? "ies" : "y"} unanswered (${miss.slice(0, 6).join(", ")}${miss.length > 6 ? `, +${miss.length - 6} more` : ""}), and ${c.missingSuitability.length} in the suitability block. Run: node core/bin/capture.ts fields --ref ${r.ref}`);
      }
    }
    // the placement block (3.7): area chain, point with its role, nearest town; offers and events through at, on, starts_at
    const own = [r.ref, ...(r.aliases ?? [])];
    for (const f of placementFindings(pw, r)) emit(f.code, own, `${base}/${f.key}`, f.message);
    // the required tier of the record's kind: the R marks of its type, read by the same engine (placement keys are reported above)
    const tier = recordTier(full, r.ref);
    if (tier && tier.requiredMissing.length > 0) {
      const miss = tier.requiredMissing;
      emit("W_TIER_REQUIRED", own, base, `${r.type} (${tier.kind.replace("_", " ")}) leaves ${miss.length} of the ${tier.required.length} keys of its required tier unanswered: ${miss.slice(0, 6).join(", ")}${miss.length > 6 ? `, +${miss.length - 6} more` : ""}. Give each a value, or searched_none with "on" and "tried"; a gap is never a yes. Run: node core/bin/capture.ts fields --ref ${r.ref}`);
    }
    // present but not asked
    const rl = node.layers[r.layer];
    if (rl) for (const k of HELD_VALUE_KEYS) {
      if ((r as unknown as Row)[k] !== undefined && !(k in rl.base)) W("W_CAP_NA_FIELD", `${base}/${k}`, `${r.type} (${r.layer}) never asks for "${k}", but the record holds one. Remove it, or correct the type.`);
    }
  });
  // stage order (4.6): the stages of a route chain by ends_at to starts_at; once per whole route, at its first stage in this file
  const wholes = new Map<string, number>();
  d.records.forEach((r, i) => {
    if (r.layer !== "route") return;
    for (const p of r.part_of ?? []) if (recOf(p)?.layer === "route" && !wholes.has(primaryOf(p))) wholes.set(primaryOf(p), i);
  });
  if (wholes.size > 0) {
    const stagesOf = new Map<string, CaptureRecord[]>();
    for (const { rec } of full.cap.values()) {
      if (rec.layer !== "route") continue;
      for (const p of new Set((rec.part_of ?? []).map(primaryOf))) if (wholes.has(p)) stagesOf.set(p, [...(stagesOf.get(p) ?? []), rec]);
    }
    for (const [whole, i] of wholes) {
      const why = stageChainProblem(stagesOf.get(whole) ?? [], primaryOf);
      if (why) W("W_CAP_STAGE_ORDER", `/records/${i}/part_of`, `the stages of ${whole} do not chain: ${why}. Give each stage starts_at and ends_at so that one stage's end is the next one's start (entity-graph 4.6); the page lists them by name until then.`);
    }
  }
}

/**
 * Why the stages of one route do not form one chain (entity-graph 4.6), or null when they do: stage n's ends_at equals stage n+1's
 * starts_at, one first stage, no branches, every stage on the chain. Exported for the unit tests.
 */
export function stageChainProblem(stages: readonly CaptureRecord[], primary: (ref: string) => string = (x) => x): string | null {
  if (stages.length < 2) return null;
  const start = (s: CaptureRecord): string | null => (s.starts_at?.[0] ? primary(s.starts_at[0]) : null);
  const end = (s: CaptureRecord): string | null => (s.ends_at?.[0] ? primary(s.ends_at[0]) : null);
  const next = new Map<string, CaptureRecord[]>();
  for (const a of stages) {
    const e = end(a);
    next.set(a.ref, e ? stages.filter((b) => b !== a && start(b) === e) : []);
  }
  const branched = stages.find((a) => (next.get(a.ref) ?? []).length > 1);
  if (branched) return `${branched.ref} ends where ${(next.get(branched.ref) ?? []).length} stages start`;
  // a merge (EG-R0 S4): two stages end where one starts, as in A to B, B to C and C back to B
  const prevs = new Map<string, string[]>();
  for (const a of stages) for (const b of next.get(a.ref) ?? []) prevs.set(b.ref, [...(prevs.get(b.ref) ?? []), a.ref]);
  const merged = stages.find((b) => (prevs.get(b.ref) ?? []).length > 1);
  if (merged) return `${merged.ref} starts where ${(prevs.get(merged.ref) ?? []).length} stages end (${(prevs.get(merged.ref) ?? []).join(", ")})`;
  const hasPrev = new Set(stages.flatMap((a) => (next.get(a.ref) ?? []).map((b) => b.ref)));
  const heads = stages.filter((s) => !hasPrev.has(s.ref));
  if (heads.length !== 1) {
    const loose = heads.filter((h) => !end(h) || !start(h)).map((h) => h.ref);
    return heads.length === 0 ? "they form a loop with no first stage" : `${heads.length} stages have no stage before them${loose.length ? ` (${loose.join(", ")} lack starts_at or ends_at)` : ""}`;
  }
  let at: CaptureRecord | undefined = heads[0];
  const walked = new Set<string>();
  while (at && !walked.has(at.ref)) {
    walked.add(at.ref);
    at = (next.get(at.ref) ?? [])[0];
  }
  return walked.size === stages.length ? null : `only ${walked.size} of ${stages.length} stages follow on from ${heads[0]!.ref}`;
}

