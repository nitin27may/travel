// data/seasons/<trip>.json (trip-season-basic/1): the schema in core/src/schema/seasons.ts, plus the cross-field rules a zod object
// cannot hold:
//   - the file name must equal `trip`;
//   - `months_basis: "plan_months"` says the months are the plan's own window, so the months' basis must be `plan` (first shape) or
//     `our_inference` (Val shape), never an official or operator reading;
//   - a weather note with a null basis is a `searched_none` claim, and a `searched_none` claim has no basis.
// A field accepts either shape (a union); a union error is reported as the branch the field's keys pick (`v` present: the Val), so the
// message names the key that is wrong rather than "invalid input".
import type { z } from "zod";
import { tripSeasonFile } from "../schema/seasons.ts";
import { err, isObj } from "./rows.ts";
import type { Ctx } from "./rows.ts";

type Issue = z.core.$ZodIssue;

/** The value at `path` inside `doc`, or undefined. */
function at(doc: unknown, path: readonly PropertyKey[]): unknown {
  let x: unknown = doc;
  for (const k of path) {
    if (x === null || typeof x !== "object") return undefined;
    x = (x as Record<PropertyKey, unknown>)[k];
  }
  return x;
}

/** Flattens union issues to the issues of the branch the input's shape picks: index 0 the first shape, 1 the Val. */
function flatten(issue: Issue, doc: unknown, prefix: readonly PropertyKey[] = []): { path: PropertyKey[]; message: string }[] {
  const path = [...prefix, ...issue.path];
  if (issue.code === "invalid_union" && issue.errors.length === 2) {
    const input = at(doc, path);
    const branch = isObj(input) && "v" in input ? 1 : 0;
    return issue.errors[branch]!.flatMap((i) => flatten(i, doc, path));
  }
  return [{ path, message: issue.message }];
}

export function validateSeasons(doc: unknown, ctx: Ctx, folder: string | null): void {
  if (!isObj(doc)) {
    err(ctx, "E_SCHEMA", "", 'a season file is one JSON object: {"schema": "trip-season-basic/1", "trip": "<slug>", "season": {...}, "windows": []}.');
    ctx.schemaBroken = true;
    return;
  }
  const parsed = tripSeasonFile.safeParse(doc);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) for (const f of flatten(issue, doc)) err(ctx, "E_SCHEMA", "/" + f.path.map(String).join("/"), f.message);
    ctx.schemaBroken = true;
    return;
  }
  const file = parsed.data;
  if (folder && file.trip !== folder) err(ctx, "E_SCHEMA", "/trip", `"trip" is "${file.trip}" but the file is data/seasons/${folder}.json: the two must match.`);

  const months = file.season.months;
  if (file.months_basis === "plan_months") {
    const ok = "v" in months ? months.basis === "our_inference" : months.basis === "plan";
    if (!ok) err(ctx, "E_SCHEMA", "/season/months/basis", `"months_basis" is "plan_months" (the plan's own window) but the months' basis is "${months.basis}": a plan's window is "plan" (or "our_inference" in the Val shape).`);
  }
  file.season.weather.notes.forEach((n, i) => {
    const searched = n.state === "searched_none";
    if (n.basis === null && !searched) err(ctx, "E_SCHEMA", `/season/weather/notes/${i}/basis`, 'a note with no basis is a searched_none claim: set "state": "searched_none", or give it a basis.');
    if (searched && n.basis !== null) err(ctx, "E_SCHEMA", `/season/weather/notes/${i}/basis`, 'a searched_none note has no basis: set "basis": null.');
  });
}
