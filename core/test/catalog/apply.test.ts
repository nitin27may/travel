import { describe, expect, it } from "vitest";
import { validateFile } from "../../src/validate/index.ts";
import { AGENT, FIXROOT, OWNER, SIDECARS, must, newStore, op, propose, rows } from "./util.ts";
import { MemoryStore } from "../../src/store/memory.ts";
import { join } from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";

const TRAILS = "data/catalog/trails/AR.json";
const changes = (store: MemoryStore): any[] => (store.text("data/catalog/changes/2026-10.jsonl") ?? "").split("\n").filter(Boolean).map((l) => JSON.parse(l));

async function applied(sidecar = SIDECARS.trails) {
  const store = newStore();
  const p = await propose(store, sidecar);
  const r: any = must(await op(store, "catalog.apply", { proposal_id: p.proposal_id }, AGENT));
  return { store, p, r };
}

/** write the in-memory catalog to a temp root and run the real file validator over it */
function validateOnDisk(store: MemoryStore, paths: string[]): string[] {
  const root = mkdtempSync(join(tmpdir(), "p4b-"));
  for (const sub of ["data/locations", "data/vocab"]) mkdirSync(join(root, sub), { recursive: true });
  writeFileSync(join(root, "data/locations/locations.json"), readFileSync(join(FIXROOT, "data/locations/locations.json")));
  writeFileSync(join(root, "data/vocab/tags.json"), readFileSync(join(FIXROOT, "data/vocab/tags.json")));
  const errs: string[] = [];
  for (const p of paths) {
    mkdirSync(join(root, p, ".."), { recursive: true });
    writeFileSync(join(root, p), store.text(p)!);
    errs.push(...validateFile(join(root, p), root).errors.map((e) => `${p} ${e.code} ${e.message}`));
  }
  return errs;
}

describe("apply: new rows", () => {
  it("writes the three trails into data/catalog/trails/AR.json as proposed and stated, never verified", async () => {
    const { store } = await applied();
    const t = rows(store, TRAILS, "trails");
    expect(t.map((r) => r.id)).toEqual([
      "AR/santa-cruz/el-chalten/laguna-capri-and-mirador-fitz-roy",
      "AR/santa-cruz/el-chalten/laguna-de-los-tres",
      "AR/tierra-del-fuego/ushuaia/senda-costera",
    ]);
    for (const r of t) {
      expect(r.review_status).toBe("proposed");
      expect(r.confidence).toBe("stated");
      expect(r.verified_by).toBeNull();
      expect(r.last_verified).toBeNull();
      expect(r.contributed_by).toEqual(["agent:trails"]);
      expect(r.licence).toBe("own-words");
      expect(r.updated).toBe("2026-10-17");
    }
    expect(validateOnDisk(store, [TRAILS, "data/catalog/changes/2026-10.jsonl"])).toEqual([]);
  });

  it("records provenance: the file's sources table, row sources and field_meta per field", async () => {
    const { store } = await applied();
    const doc = JSON.parse(store.text(TRAILS)!);
    expect(doc.sources.map((s: any) => [s.id, s.kind])).toEqual([["src-0001", "official"], ["src-0002", "blog"], ["src-0003", "official"]]);
    const ldlt = doc.trails.find((r: any) => r.id.endsWith("laguna-de-los-tres"));
    expect(ldlt.sources).toEqual(["src-0001"]);
    expect(ldlt.field_meta.km).toEqual({ kind: "official", read: "2026-10-13", src: ["src-0001"] });
    expect(ldlt.field_meta.hazards).toMatchObject({ confidence: "gap", gap_reason: "wind gust limit not stated" });
    expect(ldlt.field_meta.external).toEqual({ osm_relation: 4485261 });
    const capri = doc.trails.find((r: any) => r.id.endsWith("laguna-capri-and-mirador-fitz-roy"));
    expect(capri.sources).toEqual(["src-0001", "src-0002"]);
  });

  it("appends catalog_changes rows: seq, actor, entity, op, before null, after the row, proposal id, sources", async () => {
    const { store, p } = await applied();
    const log = changes(store);
    expect(log.map((r) => r.seq)).toEqual([1, 2, 3]);
    expect(log[0]).toMatchObject({ actor_id: "agent:trails", actor_via: "cli", entity: "trails", op: "add", before: null, proposal_id: p.proposal_id, at: "2026-10-17T15:00:00Z" });
    expect(log[0].after.id).toBe("AR/santa-cruz/el-chalten/laguna-capri-and-mirador-fitz-roy");
    expect(log[0].sources.length).toBeGreaterThan(0);
  });

  it("running the same sidecar after apply gives an empty proposal (idempotent)", async () => {
    const { store } = await applied();
    const again = await propose(store, SIDECARS.trails);
    expect(again.proposal).toBeNull();
    expect(again.changes).toBe(0);
  });

  it("is idempotent for offers, prices and activities too, and applies price snapshots in order", async () => {
    const { store } = await applied(SIDECARS.adventure);
    const prices = rows(store, "data/catalog/offers/CA.json", "offer_prices");
    expect(prices.map((p) => [p.id, p.amount, p.currency, p.per])).toEqual([
      ["of-banff-jasper-collection-banff-gondola#1", 70, "CAD", "adult"],
      ["of-banff-jasper-collection-banff-gondola#2", 35, "CAD", "child"],
    ]);
    expect(prices[0].source_id).toBe("src-0001");
    // only what was held back for review comes again
    const again = await propose(store, SIDECARS.adventure);
    expect(again.proposal.changes.map((c: any) => c.id)).toEqual(["CA/AB/banff-national-park/quokka-walk"]);
    expect(validateOnDisk(store, ["data/catalog/offers/CA.json", "data/catalog/activities/CA.json"])).toEqual([]);
  });

  it("applying with no change ids applies only the auto-accepted ones; the others wait", async () => {
    const store = newStore();
    const p = await propose(store, SIDECARS.adventure);
    expect(p.auto).toBeLessThan(p.changes);
    must(await op(store, "catalog.apply", { proposal_id: p.proposal_id }, AGENT));
    const stored = JSON.parse(store.text(`data/catalog/proposals/${p.proposal_id}.json`)!);
    expect(stored.status).toBe("partial");
    const open = stored.changes.filter((c: any) => c.status === "open");
    expect(open.map((c: any) => c.id)).toEqual(["CA/AB/banff-national-park/quokka-walk"]);
    // the owner takes it explicitly
    must(await op(store, "catalog.apply", { proposal_id: p.proposal_id, change_ids: [open[0].change_id] }));
    expect(JSON.parse(store.text(`data/catalog/proposals/${p.proposal_id}.json`)!).status).toBe("applied");
    expect(rows(store, "data/catalog/activities/CA.json", "activities").find((r) => r.name === "Quokka Walk").type).toBe("other");
  });

  it("an invalid result writes nothing: a row in an unknown area is refused with the validator's message", async () => {
    const store = newStore();
    const p = await propose(store, SIDECARS.badArea);
    const before = JSON.stringify(store.snapshot());
    const r = await op(store, "catalog.apply", { proposal_id: p.proposal_id, change_ids: [p.proposal.changes[0].change_id] });
    expect(r).toMatchObject({ ok: false, code: "E_FK" });
    expect(JSON.stringify(store.snapshot())).toBe(before);
  });

  it("a change that needs another is refused until it is included", async () => {
    const store = newStore();
    const p = await propose(store, SIDECARS.adventure);
    const price = p.proposal.changes.find((c: any) => c.entity === "offer_prices");
    expect(await op(store, "catalog.apply", { proposal_id: p.proposal_id, change_ids: [price.change_id] })).toMatchObject({ ok: false, code: "E_DEPENDS" });
  });

  it("every write needs an actor", async () => {
    const store = newStore();
    const p = await propose(store, SIDECARS.trails);
    const { runCatalogOp } = await import("../../src/catalog/ops.ts");
    expect(await runCatalogOp(store, "catalog.apply", { proposal_id: p.proposal_id })).toMatchObject({ ok: false, code: "E_ACTOR" });
  });
});

describe("apply: edits and the possible-duplicate alternatives", () => {
  it("applies a corroboration, recording the second official source", async () => {
    const { store } = await applied();
    const p = await propose(store, SIDECARS.corroborate, AGENT, "2026-10-14");
    must(await op(store, "catalog.apply", { proposal_id: p.proposal_id }, AGENT, "2026-10-14"));
    const ldlt = rows(store, TRAILS, "trails").find((r) => r.id.endsWith("laguna-de-los-tres"));
    expect(ldlt.field_meta.km.src).toEqual(["src-0001", "src-0004"]);
    expect((await propose(store, SIDECARS.corroborate, AGENT, "2026-10-14")).proposal).toBeNull();
  });

  it("refuses an edit when the row changed after the proposal (stale before)", async () => {
    const { store } = await applied();
    const p = await propose(store, SIDECARS.update, AGENT, "2026-10-21");
    // make the proposal expect something else by editing the row first
    must(await op(store, "catalog.edit", { entity: "trails", id: "AR/santa-cruz/el-chalten/laguna-de-los-tres", patch: { loss_m: 940 }, reason: "owner measured" }));
    const c = p.proposal.changes[0];
    expect(await op(store, "catalog.apply", { proposal_id: p.proposal_id, change_ids: [c.change_id] })).toMatchObject({ ok: false, code: "E_STALE_CHANGE" });
  });

  it("merge option: applying it supersedes the add and merges into the existing row", async () => {
    const store = newStore();
    const first = await propose(store, SIDECARS.stays);
    must(await op(store, "catalog.apply", { proposal_id: first.proposal_id }, AGENT));
    const p = await propose(store, SIDECARS.duplicate, AGENT, "2026-10-18");
    const [add, merge] = p.proposal.changes;
    expect(await op(store, "catalog.apply", { proposal_id: p.proposal_id, change_ids: [add.change_id, merge.change_id] }, OWNER, "2026-10-18")).toMatchObject({ ok: false, code: "E_EXCLUSIVE" });
    must(await op(store, "catalog.apply", { proposal_id: p.proposal_id, change_ids: [merge.change_id] }, OWNER, "2026-10-18"));
    const stored = JSON.parse(store.text(`data/catalog/proposals/${p.proposal_id}.json`)!);
    expect(stored.changes.map((c: any) => c.status)).toEqual(["superseded", "applied"]);
    const stays = rows(store, "data/catalog/stays/AR.json", "stays");
    expect(stays).toHaveLength(2);
    expect(stays.find((r) => r.id.endsWith("hosteria-el-pilar")).field_meta.sleeps_max.alternatives[0]).toMatchObject({ value: 6, kind: "reseller" });
  });
});

describe("reject and undo", () => {
  it("reject marks changes rejected and leaves the catalog untouched", async () => {
    const store = newStore();
    const p = await propose(store, SIDECARS.weak);
    const id = p.proposal.changes[0].change_id;
    must(await op(store, "catalog.reject", { proposal_id: p.proposal_id, change_ids: [id] }));
    expect(store.text(TRAILS)).toBeNull();
    expect(JSON.parse(store.text(`data/catalog/proposals/${p.proposal_id}.json`)!)).toMatchObject({ status: "rejected" });
    expect(await op(store, "catalog.apply", { proposal_id: p.proposal_id, change_ids: [id] })).toMatchObject({ ok: false, code: "E_NOOP" });
  });

  it("undo of an applied add retires the row (rows are never deleted) and reopens the change", async () => {
    const { store, p } = await applied();
    const first = p.proposal.changes[0];
    must(await op(store, "catalog.undo", { proposal_id: p.proposal_id, change_ids: [first.change_id] }));
    const row = rows(store, TRAILS, "trails").find((r) => r.id === first.id);
    expect(row.review_status).toBe("retired");
    expect(rows(store, TRAILS, "trails")).toHaveLength(3);
    const stored = JSON.parse(store.text(`data/catalog/proposals/${p.proposal_id}.json`)!);
    expect(stored.changes[0]).toMatchObject({ status: "open", applied: null });
    expect(changes(store).at(-1)).toMatchObject({ op: "retire", entity: "trails" });
  });

  it("undo of an applied edit puts the fields back", async () => {
    const { store } = await applied();
    const p = await propose(store, SIDECARS.update, AGENT, "2026-10-21");
    const c = p.proposal.changes[0];
    const beforeRow = rows(store, TRAILS, "trails").find((r) => r.id === c.id);
    must(await op(store, "catalog.apply", { proposal_id: p.proposal_id, change_ids: [c.change_id] }, OWNER, "2026-10-21"));
    expect(rows(store, TRAILS, "trails").find((r) => r.id === c.id).loss_m).toBe(950);
    must(await op(store, "catalog.undo", { proposal_id: p.proposal_id }, OWNER, "2026-10-21"));
    const after = rows(store, TRAILS, "trails").find((r) => r.id === c.id);
    expect({ ...after, updated: "x" }).toEqual({ ...beforeRow, updated: "x" });
  });

  it("undo removes an appended price snapshot", async () => {
    const { store } = await applied(SIDECARS.adventure);
    const p = await propose(store, SIDECARS.priceJump, AGENT, "2026-11-20");
    must(await op(store, "catalog.apply", { proposal_id: p.proposal_id }, AGENT, "2026-11-20"));
    expect(rows(store, "data/catalog/offers/CA.json", "offer_prices")).toHaveLength(3);
    must(await op(store, "catalog.undo", { proposal_id: p.proposal_id }, OWNER, "2026-11-20"));
    expect(rows(store, "data/catalog/offers/CA.json", "offer_prices")).toHaveLength(2);
  });
});

describe("retire, merge, verify, edit", () => {
  const T = "AR/santa-cruz/el-chalten/laguna-de-los-tres";

  it("catalog.retire keeps the row and logs it; it needs confirmation", async () => {
    const { store } = await applied();
    expect(await op(store, "catalog.retire", { entity: "trails", id: T, reason: "closed" })).toMatchObject({ ok: false, code: "E_SCHEMA" });
    must(await op(store, "catalog.retire", { entity: "trails", id: T, reason: "path closed for good", confirmed: true }));
    const row = rows(store, TRAILS, "trails").find((r) => r.id === T);
    expect(row).toBeTruthy();
    expect(row.review_status).toBe("retired");
    expect(changes(store).at(-1)).toMatchObject({ op: "retire", id: T, reason: "path closed for good", before: { review_status: "proposed" }, after: { review_status: "retired" } });
    expect(await op(store, "catalog.verify", { entity: "trails", id: T })).toMatchObject({ ok: false, code: "E_NOT_ELIGIBLE" });
    expect(validateOnDisk(store, [TRAILS])).toEqual([]);
  });

  it("a merge keeps the surviving id, records merged_from, retires the duplicate, and is reversible from catalog_changes", async () => {
    const store = newStore();
    const first = await propose(store, SIDECARS.stays);
    must(await op(store, "catalog.apply", { proposal_id: first.proposal_id }, AGENT));
    const keep = "AR/santa-cruz/el-chalten/hosteria-el-pilar";
    const drop = "AR/santa-cruz/el-chalten/refugio-poincenot";
    const snapshot = rows(store, "data/catalog/stays/AR.json", "stays");
    must(await op(store, "catalog.merge", { entity: "stays", keep, drop, reason: "same place under two names" }));
    const now = rows(store, "data/catalog/stays/AR.json", "stays");
    const k = now.find((r) => r.id === keep);
    const d = now.find((r) => r.id === drop);
    expect(k.merged_from).toEqual([drop]);
    expect(d.review_status).toBe("retired");
    expect(d.field_meta.merged_into).toBe(keep);
    expect(now).toHaveLength(2);
    // reverse from the log: put every changed key back from `before`
    const merges = changes(store).filter((r) => r.op === "merge");
    expect(merges.map((r) => r.id)).toEqual([keep, drop]);
    const restored = now.map((row) => {
      const entry = merges.find((m) => m.id === row.id);
      return entry ? { ...row, ...entry.before } : row;
    });
    expect(restored).toEqual(snapshot);
    expect(validateOnDisk(store, ["data/catalog/stays/AR.json"])).toEqual([]);
  });

  it("an owner verifies a row; verification is the only way to verified", async () => {
    const { store } = await applied();
    must(await op(store, "catalog.verify", { entity: "trails", id: T, note: "walked it" }, OWNER, "2026-10-18"));
    const row = rows(store, TRAILS, "trails").find((r) => r.id === T);
    expect(row).toMatchObject({ review_status: "verified", confidence: "verified", verified_by: "u_owner", last_verified: "2026-10-18" });
    const others = rows(store, TRAILS, "trails").filter((r) => r.id !== T);
    expect(others.every((r) => r.review_status === "proposed" && r.verified_by === null)).toBe(true);
  });

  it("an agent cannot verify a row on one official source", async () => {
    const { store } = await applied();
    const r = await op(store, "catalog.verify", { entity: "trails", id: T }, AGENT);
    expect(r).toMatchObject({ ok: false, code: "E_NOT_ELIGIBLE" });
    expect((r as any).message).toContain("name has 1 official source");
  });

  it("the two-official-sources rule promotes when two official hosts state every required fact", async () => {
    const { store } = await applied();
    const p = await propose(store, SIDECARS.corroborate, AGENT, "2026-10-14");
    must(await op(store, "catalog.apply", { proposal_id: p.proposal_id }, AGENT, "2026-10-14"));
    // still proposed after the corroboration: promotion is a separate, explicit step
    expect(rows(store, TRAILS, "trails").find((r) => r.id === T).review_status).toBe("proposed");
    must(await op(store, "catalog.verify", { entity: "trails", id: T }, AGENT, "2026-10-15"));
    expect(rows(store, TRAILS, "trails").find((r) => r.id === T)).toMatchObject({ review_status: "verified", verified_by: "rule:two-official-sources", last_verified: "2026-10-15" });
  });

  it("two official sources on the same host do not count", async () => {
    const { store } = await applied();
    const doc = JSON.parse(store.text(TRAILS)!);
    const row = doc.trails.find((r: any) => r.id === T);
    doc.sources.push({ id: "src-0009", url: "https://www.argentina.gob.ar/other/page", title: "t", publisher: "p", kind: "official", read: "2026-10-14" });
    for (const f of ["name", "km"]) row.field_meta[f].src.push("src-0009");
    await store.write(TRAILS, new TextEncoder().encode(JSON.stringify(doc)));
    expect(await op(store, "catalog.verify", { entity: "trails", id: T }, AGENT)).toMatchObject({ ok: false, code: "E_NOT_ELIGIBLE" });
  });

  it("catalog.edit changes fields with a reason, logs before and after, does not verify, and refuses provenance and identity", async () => {
    const { store } = await applied();
    must(await op(store, "catalog.edit", { entity: "trails", id: T, patch: { house_grade: 5 }, reason: "final 2.4 km is exposed scrambling in wind" }));
    const row = rows(store, TRAILS, "trails").find((r) => r.id === T);
    expect(row.house_grade).toBe(5);
    expect(row.contributed_by).toEqual(["agent:trails", "u_owner"]);
    expect(row.review_status).toBe("proposed");
    expect(row.field_meta.house_grade).toMatchObject({ kind: "owner", by: "u_owner" });
    expect(changes(store).at(-1)).toMatchObject({ op: "edit", id: T, before: { house_grade: 4 }, after: { house_grade: 5 }, reason: "final 2.4 km is exposed scrambling in wind" });
    for (const patch of [{ review_status: "verified" }, { id: "x" }, { verified_by: "u_owner" }, { nope: 1 }]) {
      expect(await op(store, "catalog.edit", { entity: "trails", id: T, patch, reason: "x" })).toMatchObject({ ok: false, code: "E_SCHEMA" });
    }
    expect(await op(store, "catalog.edit", { entity: "trails", id: T, patch: { house_grade: 5 }, reason: "again" })).toMatchObject({ ok: false, code: "E_NOOP" });
  });

  it("catalog.add lands as proposed and stated whatever the row says", async () => {
    const store = newStore();
    const row = JSON.parse(JSON.stringify(rows(newStore({ [TRAILS]: "{}" }), TRAILS, "trails") ?? [])) as any;
    void row;
    const res = await op(store, "catalog.add", {
      entity: "eateries",
      row: {
        id: "AR/santa-cruz/el-chalten/la-cerveceria", area_id: "AR/santa-cruz/el-chalten", name: "La Cerveceria", name_lang: null, tags: [], kid_fit: "unknown", min_age: null, max_age: null,
        min_height_cm: null, max_height_cm: null, min_weight_kg: null, max_weight_kg: null, house_grade: null, walk_km: null, walk_gain_m: null, duration_min: null, accessibility: "unknown",
        season_months: [], cost_ref: null, lat: -49.331, lon: -72.887, review_status: "verified", confidence: "verified", sources: [], field_meta: {}, verified_by: "u_owner", last_verified: "2026-10-01",
        contributed_by: [], licence: "own-words", merged_from: [], updated: "2026-10-17", cuisine: null, price_tier: null, kids_menu: null, reservation: null, hours: {}, notes: "",
      },
      reason: "owner added by hand",
    });
    must(res);
    expect(rows(store, "data/catalog/eateries/AR.json", "eateries")[0]).toMatchObject({ review_status: "proposed", confidence: "stated", verified_by: null, last_verified: null, contributed_by: ["u_owner"] });
  });
});
