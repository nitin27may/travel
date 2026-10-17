import { describe, expect, it } from "vitest";
import { TRIP_TABLES } from "../../src/schema/trip.ts";
import { columnsOf } from "./helpers.ts";

// A column change shows up as a diff of trip-columns.snap.json in the pull request.
// Update it on purpose with: pnpm --dir core test -- -u
describe("trip family columns", () => {
  it("matches the committed snapshot", async () => {
    const snap: Record<string, string[]> = {};
    for (const t of TRIP_TABLES) {
      snap[t.name] = columnsOf(t).map((c) => `${c.name}:${c.type}${c.nullable ? "?" : ""}`);
    }
    await expect(JSON.stringify(snap, null, 1) + "\n").toMatchFileSnapshot("./trip-columns.snap.json");
  });

  it("lists tables in the plan 2.2 root key order", () => {
    expect(TRIP_TABLES.map((t) => t.name)).toEqual([
      "trip", "profile", "travellers", "trip_tags", "editions", "bases", "days", "day_tracks", "items",
      "trip_trails", "trip_activities", "trip_bookings", "custom_items", "notes", "routes", "hazards",
      "weather_rules", "budget", "fx", "fare_windows", "fare_quotes", "documents", "emergency", "packing",
      "knowledge", "questions", "gotchas", "research_refs", "sources", "changelog",
    ]);
  });
});
