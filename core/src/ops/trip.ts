// Trip-level operations (plan 5.3): trip.create, trip.update, trip.restore here; the rest in the files beside it.
import { emptyTrip, patchRow, rows } from "./helpers.ts";
import { OpError, tripPath } from "./types.ts";
import type { WriteOp } from "./types.ts";

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
