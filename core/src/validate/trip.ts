import { RESERVED_SLUGS } from "../schema/enums.ts";
import { SLUG_RE } from "../schema/meta.ts";
import { TRIP_TABLES } from "../schema/trip.ts";
import { TRIP_SCHEMA_VERSION } from "../schema/trip.ts";
import { DATED_FOLDER_RE } from "../catalogue/alias.ts";
import { checkForeignKeys, checkSources } from "./fk.ts";
import { checkTable, err, isObj } from "./rows.ts";
import type { Ctx, Row } from "./rows.ts";
import type { Table } from "../schema/meta.ts";

const ROOT_KEYS = ["schema_version", "id", "updated", ...TRIP_TABLES.map((t) => t.name)];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const dayNumber = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / 86400000;
};

export function shapeForNights(n: number): string {
  if (n <= 0) return "day-trip";
  if (n <= 2) return "weekend";
  if (n <= 5) return "short-break";
  if (n <= 9) return "week";
  return "multi-week";
}

const num = (v: unknown): number => (typeof v === "number" ? v : NaN);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function validateTrip(doc: unknown, ctx: Ctx, folder: string | null): void {
  if (!isObj(doc)) {
    err(ctx, "E_SCHEMA", "", "the file must be one JSON object with schema_version, id, updated and the trip tables. Example: {\"schema_version\": 1, \"id\": \"niagara-day-2026\", ...}.");
    ctx.schemaBroken = true;
    return;
  }
  // root scalars
  if (doc.schema_version !== TRIP_SCHEMA_VERSION) {
    const newer = typeof doc.schema_version === "number" && doc.schema_version > TRIP_SCHEMA_VERSION;
    err(ctx, "E_SCHEMA", "/schema_version", newer
      ? `this file is schema version ${doc.schema_version} but this code reads version ${TRIP_SCHEMA_VERSION}; update the repository code before editing the file.`
      : `"schema_version" must be ${TRIP_SCHEMA_VERSION}, got ${JSON.stringify(doc.schema_version)}; older files are migrated with node core/bin/migrate.ts, never silently.`);
    ctx.schemaBroken = true;
  }
  if (typeof doc.id !== "string" || !SLUG_RE.test(doc.id)) {
    err(ctx, "E_SLUG", "/id", `"id" must be the trip slug in lower-case words joined by hyphens, got ${JSON.stringify(doc.id)}. Example: "niagara-day-2026".`);
  }
  if (typeof doc.updated !== "string" || !ISO_DATE.test(doc.updated)) {
    err(ctx, "E_SCHEMA", "/updated", `"updated" must be an ISO date, got ${JSON.stringify(doc.updated)}. Example: "2026-10-17".`);
    ctx.schemaBroken = true;
  }
  for (const k of Object.keys(doc)) {
    if (!ROOT_KEYS.includes(k)) {
      err(ctx, "E_SCHEMA", `/${k}`, `unknown top-level key "${k}". The trip tables are: ${TRIP_TABLES.map((t) => t.name).join(", ")}.`);
      ctx.schemaBroken = true;
    }
  }
  for (const t of TRIP_TABLES) {
    if (!(t.name in doc)) {
      err(ctx, "E_SCHEMA", `/${t.name}`, t.meta.single
        ? `"${t.name}" is missing; it is one object with the columns of ${t.name}.`
        : `"${t.name}" is missing; add it as [] when there are no rows.`);
      ctx.schemaBroken = true;
    }
  }
  // key order (writer bug; the writer always emits the plan 2.2 order)
  const present = Object.keys(doc).filter((k) => ROOT_KEYS.includes(k));
  const want = ROOT_KEYS.filter((k) => present.includes(k));
  if (present.join("|") !== want.join("|")) {
    const firstBad = present.findIndex((k, i) => k !== want[i]);
    err(ctx, "E_KEY_ORDER", `/${present[firstBad]}`, `top-level keys are out of order: "${present[firstBad]}" should come after "${want[Math.max(0, firstBad - 1)]}". The order is: ${ROOT_KEYS.slice(0, 6).join(", ")}, ...`);
  }

  const seen: { table: Table; rows: Row[]; path: string }[] = [];
  const local = new Map<string, Row[]>();
  for (const t of TRIP_TABLES) {
    if (!(t.name in doc)) continue;
    const rows = checkTable(t, doc[t.name], `/${t.name}`, ctx);
    seen.push({ table: t, rows, path: `/${t.name}` });
    local.set(t.meta.sql.name ?? t.name, rows);
  }
  if (ctx.schemaBroken) return;

  const rowsOf = (name: string): Row[] => seen.find((s) => s.table.name === name)!.rows;
  const trip = rowsOf("trip")[0]!;

  checkForeignKeys(seen, local, ctx);
  const sourceIds = new Set(rowsOf("sources").map((r) => String(r.id)));
  checkSources(seen.filter((s) => s.table.name !== "sources"), sourceIds, (t) => ("src" in t.shape ? [{ col: "src", list: true }] : []), "the sources table of this trip", ctx);

  // E_SLUG
  const slug = String(trip.slug);
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
    err(ctx, "E_SLUG", "/trip/slug", `"${slug}" is a reserved name because it is also a page of the app. Pick another slug. Example: "${slug}-trip".`);
  }
  // a trip id is a public id: a month next to a year is private (public-ref-aliases 2, owner 27 Oct 2026); a year or a season is fine
  if (DATED_FOLDER_RE.test(slug)) {
    err(ctx, "E_SLUG", "/trip/slug", `"${slug}" names a month and a year; a trip id is public, so it may carry the year or a season only. Example: "niagara-day-2026" or "vermont-fall-2026".`);
  }
  if (slug !== doc.id) {
    err(ctx, "E_SLUG", "/id", `the root "id" (${JSON.stringify(doc.id)}) must equal trip.slug (${JSON.stringify(slug)}).`);
  }
  if (folder !== null && folder !== slug) {
    err(ctx, "E_SLUG", "/trip/slug", `the slug "${slug}" differs from the folder name "${folder}"; rename the folder or the slug so data/trips/<slug>/trip.json matches.`);
  }

  // E_VISIBILITY
  if (trip.web_published === true && trip.visibility === "private") {
    err(ctx, "E_VISIBILITY", "/trip/web_published", 'web_published is true on a private trip. Set "visibility" to "public" or "unlisted", or set "web_published" to false.');
  }

  // E_NIGHTS_SUM, E_DURATION_SHAPE
  const bases = rowsOf("bases");
  const sumNights = bases.reduce((a, b) => a + num(b.nights), 0);
  if (num(trip.nights) !== sumNights) {
    err(ctx, "E_NIGHTS_SUM", "/trip/nights", `trip.nights is ${trip.nights} but the bases add up to ${sumNights} night(s). Make them equal. Example: nights ${sumNights}.`);
  }
  const wantShape = shapeForNights(num(trip.nights));
  if (trip.duration_shape !== wantShape) {
    err(ctx, "E_DURATION_SHAPE", "/trip/duration_shape", `duration_shape is "${trip.duration_shape}" but ${trip.nights} night(s) is a "${wantShape}" (day-trip 0, weekend 1-2, short-break 3-5, week 6-9, multi-week 10+).`);
  }

  // E_DAYS_CONTIGUOUS
  const days = rowsOf("days");
  const ns = days.map((d) => num(d.n)).sort((a, b) => a - b);
  const first = ns[0] ?? 1;
  const okDays = ns.length > 0 && (first === 0 || first === 1) && ns.every((n, i) => n === first + i) && ns.some((n) => n >= 1);
  if (!okDays) {
    err(ctx, "E_DAYS_CONTIGUOUS", "/days", `days.n must run 1..N, or 0..N when day 0 is the travel day before Day 1, with no gaps; found ${JSON.stringify(ns)}. Example: [1, 2, 3].`);
  }
  const lastDay = ns.length ? ns[ns.length - 1]! : 0;

  // E_BASE_COVER
  if (num(trip.nights) === 0 || trip.duration_shape === "day-trip") {
    if (bases.length > 0) {
      err(ctx, "E_BASE_COVER", "/bases", "a day trip has no bases and no nights; remove the bases or change duration_shape.");
    }
  } else {
    const sorted = [...bases].sort((a, b) => num(a.night_from) - num(b.night_from));
    let next = sorted.length ? num(sorted[0]!.night_from) : 1;
    let bad: string | null = null;
    if (sorted.length === 0) bad = "no bases cover the nights";
    else if (next !== 0 && next !== 1) bad = `the first night is night ${next}; it should be 1 (or 0 when day 0 is a night at a base)`;
    for (const b of sorted) {
      if (bad) break;
      if (num(b.night_from) < next) bad = `base "${b.id}" starts at night ${b.night_from} but night ${num(b.night_from)} is already covered by the base before it`;
      else if (num(b.night_from) > next) bad = `night ${next} is covered by no base (the next base, "${b.id}", starts at night ${b.night_from})`;
      next = num(b.night_from) + num(b.nights);
    }
    if (!bad && next !== lastDay) bad = `the bases end after night ${next - 1}, but the last day is ${lastDay}, so the last night is ${lastDay - 1}`;
    if (bad) err(ctx, "E_BASE_COVER", "/bases", `every night must be covered by exactly one base: ${bad}.`);
  }

  // E_EDITION_LENGTH, E_EDITION_CHOSEN
  const editions = rowsOf("editions");
  const dayCount = days.filter((d) => num(d.n) >= 1).length;
  editions.forEach((e, i) => {
    const len = dayNumber(String(e.end)) - dayNumber(String(e.start)) + 1;
    if (len !== dayCount) {
      err(ctx, "E_EDITION_LENGTH", `/editions/${i}`, `edition "${e.id}" runs ${e.start} to ${e.end} (${len} days) but the trip has ${dayCount} days (n >= 1). Change "end" so end - start + 1 equals ${dayCount}.`);
    }
  });
  const chosen = editions.filter((e) => e.status === "chosen" || e.status === "booked");
  if (chosen.length > 1) {
    err(ctx, "E_EDITION_CHOSEN", "/editions", `${chosen.length} editions are chosen or booked (${chosen.map((e) => e.id).join(", ")}); at most one may be. Set the others to "candidate" or "cancelled".`);
  }

  // E_STYLE_TAG
  if (!rowsOf("trip_tags").some((r) => r.tag_id === trip.primary_style)) {
    err(ctx, "E_STYLE_TAG", "/trip/primary_style", `primary_style "${trip.primary_style}" must also be in trip_tags. Add {"tag_id": "${trip.primary_style}"} to trip_tags.`);
  }

  // E_SEQ_CONTIGUOUS and item rules
  const items = rowsOf("items");
  const groups = new Map<string, number[]>();
  const itemById = new Map<string, Row>();
  items.forEach((it) => {
    itemById.set(String(it.id), it);
    const k = `${it.day}|${it.track ?? "-"}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(num(it.seq));
  });
  for (const [k, seqs] of groups) {
    seqs.sort((a, b) => a - b);
    if (!seqs.every((s, i) => s === i + 1)) {
      const [day, track] = k.split("|");
      err(ctx, "E_SEQ_CONTIGUOUS", "/items", `items on day ${day}, track ${track === "-" ? "(whole group)" : track} have seq ${JSON.stringify(seqs)}; seq must be 1..${seqs.length} with no gaps or repeats. Example: ${JSON.stringify(seqs.map((_, i) => i + 1))}.`);
    }
  }
  items.forEach((it, i) => {
    const p = `/items/${i}`;
    const refs = ["trail_id", "activity_id", "eatery_id", "custom_item_id"].filter((c) => it[c] !== null);
    if (it.type === "trail" && it.trail_id === null) {
      err(ctx, "E_ITEM_REF", `${p}/trail_id`, `item "${it.id}" has type "trail" but no trail_id. Set trail_id to a catalog trail id, for example "AR/santa-cruz/el-chalten/laguna-de-los-tres".`);
    }
    if ((it.type === "checkin" || it.type === "checkout") && it.base_id === null) {
      err(ctx, "E_ITEM_REF", `${p}/base_id`, `item "${it.id}" has type "${it.type}" but no base_id. Set base_id to a base of this trip, for example "el-chalten".`);
    }
    if (refs.length > 1) {
      err(ctx, "E_ITEM_REF", p, `item "${it.id}" references more than one of trail_id, activity_id, eatery_id and custom_item_id (${refs.join(", ")}); keep one.`);
    }
    const hasWindow = it.window_start !== null || it.window_end !== null;
    if (it.start !== null && hasWindow) {
      err(ctx, "E_ITEM_TIME", p, `item "${it.id}" has both a fixed start and a window; use either start ("07:15") or window_start and window_end ("11:15" and "12:00").`);
    } else if (it.window_start !== null && it.window_end !== null && String(it.window_end) < String(it.window_start)) {
      err(ctx, "E_ITEM_TIME", `${p}/window_end`, `item "${it.id}" window_end ${it.window_end} is before window_start ${it.window_start}. Example: window_start "11:15", window_end "12:00".`);
    }
    if (it.plan_b_item_id !== null) {
      const target = itemById.get(String(it.plan_b_item_id));
      if (target && (target.track !== "P" || target.day !== it.day)) {
        err(ctx, "E_PLAN_B", `${p}/plan_b_item_id`, `plan_b_item_id "${it.plan_b_item_id}" must be an item on track "P" on day ${it.day}; it is on track ${JSON.stringify(target.track)}, day ${target.day}.`);
      }
    }
    const cost = [it.cost_amount, it.cost_currency, it.cost_per];
    if (cost.some((v) => v !== null) && cost.some((v) => v === null)) {
      err(ctx, "E_COST_PAIR", p, `item "${it.id}" must set cost_amount, cost_currency and cost_per together or leave all three null. Example: 30, "USD", "person".`);
    }
  });

  // E_COST_PAIR elsewhere
  const pr = rowsOf("profile")[0]!;
  if ((pr.budget_target_amount === null) !== (pr.budget_target_currency === null)) {
    err(ctx, "E_COST_PAIR", "/profile", 'profile needs budget_target_amount and budget_target_currency together, or both null. Example: 12000, "CAD".');
  }
  rowsOf("trip_bookings").forEach((b, i) => {
    if ((b.price_paid_amount === null) !== (b.price_paid_currency === null)) {
      err(ctx, "E_COST_PAIR", `/trip_bookings/${i}`, `booking "${b.id}" needs price_paid_amount and price_paid_currency together, or both null. Example: 140, "USD".`);
    }
    if (b.offer_id === null && (b.item === null || b.category === null)) {
      err(ctx, "E_BOOKING_OFFER", `/trip_bookings/${i}`, `booking "${b.id}" has no offer_id, so it needs both "item" (a label like "Glaciares flexi pass") and "category" (like "permit").`);
    }
  });

  // E_RESEARCH_PATH
  rowsOf("research_refs").forEach((r, i) => {
    for (const col of ["path", "sidecar"] as const) {
      const v = str(r[col]);
      if (v !== null && !ctx.refs.exists(v)) {
        err(ctx, "E_RESEARCH_PATH", `/research_refs/${i}/${col}`, `${col} "${v}" does not exist under the repository. Example: "research/trips/patagonia-feb-mar-2027/trails.md".`);
      }
    }
  });
}
