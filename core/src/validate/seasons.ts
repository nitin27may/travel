// data/seasons/<trip>.json (trip-season-basic/1): the schema in core/src/schema/seasons.ts, plus the file name must equal `trip`.
import { tripSeasonFile } from "../schema/seasons.ts";
import { err, isObj } from "./rows.ts";
import type { Ctx } from "./rows.ts";

export function validateSeasons(doc: unknown, ctx: Ctx, folder: string | null): void {
  if (!isObj(doc)) {
    err(ctx, "E_SCHEMA", "", 'a season file is one JSON object: {"schema": "trip-season-basic/1", "trip": "<slug>", "season": {...}, "windows": []}.');
    ctx.schemaBroken = true;
    return;
  }
  const parsed = tripSeasonFile.safeParse(doc);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) err(ctx, "E_SCHEMA", "/" + issue.path.join("/"), issue.message);
    ctx.schemaBroken = true;
    return;
  }
  if (folder && parsed.data.trip !== folder) err(ctx, "E_SCHEMA", "/trip", `"trip" is "${parsed.data.trip}" but the file is data/seasons/${folder}.json: the two must match.`);
}
