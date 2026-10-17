import { describe, expect, it } from "vitest";
import { catalogProposal } from "../../src/catalog/proposal.ts";
import { AGENT, SIDECARS, must, newStore, op, propose, rows } from "./util.ts";

const find = (p: any, entity: string, name: string) => p.changes.find((c: any) => c.entity === entity && (c.after.name === name || c.id.endsWith(name)));

describe("propose: new rows", () => {
  it("proposes the three Patagonia trails, auto-accepted, with sources, read dates and fact keys", async () => {
    const store = newStore();
    const r = await propose(store, SIDECARS.trails);
    expect(r.changes).toBe(3);
    expect(r.auto).toBe(3);
    expect(r.unknown_tags).toEqual(["Fitz Roy"]);
    const p = r.proposal;
    expect(catalogProposal.safeParse(p).success).toBe(true);
    expect(p.id).toMatch(/^cp-2026-10-17-trails-[0-9a-f]{6}$/);
    expect(p.source).toEqual({ sidecar: SIDECARS.trails, lane: "trails", researched: "2026-10-13" });
    const ldlt = find(p, "trails", "Laguna de los Tres");
    expect(ldlt).toMatchObject({ op: "add", id: "AR/santa-cruz/el-chalten/laguna-de-los-tres", auto: true, status: "open", before: null, flags: [], missing: [] });
    expect(ldlt.after.house_grade).toBe(4);
    expect(ldlt.sources).toEqual([expect.objectContaining({ id: "src-0001", kind: "official", read: "2026-10-13" })]);
    expect(ldlt.fact_keys).toEqual(["laguna-de-los-tres.hazards"]);
    expect(ldlt.fields.find((f: any) => f.field === "hazards")).toMatchObject({ kind: "gap", incoming: "wind gust limit not stated" });
    expect(ldlt.reason).toContain("official source");
    const capri = find(p, "trails", "Laguna Capri and Mirador Fitz Roy");
    expect(capri.sources.map((s: any) => s.kind)).toEqual(["official", "blog"]);
    expect(store.text(`data/catalog/proposals/${p.id}.json`)).toBeTruthy();
  });

  it("proposing again before anything is applied keeps the same proposal", async () => {
    const store = newStore();
    const a = await propose(store, SIDECARS.trails);
    const b = await propose(store, SIDECARS.trails);
    expect(b.proposal_id).toBe(a.proposal_id);
    expect(b.existing).toBe(true);
  });

  it("a blog-only source is never auto-accepted", async () => {
    const r = await propose(newStore(), SIDECARS.weak);
    expect(r.changes).toBe(1);
    expect(r.auto).toBe(0);
    expect(r.proposal.changes[0].reason).toContain("no official or operator source (best: blog)");
  });

  it("a row missing a required field is flagged incomplete and goes to review", async () => {
    const r = await propose(newStore(), SIDECARS.incomplete);
    const c = r.proposal.changes[0];
    expect(c.auto).toBe(false);
    expect(c.flags).toContain("incomplete");
    expect(c.missing).toEqual(["km", "house_grade"]);
  });

  it("switching the new-row rule off in policy.json sends everything to review", async () => {
    const store = newStore();
    const pol = JSON.parse(store.text("data/catalog/policy.json")!);
    pol.rules.find((x: any) => x.id === "new-row").enabled = false;
    await store.write("data/catalog/policy.json", new TextEncoder().encode(JSON.stringify(pol)));
    const r = await propose(store, SIDECARS.trails);
    expect(r.auto).toBe(0);
    expect(r.proposal.changes[0].reason).toContain("new-row rule is off");
  });

  it("places and items are skipped with a note, and an unknown sidecar is a clear error", async () => {
    const store = newStore();
    const res = await op(store, "catalog.propose", { sidecar: "research/trips/none/none.json" });
    expect(res).toMatchObject({ ok: false, code: "E_NOT_FOUND" });
    const bad = await op(store, "catalog.propose", { slug: "x" });
    expect(bad).toMatchObject({ ok: false });
  });
});

describe("propose: offers and prices", () => {
  it("proposes activities, the offer and its two price snapshots; prices depend on the offer", async () => {
    const r = await propose(newStore(), SIDECARS.adventure);
    const p = r.proposal;
    const offer = p.changes.find((c: any) => c.entity === "offers");
    const prices = p.changes.filter((c: any) => c.entity === "offer_prices");
    expect(offer.id).toBe("of-banff-jasper-collection-banff-gondola");
    expect(prices).toHaveLength(2);
    expect(prices.map((c: any) => c.depends_on)).toEqual([[offer.change_id], [offer.change_id]]);
    expect(prices.map((c: any) => c.id)).toEqual(["of-banff-jasper-collection-banff-gondola#1", "of-banff-jasper-collection-banff-gondola#2"]);
    expect(prices.every((c: any) => c.auto)).toBe(true);
    // the unknown activity type is stored as other, with its warning on the change
    const quokka = find(p, "activities", "Quokka Walk");
    expect(quokka.after.type).toBe("other");
    expect(quokka.warnings.join(" ")).toContain("W_ENUM_UNKNOWN");
    expect(quokka.auto).toBe(false);
  });
});

describe("propose: changes to rows that exist", () => {
  async function seeded() {
    const store = newStore();
    const first = await propose(store, SIDECARS.trails);
    must(await op(store, "catalog.apply", { proposal_id: first.proposal_id }));
    return store;
  }

  it("a later operator value for a stored official fact is a review item (replace is never auto)", async () => {
    const store = await seeded();
    const r = await propose(store, SIDECARS.update, AGENT, "2026-10-21");
    const c = r.proposal.changes[0];
    expect(c.op).toBe("edit");
    expect(c.id).toBe("AR/santa-cruz/el-chalten/laguna-de-los-tres");
    // operator is weaker than the stored official km, so km is an alternative; loss_m is a fill
    expect(c.fields.find((f: any) => f.field === "km")).toMatchObject({ kind: "alternative", incoming: 22.4 });
    expect(c.fields.find((f: any) => f.field === "loss_m")).toMatchObject({ kind: "fill" });
    expect(c.auto).toBe(false);
    expect(c.reason).toContain("km: 22.4 is older or weaker than 21.5");
  });

  it("a second official host stating the same facts is an auto corroboration", async () => {
    const store = await seeded();
    const r = await propose(store, SIDECARS.corroborate, AGENT, "2026-10-14");
    const c = r.proposal.changes[0];
    expect(c.fields.map((f: any) => f.kind)).toEqual(expect.arrayContaining(["corroborate"]));
    expect(c.auto).toBe(true);
  });

  it("a possible duplicate gets the add and a merge option that exclude each other, always for review", async () => {
    const store = newStore();
    const first = await propose(store, SIDECARS.stays);
    must(await op(store, "catalog.apply", { proposal_id: first.proposal_id }));
    const r = await propose(store, SIDECARS.duplicate, AGENT, "2026-10-18");
    const [add, merge] = r.proposal.changes;
    expect(add).toMatchObject({ op: "add", auto: false, duplicate_of: "AR/santa-cruz/el-chalten/hosteria-el-pilar", excludes: [merge.change_id] });
    expect(add.flags).toContain("possible-duplicate");
    expect(add.match).toMatchObject({ kind: "possible", by: "geo+name" });
    expect(merge).toMatchObject({ op: "edit", id: "AR/santa-cruz/el-chalten/hosteria-el-pilar", auto: false, excludes: [add.change_id] });
    expect(merge.fields.find((f: any) => f.field === "sleeps_max")).toMatchObject({ kind: "alternative" });
  });

  it("a price that moves more than 20 percent is auto and carries a question for the trips using the offer", async () => {
    const store = newStore();
    const first = await propose(store, SIDECARS.adventure);
    must(await op(store, "catalog.apply", { proposal_id: first.proposal_id }));
    const r = await propose(store, SIDECARS.priceJump, AGENT, "2026-11-20");
    const c = r.proposal.changes[0];
    expect(c).toMatchObject({ entity: "offer_prices", id: "of-banff-jasper-collection-banff-gondola#3", auto: true });
    expect(c.flags).toEqual(["price-jump"]);
    expect(c.question).toContain("up 50 percent");
    expect(rows(store, "data/catalog/offers/CA.json", "offer_prices")).toHaveLength(2);
  });
});
