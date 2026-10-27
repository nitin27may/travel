// Structural validator. validateFile() detects the family from the path (or the content for files
// outside the repository layout); validateDoc() takes an already parsed document.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { CATALOG_FILES, tableOf } from "../schema/index.ts";
import type { Family } from "../schema/meta.ts";
import { validateCatalog, entityOfDoc } from "./catalog.ts";
import { validateDocument } from "./documents.ts";
import type { DocumentKind } from "./documents.ts";
import type { Issue, Result } from "./codes.ts";
import { validateLocations } from "./locations.ts";
import { Refs } from "./refs.ts";
import { checkTable, err, isObj } from "./rows.ts";
import type { Ctx } from "./rows.ts";
import { validateTrip } from "./trip.ts";
import { validateSeasons } from "./seasons.ts";
import { validateWeatherLinks } from "./weatherLinks.ts";
import { validateVocab } from "./vocab.ts";
import { checkDays, makeContext } from "../checks/index.ts";
import type { Row as CheckRow } from "../checks/context.ts";

export type { Issue, Result } from "./codes.ts";
export { CAP_ERROR_CODES, CAP_ERROR_LIST, CAP_WARNING_CODES, CAP_WARNING_LIST } from "./codes.ts";
export { PARK_ERROR_CODES, PARK_ERROR_LIST, PARK_WARNING_CODES, PARK_WARNING_LIST } from "./codes.ts";
export { KEEP_ERROR_CODES, KEEP_ERROR_LIST, KEEP_WARNING_CODES, KEEP_WARNING_LIST, META_ERROR_CODES, META_ERROR_LIST, META_WARNING_CODES, META_WARNING_LIST } from "./codes.ts";
export { ERROR_CODES, ERROR_CODE_LIST, SUIT_ERROR_CODES, SUIT_ERROR_LIST, SUIT_WARNING_CODES, SUIT_WARNING_LIST, REL_ERROR_CODES, REL_ERROR_LIST, REL_WARNING_CODES, REL_WARNING_LIST } from "./codes.ts";

export interface DocInfo {
  family: Family;
  kind?: DocumentKind | "changes" | "backlog" | "vocab" | "seasons" | "weather-links";
  /** catalog folder name */
  entity?: string;
  /** country code taken from a catalog file name */
  fileCC?: string;
  /** trip folder name */
  folder?: string;
}

function norm(p: string): string {
  return p.split(sep).join("/");
}

export function detect(path: string | null, doc: unknown, root: string): DocInfo | null {
  if (path) {
    const rel = norm(relative(resolve(root), resolve(path)));
    const inRepo = !rel.startsWith("..");
    const r = inRepo ? rel : norm(resolve(path));
    let m: RegExpMatchArray | null;
    if ((m = r.match(/(?:^|\/)data\/trips\/([^/]+)\/trip\.json$/))) return { family: "trip", folder: m[1] };
    if (/(?:^|\/)data\/trips\/[^/]+\/routes\/[^/]+\.json$/.test(r) || /(?:^|\/)data\/catalog\/legs\/geo\/[^/]+\.json$/.test(r)) return { family: "sidecar", kind: "route-geometry" };
    if ((m = r.match(/(?:^|\/)data\/catalog\/([a-z]+)\/([A-Z]{2})\.json$/)) && m[1]! in CATALOG_FILES) return { family: "catalog", entity: m[1], fileCC: m[2] };
    if (/(?:^|\/)data\/catalog\/changes\/[^/]+\.jsonl$/.test(r)) return { family: "catalog", kind: "changes" };
    if (/(?:^|\/)data\/catalog\/backlog\.json$/.test(r)) return { family: "catalog", kind: "backlog" };
    if ((m = r.match(/(?:^|\/)data\/seasons\/([^/]+)\.json$/))) return { family: "sidecar", kind: "seasons", folder: m[1] };
    if (/(?:^|\/)data\/reference\/weather-links\.json$/.test(r)) return { family: "sidecar", kind: "weather-links" };
    if (/(?:^|\/)data\/vocab\/tags\.json$/.test(r)) return { family: "sidecar", kind: "vocab" };
    if (/(?:^|\/)data\/vocab\/types\.json$/.test(r)) return { family: "sidecar", kind: "capture-types" };
    if (/(?:^|\/)data\/capture\/operators\.json$/.test(r)) return { family: "sidecar", kind: "capture-operators" };
    if (/(?:^|\/)data\/capture\/supersedes\.json$/.test(r)) return { family: "sidecar", kind: "capture-supersedes" };
    if (/(?:^|\/)data\/capture\/runs\/[^/]+\.json$/.test(r)) return { family: "sidecar", kind: "capture-run" };
    if (/(?:^|\/)data\/capture\/changesets\/[^/]+\.json$/.test(r)) return { family: "sidecar", kind: "capture-changeset" };
    if (/(?:^|\/)data\/capture\/(?!splits\/|runs\/|changesets\/)[^/]+\/[^/]+\.json$/.test(r)) return { family: "sidecar", kind: "capture" };
    if (/(?:^|\/)data\/catalog\/policy\.json$/.test(r)) return { family: "sidecar", kind: "policy" };
    if (/(?:^|\/)data\/schema\/freshness\.json$/.test(r)) return { family: "sidecar", kind: "freshness" };
    if (/(?:^|\/)data\/schema\/difficulty-map\.json$/.test(r)) return { family: "sidecar", kind: "difficulty-map" };
    if (/(?:^|\/)data\/schema\/suitability-applicability\.json$/.test(r)) return { family: "sidecar", kind: "suitability-applicability" };
    if (/(?:^|\/)data\/suitability\/[^/]+\/[^/]+\.json$/.test(r)) return { family: "sidecar", kind: "suitability" };
    if (/(?:^|\/)data\/relevance\/(?!signals\/|derived\/|inputs\/)[^/]+\/[^/]+\.json$/.test(r)) return { family: "sidecar", kind: "relevance" };
    if (/(?:^|\/)data\/sources\/registry\.json$/.test(r)) return { family: "sidecar", kind: "sources" };
    if (/(?:^|\/)data\/locations\/[^/]+\.json$/.test(r) && basename(r) !== "WISHLIST.json") return { family: "locations" };
    if (inRepo && /^research\/.*\.json$/.test(r)) return { family: "sidecar", kind: "research-sidecar" };
  }
  if (isObj(doc)) {
    if (doc.schema === "research-sidecar/1") return { family: "sidecar", kind: "research-sidecar" };
    if (doc.schema === "route-geometry/1") return { family: "sidecar", kind: "route-geometry" };
    if (doc.schema === "suitability/1") return { family: "sidecar", kind: "suitability" };
    if (doc.schema === "relevance/1") return { family: "sidecar", kind: "relevance" };
    if (doc.schema === "capture/1") return { family: "sidecar", kind: "capture" };
    if (doc.schema === "capture-types/1") return { family: "sidecar", kind: "capture-types" };
    if (doc.schema === "capture-operators/1") return { family: "sidecar", kind: "capture-operators" };
    if (doc.schema === "capture-run/1") return { family: "sidecar", kind: "capture-run" };
    if (doc.schema === "capture-supersedes/1") return { family: "sidecar", kind: "capture-supersedes" };
    if (doc.schema === "trip-season-basic/1") return { family: "sidecar", kind: "seasons", folder: typeof doc.trip === "string" ? doc.trip : undefined };
    if (doc.schema === "weather-links/1") return { family: "sidecar", kind: "weather-links" };
    if (doc.schema === "capture-changeset/1") return { family: "sidecar", kind: "capture-changeset" };
    if (doc.schema === "sources/1") return { family: "sidecar", kind: "sources" };
    if ("trip" in doc && "profile" in doc) return { family: "trip" };
    if ("country" in doc && entityOfDoc(doc)) return { family: "catalog", entity: entityOfDoc(doc)! };
    if ("countries" in doc || "places" in doc || "regions" in doc) return { family: "locations" };
    if ("rules" in doc && "promotion" in doc) return { family: "sidecar", kind: "policy" };
    if ("classes" in doc) return { family: "sidecar", kind: "freshness" };
    if ("systems" in doc && "scale" in doc) return { family: "sidecar", kind: "difficulty-map" };
    if ("profiles" in doc && "f_labels" in doc) return { family: "sidecar", kind: "suitability-applicability" };
  }
  return null;
}

function newCtx(refs: Refs): Ctx {
  return { refs, errors: [], warnings: [], schemaBroken: false };
}

/** Validate a parsed document of a known kind. `selfPath` lets the reference index ignore the file on disk. */
export function validateDoc(doc: unknown, family: Family, root: string, info: Partial<DocInfo> = {}, selfPath?: string): Result {
  const refs = new Refs(root);
  if (selfPath) refs.exclude(selfPath);
  const ctx = newCtx(refs);
  if (selfPath) ctx.file = selfPath;
  switch (family) {
    case "trip":
      validateTrip(doc, ctx, info.folder ?? null);
      // day checks (P2b): warnings follow the errors and never change the exit code
      if (!ctx.schemaBroken && ctx.errors.length === 0 && isObj(doc)) {
        for (const w of checkDays(doc as CheckRow, makeContext({ root, trip: doc as CheckRow }))) {
          ctx.warnings.push({ code: w.code, path: w.path, message: w.accepted ? `${w.message} (accepted on day ${w.day})` : w.message });
        }
      }
      break;
    case "catalog":
      if (info.kind === "backlog") {
        if (!isObj(doc) || doc.schema_version !== 1 || !Array.isArray(doc.backlog)) {
          err(ctx, "E_SCHEMA", "", 'backlog.json must look like {"schema_version": 1, "backlog": [...]}.');
        } else checkTable(tableOf("catalog", "backlog"), doc.backlog, "/backlog", ctx);
      } else validateCatalog(doc, ctx, info.entity ?? null, info.fileCC ?? null);
      break;
    case "locations":
      validateLocations(doc, ctx);
      break;
    case "sidecar":
      if (info.kind === "seasons") {
        validateSeasons(doc, ctx, info.folder ?? null);
        break;
      }
      if (info.kind === "weather-links") {
        validateWeatherLinks(doc, ctx, root);
        break;
      }
      if (info.kind === "vocab") {
        validateVocab(doc, ctx);
        break;
      }
      validateDocument(doc, (info.kind ?? "research-sidecar") as DocumentKind, ctx);
      break;
  }
  return { errors: ctx.errors, warnings: ctx.warnings };
}

export function validateFile(path: string, root: string): Result {
  const abs = resolve(path);
  let text: string;
  try {
    text = readFileSync(abs, "utf8");
  } catch (e) {
    return { errors: [{ code: "E_SCHEMA", path: "", message: `cannot read ${path}: ${(e as Error).message}` }], warnings: [] };
  }
  if (abs.endsWith(".jsonl")) return validateChanges(text, root);
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    return { errors: [{ code: "E_SCHEMA", path: "", message: `${path} is not valid JSON: ${(e as Error).message}. Check for a trailing comma or a missing quote.` }], warnings: [] };
  }
  const info = detect(abs, doc, root);
  if (!info) {
    return { errors: [{ code: "E_SCHEMA", path: "", message: `cannot tell what kind of file ${path} is. Trips live at data/trips/<slug>/trip.json, catalog files at data/catalog/<entity>/<CC>.json.` }], warnings: [] };
  }
  return validateDoc(doc, info.family, root, info, abs);
}

function validateChanges(text: string, root: string): Result {
  const refs = new Refs(root);
  const ctx = newCtx(refs);
  const rows: unknown[] = [];
  text.split("\n").forEach((line, i) => {
    if (line.trim() === "") return;
    try {
      rows.push(JSON.parse(line));
    } catch (e) {
      err(ctx, "E_SCHEMA", `/${i}`, `line ${i + 1} is not valid JSON: ${(e as Error).message}. Each line is one JSON object.`);
    }
  });
  checkTable(tableOf("catalog", "catalog_changes"), rows, "", ctx);
  return { errors: ctx.errors, warnings: ctx.warnings };
}

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
}

/** Every file `--all` validates: data/trips, data/catalog, data/locations plus the policy documents. */
export function allFiles(root: string): string[] {
  const all: string[] = [];
  for (const d of ["data/trips", "data/catalog", "data/locations", "data/suitability", "data/relevance", "data/capture", "data/seasons"]) walk(join(root, d), all);
  for (const f of ["data/schema/freshness.json", "data/schema/difficulty-map.json", "data/schema/suitability-applicability.json", "data/vocab/tags.json", "data/vocab/types.json", "data/sources/registry.json", "data/reference/weather-links.json"]) if (existsSync(join(root, f))) all.push(join(root, f));
  const keep = all.filter((p) => {
    const r = norm(relative(root, p));
    if (/\/trip\.json$/.test(r) || /\/routes\/[^/]+\.json$/.test(r)) return true;
    if (/^data\/catalog\/(?:trails|activities|stays|eateries|offers|legs|areas)\/[A-Z]{2}\.json$/.test(r)) return true;
    if (/^data\/catalog\/legs\/geo\/[^/]+\.json$/.test(r)) return true;
    if (/^data\/catalog\/changes\/[^/]+\.jsonl$/.test(r)) return true;
    if (r === "data/catalog/policy.json" || r === "data/catalog/backlog.json") return true;
    if (/^data\/suitability\/[^/]+\/[^/]+\.json$/.test(r)) return true;
    if (/^data\/relevance\/(?!signals\/|derived\/|inputs\/)[^/]+\/[^/]+\.json$/.test(r)) return true;
    if (/^data\/capture\/(?!splits\/|runs\/|changesets\/)[^/]+\/[^/]+\.json$/.test(r) || /^data\/capture\/(?:runs|changesets)\/[^/]+\.json$/.test(r) || r === "data/capture/operators.json" || r === "data/capture/supersedes.json" || r === "data/vocab/types.json") return true;
    if (/^data\/seasons\/[^/]+\.json$/.test(r)) return true;
    if (r === "data/sources/registry.json" || r === "data/reference/weather-links.json") return true;
    if (r === "data/schema/freshness.json" || r === "data/schema/difficulty-map.json" || r === "data/schema/suitability-applicability.json" || r === "data/vocab/tags.json") return true;
    if (/^data\/locations\/(?:locations|[A-Z]{2})\.json$/.test(r)) return true;
    return false;
  });
  return [...new Set(keep)].sort();
}
