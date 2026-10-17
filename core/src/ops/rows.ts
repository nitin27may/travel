// Bookings, row upserts, questions, fares, notes, custom items, routes and research references (plan 5.3, 5.8).
import { bookByOf } from "../bookings/bookBy.ts";
import { pickEdition } from "../derive/edition.ts";
import { findRow, patchRow, pkOf, removeRows, rows, upsertRow } from "./helpers.ts";
import { OpError } from "./types.ts";
import type { Row, WriteOp } from "./types.ts";
import { sha256 } from "../store/index.ts";

/** add or replace a row, with a summary line */
const upsertOp = (table: string, label: string): WriteOp => ({
  apply(ws, i) {
    const doc = ws.trip(i.slug);
    const replaced = upsertRow(doc, table, i.row);
    const key = pkOf(table).map((c) => i.row[c]).join("/");
    return { changed: [key], summary: `${replaced ? "Updated" : "Added"} ${label} ${key}`, refs: [key] };
  },
});

/** add a row; an existing primary key is an error */
const addOp = (table: string, label: string): WriteOp => ({
  apply(ws, i) {
    const doc = ws.trip(i.slug);
    const key = pkOf(table).map((c) => i.row[c]).join("/");
    if (rows(doc, table).some((r) => pkOf(table).every((c) => r[c] === i.row[c]))) {
      throw new OpError("E_PK_DUP", `${label} ${key} already exists in trip "${i.slug}". Pick another id, or use the update operation.`);
    }
    rows(doc, table).push(i.row);
    return { changed: [key], summary: `Added ${label} ${key}`, refs: [key] };
  },
});

const slugify = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const ROW_OPS: Record<string, WriteOp> = {
  "trip_activity.set": upsertOp("trip_activities", "activity verdict"),
  "hazard.upsert": upsertOp("hazards", "hazard"),
  "weather_rule.upsert": upsertOp("weather_rules", "weather rule"),
  "budget.upsert": upsertOp("budget", "budget row"),
  "document.upsert": upsertOp("documents", "document"),
  "emergency.upsert": upsertOp("emergency", "emergency contacts for"),
  "route.set": upsertOp("routes", "route"),
  "question.add": addOp("questions", "question"),
  "knowledge.add": addOp("knowledge", "knowledge claim"),
  "gotcha.add": addOp("gotchas", "gotcha"),
  "fare.add_window": addOp("fare_windows", "fare window"),
  "fare.add_quote": addOp("fare_quotes", "fare quote"),
  "custom_item.add": addOp("custom_items", "custom item"),
  "note.add": addOp("notes", "note"),

  "trip_booking.upsert": {
    apply(ws, i, ctx) {
      const doc = ws.trip(i.slug);
      const row: Row = { ...i.row };
      // the book-by is recomputed from the offer's window unless the owner set it
      if (row.book_by_basis !== "owner") {
        const ed = (row.edition_id && rows(doc, "editions").find((e) => e.id === row.edition_id)) || pickEdition(doc);
        const r = bookByOf(row, ctx.catalog, ed?.start ?? null);
        if (r.offset !== null) {
          row.book_by_offset = r.offset;
          row.book_by_basis = r.basis;
          row.deadline_date = r.deadline_date ?? null;
          if (row.deadline_date && !row.edition_id && ed) row.edition_id = ed.id;
        }
      }
      const replaced = upsertRow(doc, "trip_bookings", row);
      const how = row.book_by_basis === "owner" ? "owner's book-by kept" : row.book_by_offset === null ? "no book-by could be computed" : `book-by offset ${row.book_by_offset} (${row.book_by_basis})`;
      return { changed: [row.id], summary: `${replaced ? "Updated" : "Added"} booking ${row.id}; ${how}`, refs: [row.id] };
    },
  },

  "trip_booking.set_status": {
    apply(ws, i) {
      const b = findRow(ws.trip(i.slug), "trip_bookings", { id: i.id }, "booking");
      const was = b.status;
      b.status = i.status;
      return { changed: [i.id], summary: `Booking ${i.id}: ${was} to ${i.status}`, refs: [i.id] };
    },
  },

  "question.answer": {
    apply(ws, i) {
      const q = findRow(ws.trip(i.slug), "questions", { id: i.id }, "question");
      q.status = "answered";
      q.answer = i.answer;
      return { changed: [i.id], summary: `Answered question ${i.id}`, refs: [i.id] };
    },
  },

  "note.update": {
    apply(ws, i, ctx) {
      const n = findRow(ws.trip(i.slug), "notes", { id: i.id }, "note");
      patchRow(n, i.patch, ["id"], "note");
      n.updated = ctx.now;
      return { changed: [i.id], summary: `Updated note ${i.id}`, refs: [i.id] };
    },
  },

  "note.remove": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      findRow(doc, "notes", { id: i.id }, "note");
      removeRows(doc, "notes", (r) => r.id === i.id);
      return { changed: [i.id], summary: `Removed note ${i.id}`, refs: [i.id] };
    },
  },

  "custom_item.update": {
    apply(ws, i) {
      patchRow(findRow(ws.trip(i.slug), "custom_items", { id: i.id }, "custom item"), i.patch, ["id"], "custom item");
      return { changed: [i.id], summary: `Updated custom item ${i.id}: ${Object.keys(i.patch).join(", ")}`, refs: [i.id] };
    },
  },

  "research.add_ref": {
    refs: (i) => [i.path, i.path.replace(/\.[^./]+$/, ".json")],
    apply(ws, i, ctx) {
      const doc = ws.trip(i.slug);
      const bytes = ctx.refFiles.get(i.path);
      if (!bytes) throw new OpError("E_RESEARCH_PATH", `${i.path} does not exist under the repository. Example: "research/trips/${i.slug}/trails.md".`);
      const sidecarPath = i.path.replace(/\.[^./]+$/, ".json");
      const sidecar = sidecarPath !== i.path && ctx.refFiles.get(sidecarPath) ? sidecarPath : null;
      const existing = rows(doc, "research_refs").find((r) => r.path === i.path);
      const base = `rr-${slugify(i.lane)}-${slugify(i.path.split("/").pop()!.replace(/\.[^.]+$/, ""))}`;
      let id = existing?.id ?? base;
      if (!existing) for (let n = 2; rows(doc, "research_refs").some((r) => r.id === id); n++) id = `${base}-${n}`;
      const row: Row = { id, path: i.path, sidecar, lane: i.lane, title: i.title, added: existing?.added ?? ctx.today, sha256: sha256(bytes), synthesised: existing?.synthesised ?? null };
      upsertRow(doc, "research_refs", row);
      return { changed: [id], summary: `${existing ? "Re-indexed" : "Indexed"} ${i.path}${sidecar ? " with its sidecar" : ""}`, refs: [id] };
    },
  },
};
