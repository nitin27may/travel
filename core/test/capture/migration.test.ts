// Backlog 3a.12 step 4: counts and invariants of the capture migration. Two parts: the committed data (what the migration left),
// and the migration program run on a small fixture root (what it does, rule by rule).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEDGER_PATH, displacedRelevance, laneLeaves, ledgerOf, leavesOf, lostLeaves, planMigration, removedSuitability, serializeLike } from "../../src/capture/migrate.ts";
import type { Ledger, SplitsFile } from "../../src/capture/migrate.ts";
import { loadWorld, sidecarFiles } from "../../src/capture/records.ts";
import { resolveNode } from "../../src/capture/resolve.ts";
import { DEFAULT_TYPES, treeOf } from "../../src/capture/tree.ts";
import type { CaptureDoc } from "../../src/schema/capture/records.ts";
import { validateFile } from "../../src/validate/index.ts";
import { REPO, put, scope, scratchRoot } from "./helpers.ts";

const read = <T>(rel: string): T => JSON.parse(readFileSync(join(REPO, rel), "utf8")) as T;
const world = loadWorld(REPO);
const splits = (): SplitsFile[] => ["algonquin-muskoka-2026", "canadian-rockies-2029", "chamonix-mont-blanc-2028", "dolomites-2027", "iceland-ring-road-2027", "patagonia-2027", "utah-five-parks", "vermont-fall-2026"].flatMap((t) => {
  try {
    return [read<SplitsFile>(`data/capture/splits/${t}.json`)];
  } catch {
    return [];
  }
});

describe("the committed migration (counts)", () => {
  // the counts describe what the migration left: migrated.json only. Research lanes (CS7.json and later) add records beside them.
  const docs = sidecarFiles(REPO, "capture").filter((f) => f.endsWith("/migrated.json")).map((f) => JSON.parse(readFileSync(f, "utf8")) as CaptureDoc);
  const records = docs.flatMap((d) => d.records);

  it("one capture sidecar per trip, 8 trips, 339 records: 287 refs retyped (2 stubs are aliases of their real records) and 52 cut out", () => {
    expect(docs.map((d) => d.trip).sort()).toEqual(["algonquin-muskoka-2026", "canadian-rockies-2029", "chamonix-mont-blanc-2028", "dolomites-2027", "iceland-ring-road-2027", "patagonia-2027", "utah-five-parks", "vermont-fall-2026"]);
    expect(records).toHaveLength(339);
    expect(records.filter((r) => !r.origin)).toHaveLength(287);
    expect(records.filter((r) => r.origin)).toHaveLength(52);
    expect(world.alias.size).toBe(2);
    expect(new Set(records.map((r) => r.ref)).size).toBe(339);
  });
  it("by layer: 160 places, 137 routes, 41 offers, 1 event", () => {
    const by = (l: string) => records.filter((r) => r.layer === l).length;
    expect([by("place"), by("route"), by("offer"), by("event")]).toEqual([160, 137, 41, 1]);
  });
  it("the 52 records cut out: 40 places, 8 offers (6 tickets, 2 operator offers), 3 routes, 1 event", () => {
    const cut = records.filter((r) => r.origin);
    const by = (l: string) => cut.filter((r) => r.layer === l).length;
    expect([by("place"), by("offer"), by("route"), by("event")]).toEqual([40, 8, 3, 1]);
    for (const r of cut) expect(r.origin!.reason.length, r.ref).toBeGreaterThan(8);
  });
  it("61 records split: 33 trail payoffs, 15 activities as offers, 6 lifts, 3 places with a long walk, 3 routes, 1 viewing place and event", () => {
    const all = splits().flatMap((f) => f.splits);
    const by = (h: string) => all.filter((s) => s.how === h).length;
    expect(all).toHaveLength(61);
    expect([by("trail_payoff"), by("offer"), by("lift"), by("place_walk"), by("route"), by("viewing_event")]).toEqual([33, 15, 6, 3, 3, 1]);
    expect(new Set(all.map((s) => s.ref)).size).toBe(61);
  });
  it("every type exists, allows its layer, and has the suitability profile the record had", () => {
    const tree = treeOf(DEFAULT_TYPES);
    for (const r of records) {
      const n = resolveNode(r.type, DEFAULT_TYPES);
      expect(n, r.ref).not.toBeNull();
      expect(n!.records, r.ref).toContain(r.layer);
      const s = world.suit.get(r.ref)?.rec;
      if (s?.subkind) {
        const legacy = tree.legacy.get(`${s.kind}/${s.subkind}`);
        if (legacy) expect(resolveNode(legacy, DEFAULT_TYPES)!.profile, r.ref).toBe(n!.profile);
      }
    }
  });
  it("the reviewed type map is the record of every type that is not the legacy default (the 61 splits aside)", () => {
    const tree = treeOf(DEFAULT_TYPES);
    const overrides = new Map(read<{ overrides: { ref: string; type?: string }[] }>("data/capture/type-map.json").overrides.map((o) => [o.ref, o]));
    const split = new Set(splits().flatMap((f) => f.splits.map((s) => s.ref)));
    let overridden = 0;
    for (const r of records.filter((x) => !x.origin && !split.has(x.ref))) {
      const s = world.suit.get(r.ref)!.rec;
      const want = overrides.get(r.ref)?.type ?? tree.legacy.get(`${s.kind}/${s.subkind}`);
      expect(r.type, r.ref).toBe(want);
      if (overrides.get(r.ref)?.type) overridden++;
    }
    expect(overridden).toBe(6);
  });
  it("every capture file validates with zero errors", () => {
    for (const f of sidecarFiles(REPO, "capture")) {
      const res = validateFile(f, REPO);
      expect(res.errors, f).toEqual([]);
    }
    expect(validateFile(join(REPO, "data/capture/operators.json"), REPO).errors).toEqual([]);
  });
  it("every operator names the publisher of an operator page behind a value, and keeps where it was taken from", () => {
    const ops = [...world.operators.values()];
    expect(ops).toHaveLength(10);
    for (const o of ops) {
      expect(o.derived_from!.length, o.ref).toBeGreaterThan(0);
      expect(o.derived_from!.every((d) => d.publisher === o.name), o.ref).toBe(true);
    }
    const withOp = records.filter((r) => r.run_by);
    expect(withOp).toHaveLength(12);
    for (const r of withOp) expect(r.layer, r.ref).toBe("offer");
  });
});

describe("the committed migration (each kind of split)", () => {
  const all = splits().flatMap((f) => f.splits);
  const cap = (ref: string) => world.cap.get(ref)?.rec;

  it("a trail judged as its payoff becomes a route that reaches a place; the relevance judgement sits on the place", () => {
    const list = all.filter((s) => s.how === "trail_payoff");
    expect(list.filter((s) => (s.place as { mode: string }).mode === "new")).toHaveLength(26);
    expect(list.filter((s) => (s.place as { mode: string }).mode === "existing")).toHaveLength(7);
    for (const s of list) {
      const route = cap(s.ref)!;
      expect(route.layer, s.ref).toBe("route");
      expect(route.reaches, s.ref).toHaveLength(1);
      const place = cap(route.reaches![0]!)!;
      expect(place.layer, s.ref).toBe("place");
      expect(world.rel.has(s.ref), `${s.ref} keeps no relevance record`).toBe(false);
      if ((s.place as { mode: string }).mode === "new") {
        expect(place.origin?.from, s.ref).toBe(s.ref);
        const rel = world.rel.get(place.ref)?.rec;
        expect(rel, place.ref).toBeTruthy();
        expect(["lake", "viewpoint", "waterfall", "peak", "canyon", "gorge", "glacier"], place.ref).toContain(rel!.class_key.split("/")[0]);
      } else {
        // the judgement the place already had stays; the trail's own is kept verbatim for the reviewer
        expect(s.displaced_relevance!.ref, s.ref).toBe(s.ref);
        expect(s.displaced_sources!.length, s.ref).toBeGreaterThan(0);
        expect(world.rel.has(place.ref), place.ref).toBe(true);
      }
    }
  });
  it("an activity stored as a place becomes an offer that keeps its ref, its suitability record and its relevance record", () => {
    const list = all.filter((s) => s.how === "offer");
    expect(list).toHaveLength(15);
    for (const s of list) {
      const o = cap(s.ref)!;
      expect(o.layer, s.ref).toBe("offer");
      expect(world.suit.has(s.ref), s.ref).toBe(true);
      expect(world.rel.has(s.ref), s.ref).toBe(true);
      if (s.at) expect(o.at, s.ref).toHaveLength(1);
      else expect(o.at, s.ref).toEqual(["trip/patagonia-2027/sight:perito moreno walkways"]); // placement: its same_place_as
    }
    expect(list.filter((s) => !s.at)).toHaveLength(1); // the minitrekking: placement.json sets it from same_place_as
  });
  it("a lift becomes a line, a ticket offer that carries the suitability block, and its top station", () => {
    const list = all.filter((s) => s.how === "lift");
    expect(list).toHaveLength(6);
    for (const s of list) {
      const line = cap(s.ref)!;
      const ticket = cap(s.ticket!.ref)!;
      const top = cap(s.top!.ref)!;
      expect([line.layer, ticket.layer, top.layer], s.ref).toEqual(["route", "offer", "place"]);
      expect(line.reaches).toEqual([top.ref]);
      expect(ticket.on).toEqual([{ ref: s.ref }]);
      expect(ticket.offer_class).toBe("ticket");
      expect(world.suit.has(s.ticket!.ref), s.ref).toBe(true);
      expect(world.suit.has(s.ref), `${s.ref} has no suitability record of its own`).toBe(false);
      // placement: draw and class go to the top station, unless the ride is the attraction (the Montenvers train)
      const stays = s.ref.endsWith("montenvers train");
      expect(world.rel.has(s.ref), s.ref).toBe(stays);
      expect(world.rel.has(top.ref), top.ref).toBe(!stays);
      expect(line.route_is_attraction === true, s.ref).toBe(stays);
    }
  });
  it("a place with a walk of 2 km or more keeps its facilities and exposure; the walk's effort and time move to a route", () => {
    const list = all.filter((s) => s.how === "place_walk");
    expect(list).toHaveLength(3);
    for (const s of list) {
      const place = world.suit.get(s.ref)!.rec.suitability as Record<string, unknown>;
      const route = world.suit.get(s.route!.ref!)!.rec.suitability as Record<string, unknown>;
      expect(place.effort, s.ref).toBeUndefined();
      expect(route.effort, s.ref).toBeDefined();
      expect(place.walk_m, `${s.ref} keeps walk_m`).toBeDefined();
      expect(cap(s.route!.ref!)!.reaches).toEqual([s.ref]);
    }
  });
  it("the Drava cycle path and the two Canmore Nordic Centre records are routes; the elk rut is a viewing place with a new event", () => {
    expect(cap("place/drava-cycle-path-to-lienz")!.layer).toBe("route");
    expect(cap("legacy/canadian-rockies-sept-2029/adventures/canmore-nordic-centre")!.layer).toBe("route");
    // the stub sights/canmore-nordic-centre is an alias of the real record
    expect(world.alias.get("legacy/canadian-rockies-sept-2029/sights/canmore-nordic-centre")).toBe("legacy/canadian-rockies-sept-2029/adventures/canmore-nordic-centre");
    expect(world.alias.get("legacy/canadian-rockies-sept-2029/sights/banff-gondola")).toBe("legacy/canadian-rockies-sept-2029/adventures/banff-gondola");
    const elk = cap("legacy/canadian-rockies-sept-2029/adventures/elk-rut")!;
    expect(elk.layer).toBe("place");
    const ev = cap("part/legacy/canadian-rockies-sept-2029/adventures/elk-rut#rut")!;
    expect([ev.layer, ev.type, ev.part_of]).toEqual(["event", "event.natural", [elk.ref]]);
  });
  it("the five records already cut out in S0b start at their parent", () => {
    for (const ref of ["part/place/lago-di-braies#walk", "part/place/lago-di-dobbiaco#walk", "part/place/lago-di-limides#walk", "part/place/lago-federa#walk"]) {
      const r = cap(ref)!;
      expect([r.layer, r.type.startsWith("nature.trail."), r.starts_at]).toEqual(["route", true, [ref.split("#")[0]!.slice("part/".length)]]);
    }
    expect(cap("part/place/lagazuoi-cable-car-and-tunnels#tunnels")!.starts_at).toEqual(["place/lagazuoi-cable-car-and-tunnels"]);
  });
});

describe("no value lost, none changed", () => {
  const ledger = read<Ledger>(LEDGER_PATH);
  const now = ledgerOf(REPO, displacedRelevance(REPO), removedSuitability(REPO));
  const leaves = laneLeaves(REPO, displacedRelevance(REPO), removedSuitability(REPO));

  it("every leaf of the suitability lane files before the migration still exists with the same value (new records and leaves are allowed)", () => {
    expect(ledger.suitability.held!.length).toBeGreaterThan(1000);
    expect(lostLeaves(ledger.suitability, leaves.suitability)).toBe(0);
    expect(now.suitability.leaves).toBeGreaterThanOrEqual(ledger.suitability.leaves);
    expect(now.suitability.records).toBeGreaterThanOrEqual(ledger.suitability.records + 3 + 12 + 1); // 3 routes cut from long walks, 12 places given the facts placement moved, and the one record of dropped duplicates
  });
  it("every leaf of the relevance lane files, with the seven displaced judgements kept in the splits files, still exists with the same value", () => {
    expect(displacedRelevance(REPO)).toHaveLength(7);
    expect(lostLeaves(ledger.relevance, leaves.relevance)).toBe(0);
    expect(now.relevance.records).toBeGreaterThanOrEqual(ledger.relevance.records);
    expect(now.relevance.leaves).toBeGreaterThanOrEqual(ledger.relevance.leaves);
  });
  it("the check is strict: a changed or removed ledger leaf fails, an added leaf passes", () => {
    const mutated = leaves.suitability.map((l, i) => (i === 10 ? l + "-changed" : l));
    expect(lostLeaves(ledger.suitability, mutated)).toBe(1);
    expect(lostLeaves(ledger.suitability, leaves.suitability.slice(1))).toBe(1);
    expect(lostLeaves(ledger.relevance, leaves.relevance.filter((_, i) => i !== 5))).toBe(1);
    expect(lostLeaves(ledger.suitability, [...leaves.suitability, "hours.v=\"new\""])).toBe(0);
    expect(lostLeaves(ledger.relevance, [...leaves.relevance, "class_key=\"new\""])).toBe(0);
  });
  it("every point the relevance inputs held is still held, on the ref or on the payoff place that took the judgement", () => {
    const points = (read<{ points: Record<string, { lat: number; lon: number }> }>("data/relevance/inputs/points.json")).points;
    const payoff = new Map<string, string>();
    for (const s of splits().flatMap((f) => f.splits)) if (s.how === "trail_payoff" && (s.place as { mode: string }).mode === "new") payoff.set(s.ref, (s.place as { ref: string }).ref);
    const plan = read<{ draw_moves: { from: string; to: string }[]; cs7_draw_moves?: { from: string; to: string }[] }>("data/capture/placement.json");
    for (const m of [...plan.draw_moves, ...(plan.cs7_draw_moves ?? [])]) payoff.set(m.from, m.to);
    let kept = 0;
    for (const [ref, [lat, lon]] of Object.entries(ledger.points)) {
      const here = points[ref];
      const there = payoff.has(ref) ? points[payoff.get(ref)!] : undefined;
      const ok = (here && here.lat === lat && here.lon === lon) || (there && there.lat === lat && there.lon === lon);
      // a displaced judgement's point sat on the trail ref and is on the existing place now only when that place had it already
      if (ok) kept++;
      else expect(payoff.has(ref) ? "moved to a payoff place with no point" : "lost", ref).toBe("moved to a payoff place with no point");
    }
    expect(kept).toBeGreaterThanOrEqual(Object.keys(ledger.points).length - 10);
  });
  it("leavesOf ignores identity and the computed flat copy, and sees every other leaf", () => {
    const a = leavesOf({ ref: "x", kind: "lake", subkind: "lake", flat: { suit_level: "draft" }, suitability: { age_band: { v: { from: 4, to: null }, state: "value" } }, hints: [] });
    expect(a.sort()).toEqual(["hints=[]", "suitability.age_band.state=\"value\"", "suitability.age_band.v.from=4", "suitability.age_band.v.to=null"]);
  });
  it("serializeLike keeps a file's own escaping, so a lane file's diff shows only what moved", () => {
    expect(serializeLike('{"a": "\\u00e9"}', { a: "é" })).toBe('{\n  "a": "\\u00e9"\n}\n');
    expect(serializeLike('{"a": "x"}', { a: "é" })).toBe('{\n  "a": "é"\n}\n');
  });
});

describe("the migration program on a fixture root", () => {
  const val = (v: unknown, extra: Record<string, unknown> = {}) => ({ v, state: "value", basis: "operator_rule", src: ["src-0001"], ...extra });
  const srcRow = { id: "src-0001", url: "https://www.wildwater.com/rafting", title: "Rafting", publisher: "Wild Water Adventures", kind: "operator", read: "2026-10-18" };
  function fixture(): string {
    const r = scratchRoot({
      "data/suitability/scope.json": scope(["lake-x", "river-y", "gondola-z", "falls-w"], []),
      "data/suitability/kind-map.json": { schema: "suitability-kind-map/1", entries: [
        { ref: "place/lake-x", name: "Lake X hike", from: { kind: "trail", subkind: null }, kind: "trail", subkind: "hike", reason: "fixture" },
        { ref: "place/river-y", name: "River Y rafting", from: { kind: "activity", subkind: null }, kind: "activity", subkind: "rafting", reason: "fixture" },
        { ref: "place/gondola-z", name: "Gondola Z", from: { kind: "lift", subkind: null }, kind: "lift", subkind: "gondola", reason: "fixture" },
        { ref: "place/falls-w", name: "Falls W", from: { kind: "waterfall", subkind: null }, kind: "waterfall", subkind: "waterfall", reason: "fixture" },
      ], split: [] },
      "data/suitability/fixture-trip/R1.json": { schema: "suitability/1", trip: "fixture-trip", lane: "R1", researched: "2026-10-18", agent: "t", model: "t", sources: [srcRow], records: [
        { ref: "place/lake-x", kind: "trail", subkind: "hike", suitability: { adult_time_min: val([120, 180]) } },
        { ref: "place/river-y", kind: "activity", subkind: "rafting", suitability: { min_age: val(8) } },
        { ref: "place/gondola-z", kind: "lift", subkind: "gondola", suitability: { min_age: val(0) } },
        { ref: "place/falls-w", kind: "waterfall", subkind: "waterfall", suitability: { effort: { drivers: { distance_km: val(2.4, { basis: "official_info" }) } }, adult_time_min: val([60, 90]), walk_m: val(1200, { basis: "official_info" }) } },
      ] },
      "data/relevance/fixture-trip/R1.json": { schema: "relevance/1", trip: "fixture-trip", lane: "R1", researched: "2026-10-18", sources: [], records: [
        { ref: "place/lake-x", kind: "trail", subkind: "hike", wikidata: { v: "Q1", state: "value", basis: "our_inference", src: [], note: "checked" }, class_key: "lake/alpine-hike-in", draw: val("regional", { basis: "our_inference" }), why: "A lake at the end of a hike." },
      ] },
    });
    const sp: SplitsFile = { schema: "capture-splits/1", trip: "fixture-trip", reviewed: "2026-10-18", note: "fixture", splits: [
      { ref: "place/lake-x", how: "trail_payoff", reason: "r", route: { type: "nature.trail.hike" }, place: { mode: "new", ref: "part/place/lake-x#payoff", type: "water.body.lake", kind: "lake", name: "Lake X" } },
      { ref: "place/river-y", how: "offer", reason: "r", offer: { type: "water.river.rafting", class: "experience" }, at: { mode: "new", ref: "part/place/river-y#place", type: "water.body.river", name: "River Y" } },
      { ref: "place/gondola-z", how: "lift", reason: "r", line: { type: "ride.lift.gondola" }, ticket: { ref: "offer/place/gondola-z#ticket", type: "ride.lift.gondola", class: "ticket" }, top: { ref: "part/place/gondola-z#top", type: "access.transit.station", name: "Gondola Z top station" } },
      { ref: "place/falls-w", how: "place_walk", reason: "r", route: { ref: "part/place/falls-w#walk", type: "nature.trail.walk", name: "Falls W walk" }, move: ["effort", "adult_time_min", "child_time_min", "bail_out"] },
    ] };
    put(r, "data/capture/splits/fixture-trip.json", sp);
    put(r, "data/capture/type-map.json", { schema: "capture-type-map/1", reviewed: "2026-10-18", note: "fixture", overrides: [] });
    return r;
  }

  it("types every ref by its legacy pair, cuts the records out and moves the blocks", () => {
    const plan = planMigration(fixture());
    expect(plan.problems).toEqual([]);
    expect(plan.report.refs).toBe(4);
    expect(plan.report.split.by_how).toEqual({ trail_payoff: 1, offer: 1, lift: 1, place_walk: 1 });
    const doc = plan.capture.get("fixture-trip")!;
    const by = new Map(doc.records.map((r) => [r.ref, r]));
    expect(by.get("place/lake-x")).toMatchObject({ type: "nature.trail.hike", layer: "route", reaches: ["part/place/lake-x#payoff"] });
    expect(by.get("part/place/lake-x#payoff")).toMatchObject({ type: "water.body.lake", layer: "place", name: "Lake X", origin: { from: "place/lake-x" } });
    expect(by.get("place/river-y")).toMatchObject({ type: "water.river.rafting", layer: "offer", at: ["part/place/river-y#place"], run_by: "operator/wild-water-adventures" });
    expect(by.get("place/gondola-z")).toMatchObject({ layer: "route", reaches: ["part/place/gondola-z#top"] });
    expect(by.get("offer/place/gondola-z#ticket")).toMatchObject({ layer: "offer", offer_class: "ticket", on: [{ ref: "place/gondola-z" }] });
    expect(by.get("part/place/falls-w#walk")).toMatchObject({ layer: "route", reaches: ["place/falls-w"] });
    // cut-out records follow their origin
    expect(doc.records.map((r) => r.ref).slice(0, 3)).toEqual(["place/lake-x", "part/place/lake-x#payoff", "place/river-y"]);
    expect(plan.operators.map((o) => o.ref)).toEqual(["operator/wild-water-adventures"]);
    expect(plan.operators[0]!.url).toBe("https://www.wildwater.com/");
  });
  it("moves the payoff's relevance record to the place and leaves no judgement on the route", () => {
    const plan = planMigration(fixture());
    const w = plan.writes.find((x) => x.path.endsWith("relevance/fixture-trip/R1.json"))!;
    const doc = JSON.parse(w.text) as { records: { ref: string; kind: string; subkind?: string; class_key: string }[] };
    expect(doc.records.map((r) => r.ref)).toEqual(["part/place/lake-x#payoff"]);
    expect(doc.records[0]).toMatchObject({ kind: "lake", class_key: "lake/alpine-hike-in" });
    expect(doc.records[0]!.subkind).toBeUndefined();
    expect(plan.report.relevance_moved).toBe(1);
  });
  it("renames a lift's suitability record to its ticket and splits a long walk off a place, keeping every leaf", () => {
    const root = fixture();
    const before = ledgerOf(root);
    const plan = planMigration(root);
    const w = plan.writes.find((x) => x.path.endsWith("suitability/fixture-trip/R1.json"))!;
    const doc = JSON.parse(w.text) as { records: { ref: string; kind: string; subkind: string; suitability: Record<string, unknown> }[] };
    expect(doc.records.map((r) => r.ref)).toEqual(["place/lake-x", "place/river-y", "offer/place/gondola-z#ticket", "place/falls-w", "part/place/falls-w#walk"]);
    const falls = doc.records.find((r) => r.ref === "place/falls-w")!;
    const walk = doc.records.find((r) => r.ref === "part/place/falls-w#walk")!;
    expect(Object.keys(falls.suitability)).toEqual(["walk_m"]);
    expect(Object.keys(walk.suitability).sort()).toEqual(["adult_time_min", "effort"]);
    expect([walk.kind, walk.subkind]).toEqual(["trail", "walk"]);
    // the leaves, summed over the written files, equal the leaves before
    const written = (doc.records as Record<string, unknown>[]).flatMap(leavesOf).sort();
    const was = ((JSON.parse(readFileSync(join(root, "data/suitability/fixture-trip/R1.json"), "utf8")) as { records: Record<string, unknown>[] }).records).flatMap(leavesOf).sort();
    expect(written).toEqual(was);
    expect(before.suitability.leaves).toBeGreaterThan(0);
  });
  it("reports a type the tree does not have and a split of a ref that is not a record", () => {
    const root = fixture();
    const sp = JSON.parse(readFileSync(join(root, "data/capture/splits/fixture-trip.json"), "utf8")) as SplitsFile;
    sp.splits[0]!.route!.type = "nature.trail.nothing";
    sp.splits.push({ ref: "place/ghost", how: "route", reason: "r", route: { type: "nature.trail.walk" } });
    put(root, "data/capture/splits/fixture-trip.json", sp);
    const problems = planMigration(root).problems.join("\n");
    expect(problems).toContain("nature.trail.nothing");
    expect(problems).toContain("place/ghost");
  });
  it("capture.ts migrate refuses to run on migrated data", () => {
    const r = spawnSync("node", [join(REPO, "core/bin/capture.ts"), "migrate", "--root", REPO], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("already migrated");
  });
});
