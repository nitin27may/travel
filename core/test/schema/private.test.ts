import { describe, expect, it } from "vitest";
import { REGISTRY } from "../../src/schema/index.ts";

// Plan 2.1 privacy: these columns never reach the static export. `notes` rows with
// visibility = private are filtered by the export row by row, not by a column flag.
const EXPECTED = [
  "trip.emergency.insurer_tel",
  "trip.fare_windows.party",
  "trip.trip_bookings.confirmation",
  "trip.trip_bookings.contact",
  "trip.trip_bookings.price_paid_amount",
  "trip.trip_bookings.price_paid_currency",
  "trip.travellers.age_as_of",
  "trip.travellers.age_years",
  "trip.travellers.citizenship",
  "trip.travellers.fitness",
  "trip.travellers.height_cm",
  "trip.travellers.notes",
  "trip.travellers.weight_kg",
];

describe("x-private columns", () => {
  it("equals the plan's list", () => {
    const actual = REGISTRY.flatMap((t) => t.meta.private.map((c) => `${t.key}.${c}`)).sort();
    expect(actual).toEqual([...EXPECTED].sort());
  });

  it("leaves id, label and role public on travellers", () => {
    const t = REGISTRY.find((x) => x.key === "trip.travellers")!;
    for (const c of ["id", "label", "role"]) expect(t.meta.private).not.toContain(c);
  });

  it("marks the column itself with x-private", () => {
    const t = REGISTRY.find((x) => x.key === "trip.trip_bookings")!;
    const m = t.shape["confirmation"].meta() as Record<string, unknown>;
    expect(m["x-private"]).toBe(true);
  });
});
