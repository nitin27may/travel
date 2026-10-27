// E_CAP_LANE: the rules of the trip-less lane (core/src/capture/lane.ts), checked on its capture, suitability and relevance files.
// Everything else about a lane file (schema, refs, relations, the placement block, the tiers, the gap budget) is the trip rules: the
// lane is accepted like a trip because the validators discover lanes by folder and never require data/trips/<id>/.
//
//   1. A file in data/<kind>/<lane>/ says `"trip": "<lane>"`, and a file that says so sits there (a trip's folder cannot hold it).
//   2. Every record hangs off a stored place: its ref, unwrapped from part/ and offer/, is `place/<slug>` pinned in
//      data/catalogue/slugs.json (REF1). A merged or withdrawn key is refused: write the survivor's ref. The one exception is a
//      system pass, `offer/operator/<slug>#<product>` (protected-area-entry QP1): it hangs off an operator of operators.json.
//   3. No private origin key (`loc:<locations id>`, `proto:<id>`) anywhere in the file (store.ts A24, PRIV1).
import { join, relative, resolve, sep } from "node:path";
import { isTriplessLane, rootRef, TRIPLESS_KINDS, TRIPLESS_LANE, triplessDir } from "../capture/lane.ts";
import type { TriplessKind } from "../capture/lane.ts";
import { OPERATORS_PATH, readJson } from "../capture/records.ts";
import { SYSTEM_PASS_REF_RE } from "../schema/capture/relations.ts";
import { ORIGIN_KEY_RE, PLACE_REF_RE, SLUG_REGISTRY_PATH } from "../catalogue/slugs.ts";
import { ORIGIN_REF } from "../privacy/detect.ts";
import type { SlugRegistry } from "../catalogue/slugs.ts";
import { err, isObj } from "./rows.ts";
import type { Ctx } from "./rows.ts";

export const LANE_CODE = "E_CAP_LANE";

/** The family folder a store file sits in, data/<kind>/<folder>/<file>.json, or null for a draft outside the store. */
function folderOf(root: string, file: string | undefined, kind: TriplessKind): string | null {
  if (!file) return null;
  const r = relative(resolve(root), resolve(file)).split(sep).join("/");
  const m = new RegExp(`^data/${kind}/([^/]+)/[^/]+\\.json$`).exec(r);
  return m ? m[1]! : null;
}

function originKeyPaths(x: unknown, at: string, out: string[]): void {
  if (typeof x === "string") {
    if (ORIGIN_REF.test(x)) out.push(at);
  } else if (Array.isArray(x)) x.forEach((y, i) => originKeyPaths(y, `${at}/${i}`, out));
  else if (isObj(x)) {
    for (const [k, y] of Object.entries(x)) {
      if (ORIGIN_KEY_RE.test(k)) out.push(at || "/");
      originKeyPaths(y, `${at}/${k}`, out);
    }
  }
}

/** The lane rules for one parsed capture, suitability or relevance document. A no-op for a trip's file outside the lane folder. */
export function validateLane(doc: unknown, kind: TriplessKind, ctx: Ctx): void {
  if (!isObj(doc) || !(TRIPLESS_KINDS as readonly string[]).includes(kind)) return;
  const root = ctx.refs.root;
  const folder = folderOf(root, ctx.file, kind);
  const inLane = folder === TRIPLESS_LANE;
  const says = isTriplessLane(doc.trip);
  if (inLane && !says) {
    err(ctx, LANE_CODE, "/trip", `a file in ${triplessDir(kind)}/ belongs to the trip-less lane: its trip must be "${TRIPLESS_LANE}", not ${JSON.stringify(doc.trip)}. A trip's records go in data/${kind}/<trip id>/.`);
  }
  if (says && folder !== null && !inLane) {
    err(ctx, LANE_CODE, "/trip", `trip "${TRIPLESS_LANE}" is the trip-less lane, but this file sits in data/${kind}/${folder}/. Move it to ${triplessDir(kind)}/, or give it the trip id of its folder.`);
  }
  if (!says && !inLane) return;

  const reg = readJson<SlugRegistry>(join(root, SLUG_REGISTRY_PATH));
  const records = Array.isArray(doc.records) ? doc.records : [];
  let operators: Set<string> | null = null;
  records.forEach((r, i) => {
    if (!isObj(r) || typeof r.ref !== "string") return;
    if (kind === "capture" && SYSTEM_PASS_REF_RE.test(r.ref)) {
      operators ??= new Set((readJson<{ operators?: { ref?: unknown }[] }>(join(root, OPERATORS_PATH))?.operators ?? []).map((o) => String(o.ref)));
      const op = rootRef(r.ref);
      if (!operators.has(op)) err(ctx, LANE_CODE, `/records/${i}/ref`, `ref "${r.ref}" is a system pass of "${op}", which is not in ${OPERATORS_PATH}. Add the operator there first.`);
      return;
    }
    const place = rootRef(r.ref);
    if (!PLACE_REF_RE.test(place)) {
      err(ctx, LANE_CODE, `/records/${i}/ref`, `ref "${r.ref}" is not about a stored place. A record of the trip-less lane is place/<slug>, or a part/ or offer/ of one, with the slug pinned in ${SLUG_REGISTRY_PATH}; a trip's item goes in that trip's lane files.`);
      return;
    }
    if (!reg) {
      err(ctx, LANE_CODE, `/records/${i}/ref`, `${SLUG_REGISTRY_PATH} is missing, so the place ref "${place}" cannot be checked. Restore it (node core/bin/slugs.ts build).`);
      return;
    }
    const survivor = reg.places?.merged?.[place];
    if (survivor) err(ctx, LANE_CODE, `/records/${i}/ref`, `"${place}" was merged into "${survivor}". Write the record under the surviving ref.`);
    else if (place in (reg.places?.withdrawn ?? {})) err(ctx, LANE_CODE, `/records/${i}/ref`, `"${place}" is withdrawn in ${SLUG_REGISTRY_PATH}; its page is gone, so the lane holds no record for it.`);
    else if (!(place in (reg.places?.slugs ?? {}))) err(ctx, LANE_CODE, `/records/${i}/ref`, `"${place}" is not a pinned place ref in ${SLUG_REGISTRY_PATH}. Use the ref of the stored place's page (never a new loc: key); a place added to the store gets its ref from node core/bin/slugs.ts build.`);
  });
  const hits: string[] = [];
  originKeyPaths(doc, "", hits);
  for (const at of hits) err(ctx, LANE_CODE, at, `a private origin key (loc: or proto:) is in a file of the trip-less lane. It names the owner's list (PRIV1, store.ts A24): refer to the place by its place/<slug> ref.`);
}
