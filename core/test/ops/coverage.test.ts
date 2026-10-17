import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OPS_BY_NAME } from "../../src/ops/catalogue.ts";
import { WRITE_OPS } from "../../src/ops/registry.ts";
import { FIX } from "./util.ts";

// the operations P4a implements (brief steps 3-5); each must have a fixture test that checks the file, the changelog row,
// the warnings and the inverse (test/ops/util.ts check())
const IMPLEMENTED = [
  "trip.create", "trip.update", "trip.copy", "trip.adopt_place", "edition.add", "edition.update", "edition.choose", "base.set", "day.add", "day.update",
  "day.swap", "day.remove", "item.add", "item.update", "item.move", "item.remove", "item.pin", "item.unpin", "track.set", "trail.link", "trip_activity.set",
  "trip_booking.upsert", "trip_booking.set_status", "hazard.upsert", "weather_rule.upsert", "budget.upsert", "document.upsert", "emergency.upsert",
  "question.add", "question.answer", "knowledge.add", "gotcha.add", "fare.add_window", "fare.add_quote", "note.add", "note.update", "note.remove",
  "custom_item.add", "custom_item.update", "route.set", "research.add_ref", "proposal.apply", "proposal.reject",
];

describe("operation coverage", () => {
  it("implements every listed operation and each has an expected-result fixture", () => {
    for (const name of IMPLEMENTED) {
      expect(OPS_BY_NAME.has(name), `${name} is in the catalogue`).toBe(true);
      expect(WRITE_OPS[name], `${name} has an implementation`).toBeDefined();
      const stem = name.replace(/\./g, "_");
      const files = readdirSync(join(FIX, "trips", "expected")).filter((f) => f === `${stem}.json` || (f.startsWith(`${stem}.`) && f.endsWith(".json")));
      expect(files.length, `${name} has an expected fixture`).toBeGreaterThan(0);
    }
  });

  it("trip.restore (the inverse) is implemented and covered through every check()", () => {
    expect(WRITE_OPS["trip.restore"]).toBeDefined();
  });

  it("the write operations still without an implementation are the ones later phases own", () => {
    const missing = [...OPS_BY_NAME.values()].filter((o) => o.kind === "write" && !WRITE_OPS[o.name]).map((o) => o.name).sort();
    expect(missing).toEqual([
      "backlog.add", "catalog.add", "catalog.apply", "catalog.edit", "catalog.merge", "catalog.propose", "catalog.reject", "catalog.retire", "catalog.undo", "catalog.verify",
      "custom_item.propose", "day.optimise", "inbox.add", "inbox.dismiss", "inbox.resolve", "ops.apply", "place.add", "place.edit", "place.visit_add",
      "research.propose", "route.compute", "route.insert_break", "tag.add", "tag.alias", "trail.upsert", "trip.import",
    ]);
  });
});
