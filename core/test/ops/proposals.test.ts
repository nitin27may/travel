import { describe, expect, it } from "vitest";
import { serializeJson } from "../../src/store/index.ts";
import type { Failure } from "../../src/ops/run.ts";
import { SLUG, TRIP_PATH, check, newStore, run } from "./util.ts";

const PROPOSAL = `data/trips/${SLUG}/proposals/pr-1.json`;
const item = (over: Record<string, unknown>) => ({
  id: "d05-i01", day: 5, track: null, seq: 1, start: "09:00", window_start: null, window_end: null, tz: null, duration_min: 60, type: "sight", optional: false, pinned: false,
  title: "Mirador", place_id: null, trail_id: null, activity_id: null, eatery_id: null, custom_item_id: null, base_id: null, booking_id: null, lat: null, lon: null,
  address: null, leg_id: null, leg_mode: null, leg_km: null, leg_minutes: null, leg_basis: null, leg_notes: "", cost_amount: null, cost_currency: null, cost_per: null,
  open_from: null, open_to: null, closed_weekdays: [], needs_daylight: false, plan_b_item_id: null, override: null, notes: "", links: [], ...over,
});
const prov = { research_ref: "rr-1", src: ["src-0001"], fact_keys: ["trails.mirador"] };
const proposal = (changes: unknown[]) => serializeJson({ schema: "proposal/1", id: "pr-1", slug: SLUG, created: "2026-10-17", source: "research.propose", status: "open", changes });
const goodChanges = [
  { id: "c1", op: "item.add", input: { row: item({}) }, summary: "Add the Mirador stop", status: "open", provenance: prov },
  { id: "c2", op: "question.add", input: { row: { id: "q-mirador", text: "Is the Mirador open in March?", status: "open", answer: null, asked: "2026-10-17" } }, summary: "Ask about opening", status: "open", provenance: prov },
  { id: "c3", op: "trip_booking.set_status", input: { id: "bk-piratour", status: "held" }, summary: "Hold the tour", status: "open" },
];
const withProposal = (changes: unknown[]) => newStore({ [PROPOSAL]: proposal(changes) });
const doc = (s: ReturnType<typeof newStore>): any => JSON.parse(s.text(TRIP_PATH)!);

describe("proposals", () => {
  it("proposal.apply runs every open change in order and marks them applied", async () => {
    const { r, store } = await check("proposal.apply", { proposal_id: "pr-1" }, { store: withProposal(goodChanges), files: [PROPOSAL] });
    expect(r.changed).toEqual(expect.arrayContaining(["d05-i01", "q-mirador", "bk-piratour"]));
    const d = doc(store);
    expect(d.changelog.slice(-4).map((c: any) => c.op)).toEqual(["item.add", "question.add", "trip_booking.set_status", "proposal.apply"]);
    expect(JSON.parse(store.text(PROPOSAL)!)).toMatchObject({ status: "applied" });
  });

  it("applies only the named changes and leaves the proposal partial", async () => {
    const { store } = await check("proposal.apply", { proposal_id: "pr-1", change_ids: ["c2"] }, { store: withProposal(goodChanges), files: [PROPOSAL], variant: "subset" });
    const p = JSON.parse(store.text(PROPOSAL)!);
    expect(p.status).toBe("partial");
    expect(p.changes.map((c: any) => c.status)).toEqual(["open", "applied", "open"]);
    expect(doc(store).items.some((i: any) => i.id === "d05-i01")).toBe(false);
  });

  it("stops at the first failure and writes nothing", async () => {
    const store = withProposal([goodChanges[0], { ...goodChanges[1], id: "c2", op: "item.add", input: { row: item({}) } }, goodChanges[2]]);
    const before = store.snapshot();
    const res = (await run(store, "proposal.apply", { proposal_id: "pr-1" })) as Failure;
    expect(res.ok).toBe(false);
    expect(res.code).toBe("E_PK_DUP");
    expect(res.message).toContain("change c2");
    expect(res.message).toContain("Nothing was applied");
    expect(store.snapshot()).toEqual(before);
  });

  it("a final state that fails validation writes nothing, even when each step was fine", async () => {
    const bad = { id: "c1", op: "day.add", input: { row: { n: 11, title: "x", kind: "mixed", base_id: "no-such-base", summary: "", prose: null, flexible_group: null, decision_rules: [], plan_b_title: "", plan_b_text: null, sun_note: null, day_of_links: [], accepted_warnings: [] } }, summary: "", status: "open" };
    const store = withProposal([bad]);
    const before = store.snapshot();
    const res = (await run(store, "proposal.apply", { proposal_id: "pr-1" })) as Failure;
    expect(res.ok).toBe(false);
    expect(res.code).toBe("E_FK");
    expect(store.snapshot()).toEqual(before);
  });

  it("proposal.reject marks changes rejected and writes no trip data", async () => {
    const { store } = await check("proposal.reject", { proposal_id: "pr-1", change_ids: ["c1", "c3"] }, { store: withProposal(goodChanges), files: [PROPOSAL] });
    expect(JSON.parse(store.text(PROPOSAL)!).changes.map((c: any) => c.status)).toEqual(["rejected", "open", "rejected"]);
  });

  it("an unknown proposal or change is E_NOT_FOUND; an applied change cannot be applied twice", async () => {
    const store = withProposal(goodChanges);
    expect(((await run(store, "proposal.apply", { proposal_id: "nope" })) as Failure).code).toBe("E_NOT_FOUND");
    expect(((await run(store, "proposal.apply", { proposal_id: "pr-1", change_ids: ["c9"] })) as Failure).code).toBe("E_NOT_FOUND");
    expect((await run(store, "proposal.apply", { proposal_id: "pr-1" })).ok).toBe(true);
    expect(((await run(store, "proposal.apply", { proposal_id: "pr-1" })) as Failure).code).toBe("E_NOOP");
  });
});
