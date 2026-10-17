// Editions, bases, days, items, tracks and trail links (plan 5.3, 5.8). Each operation is a function over the trip document
// in the workspace; the runner validates the result, so these only do the edit and the cascades that keep the invariants.
import { baseCovering, dayRow, growNight, mapDays, shrinkNight, syncEditionEnds } from "./days.ts";
import { findRow, patchRow, pkOf, removeRows, renumberItems, rows, upsertRow } from "./helpers.ts";
import { OpError } from "./types.ts";
import type { Row, WriteOp } from "./types.ts";

const dupCheck = (doc: Row, table: string, row: Row, what: string): void => {
  const pk = pkOf(table);
  if (rows(doc, table).some((r) => pk.every((c) => r[c] === row[c]))) {
    throw new OpError("E_PK_DUP", `${what} ${pk.map((c) => JSON.stringify(row[c])).join(", ")} already exists in trip "${doc.id}". Use the update operation, or pick another id.`);
  }
};

/** put an item at a position in its (day, track) group and close the gap it left; seq undefined = last */
function placeItem(doc: Row, item: Row, day: number, track: string | null, seq: number | undefined): void {
  const old = { day: item.day, track: item.track };
  const group = (d: number, t: string | null): Row[] => rows(doc, "items").filter((x) => x !== item && x.day === d && (x.track ?? null) === (t ?? null)).sort((a, b) => a.seq - b.seq);
  const target = group(day, track);
  const at = seq === undefined ? target.length : Math.max(0, Math.min(target.length, seq - 1));
  target.splice(at, 0, item);
  item.day = day;
  item.track = track;
  target.forEach((x, i) => (x.seq = i + 1));
  if (old.day !== day || (old.track ?? null) !== (track ?? null)) group(old.day, old.track).forEach((x, i) => (x.seq = i + 1));
}

export const PLAN_OPS: Record<string, WriteOp> = {
  "edition.add": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      dupCheck(doc, "editions", i.row, "edition");
      rows(doc, "editions").push(i.row);
      return { changed: [i.row.id], summary: `Added edition ${i.row.id} (${i.row.start} to ${i.row.end})`, refs: [i.row.id] };
    },
  },

  "edition.update": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      patchRow(findRow(doc, "editions", { id: i.id }, "edition"), i.patch, ["id"], "edition");
      return { changed: [i.id], summary: `Updated edition ${i.id}: ${Object.keys(i.patch).join(", ")}`, refs: [i.id] };
    },
  },

  "edition.choose": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      const target = findRow(doc, "editions", { id: i.id }, "edition");
      const booked = rows(doc, "editions").find((e) => e.status === "booked" && e.id !== i.id);
      if (booked) throw new OpError("E_EDITION_CHOSEN", `edition "${booked.id}" is booked, so "${i.id}" cannot be chosen. Cancel or reopen "${booked.id}" first with edition.update.`);
      if (target.status === "cancelled" || target.status === "travelled") throw new OpError("E_EDITION_STATUS", `edition "${i.id}" is ${target.status} and cannot be chosen.`);
      const demoted: string[] = [];
      for (const e of rows(doc, "editions")) {
        if (e.id !== i.id && e.status === "chosen") {
          e.status = "candidate";
          demoted.push(e.id);
        }
      }
      if (target.status === "candidate") target.status = "chosen";
      return { changed: [i.id, ...demoted], summary: `Chose edition ${i.id}${demoted.length ? ` (${demoted.join(", ")} back to candidate)` : ""}`, refs: [i.id, ...demoted] };
    },
  },

  "base.set": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      const bases: Row[] = i.bases;
      doc.bases = bases;
      // days whose base disappeared sleep at the base that covers their night
      const ids = new Set(bases.map((b) => b.id));
      const lastDay = Math.max(...rows(doc, "days").map((d) => d.n));
      for (const d of rows(doc, "days")) {
        if (d.base_id !== null && ids.has(d.base_id)) continue;
        d.base_id = d.n >= 1 && d.n < lastDay ? (baseCovering(doc, d.n)?.id ?? null) : null;
      }
      return { changed: bases.map((b) => b.id), summary: `Set ${bases.length} base(s): ${bases.map((b) => `${b.id} ${b.nights}n`).join(", ")}`, refs: bases.map((b) => b.id) };
    },
  },

  "day.add": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      const row: Row = { ...i.row };
      const days = rows(doc, "days");
      const max = Math.max(...days.map((d) => d.n));
      if (row.n > max + 1) throw new OpError("E_DAYS_CONTIGUOUS", `day ${row.n} would leave a gap: the trip has days up to ${max}. Add day ${max + 1}, or pick a number from 0 to ${max + 1}.`);
      const insert = days.some((d) => d.n === row.n);
      if (insert) mapDays(doc, (n) => (n >= row.n ? n + 1 : n));
      if (row.n >= 1) {
        const base = growNight(doc, Math.max(1, row.n - 1));
        if (row.base_id === null && (row.n < max + 1 || insert)) row.base_id = base.id;
        if (row.n === max + 1) {
          // the day that used to be last now sleeps at the base that gained the night
          const prev = days.find((d) => d.n === max);
          if (prev && prev.base_id === null) prev.base_id = base.id;
        }
      }
      days.push(row);
      syncEditionEnds(doc);
      return { changed: [`day:${row.n}`], summary: `Added day ${row.n}${insert ? " (later days moved down one)" : ""}`, refs: [`day:${row.n}`] };
    },
  },

  "day.update": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      patchRow(dayRow(doc, i.n), i.patch, ["n"], "day");
      return { changed: [`day:${i.n}`], summary: `Updated day ${i.n}: ${Object.keys(i.patch).join(", ")}`, refs: [`day:${i.n}`] };
    },
  },

  "day.swap": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      if (i.a === i.b) throw new OpError("E_NOOP", "day.swap needs two different days.");
      const da = dayRow(doc, i.a);
      const db = dayRow(doc, i.b);
      const baseA = da.base_id;
      const baseB = db.base_id;
      mapDays(doc, (n) => (n === i.a ? i.b : n === i.b ? i.a : n), { keepLodging: true });
      // the night stays where it was: the base belongs to the position, the plan to the day
      da.base_id = baseB;
      db.base_id = baseA;
      return { changed: [`day:${i.a}`, `day:${i.b}`], summary: `Swapped days ${i.a} and ${i.b} with their items`, refs: [`day:${i.a}`, `day:${i.b}`] };
    },
  },

  "day.remove": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      dayRow(doc, i.n);
      if (rows(doc, "days").filter((d) => d.n >= 1).length <= 1 && i.n >= 1) throw new OpError("E_DAYS_CONTIGUOUS", "a trip keeps at least one day.");
      const gone = removeRows(doc, "items", (r) => r.day === i.n).map((r) => r.id);
      const goneIds = new Set(gone);
      for (const it of rows(doc, "items")) if (it.plan_b_item_id && goneIds.has(it.plan_b_item_id)) it.plan_b_item_id = null;
      removeRows(doc, "day_tracks", (r) => r.day === i.n);
      removeRows(doc, "days", (r) => r.n === i.n);
      removeRows(doc, "weather_rules", (r) => r.day === i.n);
      removeRows(doc, "notes", (r) => r.scope === "day" && r.ref === String(i.n));
      const last = Math.max(...rows(doc, "days").map((d) => d.n), 0);
      mapDays(doc, (n) => (n === i.n ? null : n > i.n ? n - 1 : n));
      if (i.n >= 1) {
        shrinkNight(doc, Math.max(1, i.n - 1));
        // the final day never sleeps anywhere
        const lastRow = rows(doc, "days").find((d) => d.n === last - (last >= i.n ? 1 : 0));
        if (lastRow) lastRow.base_id = null;
      }
      syncEditionEnds(doc);
      return { changed: [`day:${i.n}`, ...gone], summary: `Removed day ${i.n} and its ${gone.length} item(s); later days moved up one`, refs: [`day:${i.n}`, ...gone] };
    },
  },

  "item.add": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      const row: Row = { ...i.row };
      dupCheck(doc, "items", row, "item");
      const wanted = row.seq;
      rows(doc, "items").push(row);
      placeItem(doc, row, row.day, row.track, wanted);
      return { changed: [row.id], summary: `Added item ${row.id} "${row.title}" on day ${row.day}${row.track ? ` track ${row.track}` : ""}`, refs: [row.id] };
    },
  },

  "item.update": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      const item = findRow(doc, "items", { id: i.id }, "item");
      const { seq, day, track, ...rest } = i.patch as Row;
      patchRow(item, rest, ["id"], "item");
      if (seq !== undefined || day !== undefined || track !== undefined) {
        placeItem(doc, item, day ?? item.day, track === undefined ? item.track : track, seq ?? (day !== undefined || track !== undefined ? undefined : item.seq));
      }
      return { changed: [i.id], summary: `Updated item ${i.id}: ${Object.keys(i.patch).join(", ")}`, refs: [i.id] };
    },
  },

  "item.move": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      const item = findRow(doc, "items", { id: i.id }, "item");
      if (i.seq === undefined && i.day === undefined && i.track === undefined) throw new OpError("E_NOOP", "item.move needs a seq, a day or a track.");
      const day = i.day ?? item.day;
      const track = i.track === undefined ? item.track : i.track;
      const moved = day !== item.day || (track ?? null) !== (item.track ?? null);
      placeItem(doc, item, day, track, i.seq ?? (moved ? undefined : item.seq));
      return { changed: [i.id], summary: `Moved item ${i.id} to day ${day}${track ? ` track ${track}` : ""} position ${item.seq}`, refs: [i.id] };
    },
  },

  "item.remove": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      const item = findRow(doc, "items", { id: i.id }, "item");
      removeRows(doc, "items", (r) => r === item);
      for (const it of rows(doc, "items")) if (it.plan_b_item_id === i.id) it.plan_b_item_id = null;
      renumberItems(doc);
      return { changed: [i.id], summary: `Removed item ${i.id} "${item.title}"`, refs: [i.id] };
    },
  },

  "item.pin": {
    apply(ws, i) {
      findRow(ws.trip(i.slug), "items", { id: i.id }, "item").pinned = true;
      return { changed: [i.id], summary: `Pinned item ${i.id}`, refs: [i.id] };
    },
  },

  "item.unpin": {
    apply(ws, i) {
      findRow(ws.trip(i.slug), "items", { id: i.id }, "item").pinned = false;
      return { changed: [i.id], summary: `Unpinned item ${i.id}`, refs: [i.id] };
    },
  },

  "track.set": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      const replaced = upsertRow(doc, "day_tracks", i.row);
      return { changed: [`day:${i.row.day}:${i.row.track}`], summary: `${replaced ? "Updated" : "Set"} track ${i.row.track} on day ${i.row.day}`, refs: [`day:${i.row.day}`] };
    },
  },

  "trail.link": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      const replaced = upsertRow(doc, "trip_trails", i.row);
      return { changed: [i.row.trail_id], summary: `${replaced ? "Updated" : "Linked"} trail ${i.row.trail_id} as ${i.row.role}`, refs: [i.row.trail_id] };
    },
  },
};
