import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { checkDays, fsCatalog, stubBookBy, stubSun } from "../../src/checks/index.ts";
import type { DayCheckCtx } from "../../src/checks/index.ts";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = join(REPO, "core/test/fixtures");
const ROOT = join(FIX, "root");
const tmp: string[] = [];
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** a trip that raises nothing: W_PACE.json with the pace lifted back to 5 */
function clean(): any {
  const d = JSON.parse(readFileSync(join(FIX, "warn/W_PACE.json"), "utf8"));
  d.profile.pace = 5;
  return d;
}

function ctxFor(trip: any, over: Partial<DayCheckCtx> = {}): DayCheckCtx {
  const ed = trip.editions.find((e: any) => e.status === "chosen");
  return {
    resolveDate: (n) => new Date(Date.parse(ed.start) + (n - 1) * 86400000).toISOString().slice(0, 10),
    sun: stubSun,
    bookBy: stubBookBy,
    catalog: fsCatalog(ROOT),
    today: "2026-10-17",
    ...over,
  };
}
const codes = (trip: any, over: Partial<DayCheckCtx> = {}) => checkDays(trip, ctxFor(trip, over)).map((w) => w.code);

describe("checkDays", () => {
  it("is quiet on the clean base", () => {
    expect(codes(clean())).toEqual([]);
  });

  it("uses the injected sun, not a built-in one", () => {
    const d = clean();
    expect(codes(d, { sun: () => ({ sunrise: "05:00", sunset: "16:10" }) })).toEqual(["W_DAYLIGHT"]); // only the Track A trail ends later (16:15)
    expect(codes(d, { sun: () => null })).toEqual([]);
  });

  it("uses the injected book-by rule and today", () => {
    const d = clean();
    expect(codes(d, { bookBy: () => -200 })).toEqual(["W_DEADLINE"]);
    expect(codes(d, { today: "2027-01-01" })).toEqual(["W_DEADLINE"]);
    d.trip_bookings.find((b: any) => b.id === "bk-piratour").status = "booked";
    expect(codes(d, { today: "2027-01-01" })).toEqual([]);
  });

  it("skips date-based checks when the trip has no chosen edition", () => {
    const d = clean();
    d.items.find((i: any) => i.id === "d03-i01").start = "13:00";
    expect(codes(d, { resolveDate: () => null })).toEqual([]);
    expect(codes(d)).toEqual(["W_DAYLIGHT"]);
  });

  it("merges whole-group items into each track: the dinner counts for Track A and Track B", () => {
    const d = clean();
    d.profile.pace = 1; // 300 min
    const w = checkDays(d, ctxFor(d)).filter((x) => x.code === "W_PACE" && x.day === 8);
    expect(w.map((x) => x.track).sort()).toEqual(["A", "B"]);
    const a = w.find((x) => x.track === "A")!;
    expect(a.message).toContain("680 min");
    const b = w.find((x) => x.track === "B")!;
    expect(b.message).toContain("410 min"); // 30 + 270 + 12 + 90 + 8; the rest item is excluded
  });

  it("excludes optional items and rest from the pace and counts travel-day driving at 1.5x", () => {
    const d = clean();
    d.profile.pace = 1;
    const day = d.days.find((x: any) => x.n === 5);
    day.kind = "travel";
    d.items.push(
      { ...d.items.find((i: any) => i.id === "d03-i01"), id: "d05-i01", day: 5, seq: 1, start: "08:00", duration_min: 200, leg_mode: "drive", leg_minutes: 100, activity_id: null, booking_id: null, needs_daylight: false, lat: -49.3, lon: -72.9 },
    );
    const w = checkDays(d, ctxFor(d)).filter((x) => x.day === 5 && x.code === "W_PACE");
    expect(w).toHaveLength(1);
    expect(w[0]!.message).toContain("350 min"); // 200 + 100 * 1.5
    d.items.find((i: any) => i.id === "d05-i01").optional = true;
    expect(checkDays(d, ctxFor(d)).filter((x) => x.day === 5)).toEqual([]);
  });

  it("does not ask buffer or rest items for coordinates", () => {
    const d = clean();
    d.items.find((i: any) => i.id === "d08-i03b").lat = null;
    d.items.find((i: any) => i.id === "d08-i03b").lon = null;
    d.items.find((i: any) => i.id === "d08-i03b").eatery_id = null;
    expect(codes(d)).toEqual([]);
    d.items.find((i: any) => i.id === "d08-i03b").type = "sight";
    expect(codes(d)).toContain("W_NO_COORDS");
  });

  it("accepts zones with the same offsets (Toronto and New York) but not different ones", () => {
    const d = clean();
    const calafate = d.bases.find((b: any) => b.id === "el-calafate");
    d.items.push(
      { ...d.items.find((i: any) => i.id === "d10-i01"), id: "d09-i01", day: 9, seq: 1, type: "checkout", base_id: "el-chalten", start: "08:00", lat: -49.3315, lon: -72.8863 },
      { ...d.items.find((i: any) => i.id === "d10-i01"), id: "d09-i02", day: 9, seq: 2, type: "transfer", base_id: null, start: "12:00", lat: -50.34, lon: -72.26, leg_mode: "bus", leg_minutes: 180, leg_km: 215 },
    );
    expect(codes(d)).toEqual([]);
    calafate.tz = "America/Santiago";
    expect(codes(d)).toEqual(["W_TZ_MISSING"]);
    d.items.find((i: any) => i.id === "d09-i02").tz = "America/Santiago";
    expect(codes(d)).toEqual([]);
  });

  it("a hiking ceiling spares Track A and a house-grade cap applies to B and C only", () => {
    const d = clean();
    d.profile.hiking_ceiling_km = 5;
    expect(checkDays(d, ctxFor(d)).filter((w) => w.code === "W_CEILING").map((w) => w.track)).toEqual(["B"]);
    d.profile.hiking_ceiling_km = null;
    d.profile.max_house_grade = 3; // Track A's trail is grade 4 but Track A is exempt; Track B's is grade 3
    expect(checkDays(d, ctxFor(d)).filter((w) => w.code === "W_CEILING")).toEqual([]);
    d.profile.max_house_grade = 2;
    expect(checkDays(d, ctxFor(d)).filter((w) => w.code === "W_CEILING").map((w) => w.track)).toEqual(["B"]);
  });

  it("marks a warning accepted when its day lists the code, and still returns it", () => {
    const d = JSON.parse(readFileSync(join(FIX, "warn/example-patagonia-day8.json"), "utf8"));
    const w = checkDays(d, ctxFor(d));
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ code: "W_PACE", accepted: true, day: 8, track: "A" });
    d.days.find((x: any) => x.n === 8).accepted_warnings = [];
    expect(checkDays(d, ctxFor(d))[0]!.accepted).toBe(false);
  });

  it("reports W_FIT per traveller and limit", () => {
    const d = clean();
    d.travellers.find((t: any) => t.id === "t3").age_years = 4;
    const w = checkDays(d, ctxFor(d)).filter((x) => x.code === "W_FIT");
    expect(w).toHaveLength(1);
    expect(w[0]!.message).toContain("Child (13)");
    expect(w[0]!.message).toContain("age limit");
  });
});

describe("validate CLI and hook", () => {
  const cli = (file: string, env: Record<string, string> = {}) =>
    spawnSync("node", [join(REPO, "core/bin/validate.ts"), file, "--root", ROOT], { encoding: "utf8", env: { ...process.env, TRAVEL_TODAY: "2026-10-17", ...env } });

  it("prints warnings and still exits 0", () => {
    const r = cli(join(FIX, "warn/W_PACE.json"));
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^WARN W_PACE .*warn\/W_PACE\.json#\/days\/7: Track A on day 8 has 680 min/m);
    expect(r.stdout).toMatch(/OK: 1 file\(s\) validated/);
  });

  it("prints errors and skips the day checks when the file is broken", () => {
    const r = cli(join(FIX, "broken/E_FK.json"));
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/^ERROR E_FK /m);
    expect(r.stdout).not.toMatch(/^WARN /m);
  });

  it("data_changed.sh prints a warning count per code and exits 0", () => {
    const root = mkdtempSync(join(tmpdir(), "p2b-hook-"));
    tmp.push(root);
    mkdirSync(join(root, "tools/hooks"), { recursive: true });
    cpSync(join(REPO, "tools/hooks/data_changed.sh"), join(root, "tools/hooks/data_changed.sh"));
    chmodSync(join(root, "tools/hooks/data_changed.sh"), 0o755);
    symlinkSync(join(REPO, "core"), join(root, "core"));
    cpSync(join(FIX, "root/data"), join(root, "data"), { recursive: true });
    cpSync(join(FIX, "root/research"), join(root, "research"), { recursive: true });
    const trip = join(root, "data/trips/warn-fixture/trip.json");
    mkdirSync(dirname(trip), { recursive: true });
    writeFileSync(trip, readFileSync(join(FIX, "warn/W_FIT.json")));
    const r = spawnSync("bash", [join(root, "tools/hooks/data_changed.sh")], {
      input: JSON.stringify({ tool_input: { file_path: trip } }), encoding: "utf8", env: { ...process.env, TRAVEL_TODAY: "2026-10-17" },
    });
    expect([r.status, r.stdout.trim()]).toEqual([0, "day checks (warnings, never blocking): W_FIT 1 (1 total)"]);
  });
});
