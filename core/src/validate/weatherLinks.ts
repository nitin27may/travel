// data/reference/weather-links.json (weather-links/1): the schema in core/src/schema/weatherLinks.ts plus the rules a zod object cannot hold:
//   - every `trip` is a known trip id (a folder under data/capture, data/suitability, data/relevance or data/trips, or a data/seasons file),
//     and appears once;
//   - every link's `publisher` is a key of `publishers`;
//   - every url is https, has no credentials, no email address and no query parameter that could carry personal data;
//   - `reachable: false` rows are allowed, but a trip with no drawable (reachable) forecast needs a fallback, and a fallback that is also
//     unreachable is a warning (the page then shows no weather link until a person opens the page and confirms it);
//   - reachable rows have an http status below 400.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { weatherLinksFile } from "../schema/weatherLinks.ts";
import { err, isObj } from "./rows.ts";
import type { Ctx } from "./rows.ts";

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+/;
/** query parameter names that would carry a visitor, a party or a secret; coordinates and station keys are fine */
const PERSONAL_PARAM = /^(e-?mail|mail|user(name|id)?|uid|name|first_?name|last_?name|phone|tel|token|session|sid|auth|key|apikey|api_key|password|pass|party|adults?|children|kids?|age|ages|trip|visitor|ip)$/i;

/** Trip ids the repository knows: data/trips/<id>/, data/capture|suitability|relevance/<id>/ and data/seasons/<id>.json. */
export function knownTripIds(root: string): Set<string> {
  const ids = new Set<string>();
  for (const d of ["data/trips", "data/capture", "data/suitability", "data/relevance"]) {
    const dir = join(root, d);
    if (!existsSync(dir)) continue;
    for (const n of readdirSync(dir)) if (statSync(join(dir, n)).isDirectory() && !["catalogue", "derived", "inputs", "signals", "splits", "runs", "changesets"].includes(n)) ids.add(n);
  }
  const seasons = join(root, "data/seasons");
  if (existsSync(seasons)) for (const n of readdirSync(seasons)) if (n.endsWith(".json")) ids.add(n.slice(0, -5));
  return ids;
}

function checkUrl(u: string, path: string, ctx: Ctx): void {
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    err(ctx, "E_SCHEMA", path, `${JSON.stringify(u)} is not an absolute URL.`);
    return;
  }
  if (parsed.protocol !== "https:") err(ctx, "E_SCHEMA", path, `${JSON.stringify(u)} must be https.`);
  if (parsed.username || parsed.password) err(ctx, "E_SCHEMA", path, `${JSON.stringify(u)} carries credentials; remove them.`);
  if (EMAIL.test(decodeURIComponent(u))) err(ctx, "E_SCHEMA", path, `${JSON.stringify(u)} contains an email address.`);
  for (const k of parsed.searchParams.keys()) {
    if (PERSONAL_PARAM.test(k)) err(ctx, "E_SCHEMA", path, `query parameter "${k}" could carry personal data. A weather link holds only a place or station key and coordinates.`);
  }
}

export function validateWeatherLinks(doc: unknown, ctx: Ctx, root: string): void {
  if (!isObj(doc)) {
    err(ctx, "E_SCHEMA", "", 'a weather-links file is one JSON object: {"schema": "weather-links/1", "publishers": {...}, "trips": [...]}.');
    ctx.schemaBroken = true;
    return;
  }
  const parsed = weatherLinksFile.safeParse(doc);
  if (!parsed.success) {
    for (const i of parsed.error.issues) err(ctx, "E_SCHEMA", "/" + i.path.map(String).join("/"), i.message);
    ctx.schemaBroken = true;
    return;
  }
  const file = parsed.data;
  // no email address anywhere in the file (notes, labels, titles included)
  const m = JSON.stringify(doc).match(EMAIL);
  if (m) err(ctx, "E_SCHEMA", "", `the file contains an email address (${m[0]}); remove it.`);

  const ids = knownTripIds(root);
  const seen = new Set<string>();
  const usedPublishers = new Set<string>();
  file.trips.forEach((t, ti) => {
    const tp = `/trips/${ti}`;
    if (!ids.has(t.trip)) err(ctx, "E_FK", `${tp}/trip`, `"${t.trip}" is not a known trip id (no folder under data/capture, data/suitability, data/relevance or data/trips, and no data/seasons file). Check the spelling.`);
    if (seen.has(t.trip)) err(ctx, "E_PK_DUP", `${tp}/trip`, `trip "${t.trip}" appears twice; keep one entry.`);
    seen.add(t.trip);
    t.links.forEach((l, li) => {
      const lp = `${tp}/links/${li}`;
      usedPublishers.add(l.publisher);
      if (!(l.publisher in file.publishers)) err(ctx, "E_FK", `${lp}/publisher`, `publisher "${l.publisher}" is not a key of "publishers" (${Object.keys(file.publishers).join(", ")}).`);
      checkUrl(l.url, `${lp}/url`, ctx);
      if (l.check.reachable && l.check.http !== null && l.check.http >= 400) err(ctx, "E_SCHEMA", `${lp}/check/reachable`, `reachable is true but the read got HTTP ${l.check.http}; set reachable to false.`);
      if (!l.check.reachable && l.check.http !== null && l.check.http < 400 && l.check.content !== "blocked") err(ctx, "E_SCHEMA", `${lp}/check/reachable`, `reachable is false but the read got HTTP ${l.check.http}; say why in content (blocked) or set it to true.`);
    });
    checkUrl(t.fallback.url, `${tp}/fallback/url`, ctx);
    const drawable = t.links.some((l) => l.kind === "forecast" && l.check.reachable);
    if (!drawable && !t.fallback.check.reachable) {
      ctx.warnings.push({ code: "W_WX_NO_DRAWABLE", path: tp, message: `trip "${t.trip}" has no reachable forecast row and its fallback is unreachable too, so the page draws no weather link until a person opens the page in a browser and confirms it.` });
    }
  });
  for (const [k, p] of Object.entries(file.publishers)) {
    if (!usedPublishers.has(k)) ctx.warnings.push({ code: "W_WX_PUBLISHER_UNUSED", path: `/publishers/${k}`, message: `publisher "${k}" is not used by any link.` });
    if (p.home !== null) checkUrl(p.home, `/publishers/${k}/home`, ctx);
    else if (usedPublishers.has(k)) err(ctx, "E_SCHEMA", `/publishers/${k}/home`, `publisher "${k}" is used by a link, so it needs a home url.`);
  }
}
