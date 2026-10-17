// Trip-level operations (plan 5.3): trip.create, trip.update, trip.restore here; the rest in the files beside it.
import { clone, emptyTrip, patchRow, rows, upsertRow } from "./helpers.ts";
import { OpError, tripPath } from "./types.ts";
import type { Row, WriteOp } from "./types.ts";

export const TRIP_OPS: Record<string, WriteOp> = {
  "trip.create": {
    slug: (i) => i.trip.slug,
    apply(ws, i, ctx) {
      const slug = i.trip.slug as string;
      if (ws.has(tripPath(slug))) throw new OpError("E_EXISTS", `trip "${slug}" already exists. Pick another slug, or use trip.update.`);
      const doc = emptyTrip(slug, ctx.today);
      doc.trip = i.trip;
      doc.profile = i.profile;
      doc.travellers = i.travellers;
      doc.trip_tags = i.trip_tags;
      doc.editions = i.editions ?? [];
      // a valid trip has days and, when it spans nights, bases that cover them: seed N+1 days and, for N > 0, one provisional base
      // that base.set replaces
      const nights = i.trip.nights as number;
      if (nights > 0) {
        doc.bases = [{
          id: "base-1", name: i.trip.region_label || i.trip.title, place_id: null, stay_id: null, lodging: null, night_from: 1, nights,
          lat: null, lon: null, tz: i.trip.origin_tz, elevation_m: null, why: "", why_not: "",
        }];
      }
      doc.days = Array.from({ length: nights + 1 }, (_, k) => ({
        n: k + 1, title: "", kind: "mixed", base_id: nights > 0 && k < nights ? "base-1" : null, summary: "", prose: null, flexible_group: null,
        decision_rules: [], plan_b_title: "", plan_b_text: null, sun_note: null, day_of_links: [], accepted_warnings: [],
      }));
      ws.set(tripPath(slug), doc);
      return { changed: [slug], summary: `Created trip ${slug}`, refs: [slug] };
    },
  },

  "trip.update": {
    apply(ws, i) {
      const doc = ws.trip(i.slug);
      const changed: string[] = [];
      if (i.trip) {
        if ("slug" in i.trip && i.trip.slug !== doc.trip.slug) throw new OpError("E_SLUG", "the slug of a trip cannot change; copy the trip to a new slug with trip.copy.");
        patchRow(doc.trip, i.trip, [], "trip");
        changed.push(`trip:${i.slug}`);
      }
      if (i.profile) {
        patchRow(doc.profile, i.profile, [], "profile");
        changed.push("profile");
      }
      if (i.travellers) {
        doc.travellers = i.travellers;
        changed.push("travellers");
      }
      if (changed.length === 0) throw new OpError("E_NOOP", "trip.update needs at least one of trip, profile or travellers.");
      return { changed, summary: `Updated ${changed.map((c) => c.split(":")[0]).join(", ")}`, refs: [i.slug] };
    },
  },

  "trip.copy": {
    slug: (i) => i.new_slug,
    async paths(i) {
      return [tripPath(i.from_slug)];
    },
    apply(ws, i, ctx) {
      if (i.from_slug === i.new_slug) throw new OpError("E_EXISTS", "trip.copy needs a new slug that differs from the source.");
      if (ws.has(tripPath(i.new_slug))) throw new OpError("E_EXISTS", `trip "${i.new_slug}" already exists. Pick another slug.`);
      const src = ws.trip(i.from_slug);
      const doc = emptyTrip(i.new_slug, ctx.today);
      const keep = (t: string) => (doc[t] = clone(rows(src, t)));
      doc.trip = {
        ...clone(src.trip), slug: i.new_slug, title: `${src.trip.title} (copy)`, status: "idea", web_published: false, visibility: "private",
        shared_with: [], generated_by: null, legacy_url: null, created: ctx.today,
      };
      doc.profile = clone(src.profile);
      // references only: no ages, heights, weights or citizenship
      doc.travellers = rows(src, "travellers").map((t) => ({ ...clone(t), age_years: null, age_as_of: null, height_cm: null, weight_kg: null, fitness: null, citizenship: [], notes: "" }));
      for (const t of ["trip_tags", "bases", "days", "day_tracks", "trip_trails", "trip_activities", "custom_items", "routes", "hazards", "weather_rules", "documents", "emergency", "packing", "knowledge", "questions", "gotchas", "research_refs", "sources", "fx"]) keep(t);
      doc.editions = []; // no edition: dates belong to a trip that is actually going
      // bookings stay as references to offers, back to todo, with nothing private
      doc.trip_bookings = rows(src, "trip_bookings").map((b) => ({
        ...clone(b), status: "todo", edition_id: null, deadline_date: null, price_paid_amount: null, price_paid_currency: null, confirmation: null, contact: null,
      }));
      doc.budget = rows(src, "budget").map((b) => ({ ...clone(b), fare_window_id: null }));
      doc.items = (i.include as string[]).includes("items") ? clone(rows(src, "items")) : [];
      doc.notes = (i.include as string[]).includes("notes") ? clone(rows(src, "notes")).filter((n: Row) => n.visibility === "shared") : [];
      ws.set(tripPath(i.new_slug), doc);
      return { changed: [i.new_slug], summary: `Copied ${i.from_slug} to ${i.new_slug} (references only${(i.include as string[]).length ? `, with ${(i.include as string[]).join(" and ")}` : ""})`, refs: [i.new_slug, i.from_slug] };
    },
  },

  "trip.adopt_place": {
    places: (i) => [i.place_id],
    apply(ws, i, ctx) {
      const doc = ws.trip(i.slug);
      const place = ctx.places.get(i.place_id);
      if (!place) throw new OpError("E_NOT_FOUND", `no place "${i.place_id}" in the laundry list. Use search to find its id.`);
      ctx.placeEdits.push({ id: place.id, status: "planned", trip: i.slug, prev: { status: place.status, trip: place.trip } });
      // the trip's research queue is its open questions: one per stop candidate
      const qid = `q-stop-${place.id.split("/").pop()}`;
      const added = !rows(doc, "questions").some((q) => q.id === qid);
      if (added) {
        upsertRow(doc, "questions", { id: qid, text: `Stop candidate: ${place.name} (${place.id}). Research it and place it in the days.`, status: "open", answer: null, asked: ctx.today });
      }
      return { changed: [place.id, ...(added ? [qid] : [])], summary: `Adopted ${place.name} (status planned, trip ${i.slug})${added ? "; queued as a stop candidate" : ""}`, refs: [place.id] };
    },
  },

  "trip.restore": {
    noChangelog: true,
    places: (i) => (i.places ?? []).map((p: { id: string }) => p.id),
    async paths(i) {
      return i.files.map((f: { path: string }) => f.path);
    },
    apply(ws, i, ctx) {
      for (const f of i.files as { path: string; content: string | null }[]) {
        if (!f.path.startsWith(`data/trips/${i.slug}/`)) throw new OpError("E_PATH", `trip.restore only touches data/trips/${i.slug}/, got ${f.path}.`);
        ws.setText(f.path, f.content);
      }
      for (const p of (i.places ?? []) as { id: string; status: string; trip: string | null }[]) {
        const cur = ctx.places.get(p.id);
        ctx.placeEdits.push({ id: p.id, status: p.status, trip: p.trip, prev: { status: cur?.status ?? p.status, trip: cur?.trip ?? null } });
      }
      return { changed: i.files.map((f: { path: string }) => f.path), summary: "Restored earlier file contents", refs: [] };
    },
  },
};

export { rows };
