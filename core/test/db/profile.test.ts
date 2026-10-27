// core/src/db/profile.ts without a database (ACCT-PC): the user id goes only to the transaction runner and the bound parameters,
// a document that does not validate never reaches the database, and the answers map as spec 6.6 says. The real RLS and trigger
// behaviour is core/test/db/account-profile.test.ts.
import { describe, expect, it } from "vitest";
import {
  deleteProfile,
  EMPTY_PROFILE,
  finishSetup,
  loadProfile,
  removeTravellers,
  saveTravellers,
  type UserTx,
} from "../../src/db/profile.ts";
import type { QueryResultLike, QueryRow } from "../../src/db/client.ts";
import { TRAVELLERS_SCHEMA } from "../../src/schema/travellers.ts";

const NOW = new Date("2026-10-27T12:00:00Z");
const DOC = { schema: TRAVELLERS_SCHEMA, adults: 2, children: [{ age: 7, age_as_of: "2026-10-27" }] };

interface Call {
  sql: string;
  params: readonly unknown[];
}

/** A runner that records the user and the queries and answers from a script. */
function fake(answers: QueryRow[][]): { tx: UserTx; users: string[]; calls: Call[] } {
  const users: string[] = [];
  const calls: Call[] = [];
  const tx: UserTx = async (userId, fn) => {
    users.push(userId);
    const result = await fn({
      query: async <Row extends QueryRow = QueryRow>(sql: string, params: readonly unknown[] = []) => {
        calls.push({ sql, params });
        const rows = (answers.shift() ?? []) as Row[];
        return { rows, rowCount: rows.length, command: "" } as QueryResultLike<Row>;
      },
    });
    return { result, txid: "1" };
  };
  return { tx, users, calls };
}

describe("loadProfile", () => {
  it("answers the empty profile when there is no row", async () => {
    const f = fake([[]]);
    expect(await loadProfile("user-a", { tx: f.tx, now: NOW })).toEqual(EMPTY_PROFILE);
    expect(f.users).toEqual(["user-a"]);
    expect(f.calls[0].params).toEqual(["user-a"]);
    expect(f.calls[0].sql).toMatch(/where user_id = \$1/);
  });

  it("parses the stored document and maps the row", async () => {
    const f = fake([[{ travellers: DOC, travellers_saved_at: NOW, travellers_consented_at: NOW, setup_done_at: null, revision: "3" }]]);
    const p = await loadProfile("user-a", { tx: f.tx, now: NOW });
    expect(p).toEqual({
      exists: true,
      travellers: DOC,
      travellersInvalid: false,
      travellersSavedAt: NOW.toISOString(),
      travellersConsentedAt: NOW.toISOString(),
      setupDoneAt: null,
      revision: 3,
    });
  });

  it("never hands out a stored document that no longer parses", async () => {
    const f = fake([[{ travellers: { ...DOC, children: [{ age: 7, age_as_of: "2026-10-27", name: "x" }] }, travellers_saved_at: null, travellers_consented_at: null, setup_done_at: null, revision: 1 }]]);
    const p = await loadProfile("user-a", { tx: f.tx, now: NOW });
    expect(p.travellers).toBeNull();
    expect(p.travellersInvalid).toBe(true);
    expect(p.revision).toBe(1);
  });
});

describe("saveTravellers", () => {
  it("refuses an invalid document without touching the database", async () => {
    const f = fake([]);
    const r = await saveTravellers("user-a", { ...DOC, adults: 13 }, 0, { tx: f.tx, now: NOW });
    expect(r.kind).toBe("rejected");
    expect(f.users).toEqual([]);
  });

  it("refuses a future date of birth by the server's clock", async () => {
    const f = fake([]);
    const r = await saveTravellers("user-a", { ...DOC, children: [{ age: 0, age_as_of: "2026-10-27", dob: "2026-11-30" }] }, 0, { tx: f.tx, now: NOW });
    expect(r).toEqual({ kind: "rejected", issues: ["$.children[0].dob: future"] });
  });

  it("revision 0 upserts only over a row that never held travellers, binding the session id", async () => {
    const f = fake([[{ revision: 1 }]]);
    expect(await saveTravellers("user-a", DOC, 0, { tx: f.tx, now: NOW, finishSetup: true })).toEqual({ kind: "saved", revision: 1 });
    expect(f.users).toEqual(["user-a"]);
    expect(f.calls[0].sql).toMatch(/insert into public\.account_profile/);
    expect(f.calls[0].sql).toMatch(/where p\.revision = 0/);
    expect(f.calls[0].params).toEqual(["user-a", JSON.stringify(DOC), true]);
  });

  it("a later revision updates that revision only; no row back is a conflict", async () => {
    const f = fake([[]]);
    expect(await saveTravellers("user-a", DOC, 4, { tx: f.tx, now: NOW })).toEqual({ kind: "conflict" });
    expect(f.calls[0].sql).toMatch(/^update public\.account_profile/);
    expect(f.calls[0].sql).toMatch(/where user_id = \$1 and revision = \$4/);
    expect(f.calls[0].params).toEqual(["user-a", JSON.stringify(DOC), false, 4]);
  });

  it("stores exactly the parsed document (strict: nothing else rides along)", async () => {
    const f = fake([[{ revision: 2 }]]);
    await saveTravellers("user-a", DOC, 1, { tx: f.tx, now: NOW });
    expect(JSON.parse(f.calls[0].params[1] as string)).toEqual(DOC);
  });

  it.each([-1, 1.5, Number.NaN])("answers conflict for a nonsense revision %s without a query", async (rev) => {
    const f = fake([]);
    expect(await saveTravellers("user-a", DOC, rev, { tx: f.tx, now: NOW })).toEqual({ kind: "conflict" });
    expect(f.calls).toEqual([]);
  });
});

describe("removeTravellers, finishSetup, deleteProfile", () => {
  it("removes at the loaded revision", async () => {
    const f = fake([[{ revision: 5 }]]);
    expect(await removeTravellers("user-a", 4, { tx: f.tx })).toEqual({ kind: "saved", revision: 5 });
    expect(f.calls[0].params).toEqual(["user-a", 4]);
  });

  it("is a no-op when nothing is saved, and a conflict when another device saved since", async () => {
    expect(await removeTravellers("user-a", 0, { tx: fake([[], []]).tx })).toEqual({ kind: "saved", revision: 0 });
    expect(await removeTravellers("user-a", 2, { tx: fake([[], [{ revision: 2, empty: true }]]).tx })).toEqual({ kind: "saved", revision: 2 });
    expect(await removeTravellers("user-a", 2, { tx: fake([[], [{ revision: 3, empty: false }]]).tx })).toEqual({ kind: "conflict" });
  });

  it("finishSetup keeps the first time; deleteProfile reports a removal", async () => {
    const f = fake([[{ setup_done_at: NOW }]]);
    expect(await finishSetup("user-a", { tx: f.tx })).toBe(NOW.toISOString());
    expect(f.calls[0].sql).toMatch(/coalesce\(p\.setup_done_at/);
    expect(await deleteProfile("user-a", { tx: fake([[{}]]).tx })).toBe(true);
    expect(await deleteProfile("user-a", { tx: fake([[]]).tx })).toBe(false);
  });
});
