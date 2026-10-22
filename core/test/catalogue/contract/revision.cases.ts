// revision: K10 (content hash; equal across instances; changes with the data; an mtime never moves it), and every result carries it.
import { expect } from "vitest";
import { apiRevision } from "../../../src/schema/api/index.ts";
import { expectOk, type ContractCase } from "./kit.ts";

export const revisionCases: ContractCase[] = [
  {
    id: "K10",
    title: "the revision is a SHA-256, equal for the same data in two stores, different when one value changes",
    method: "revision",
    async run(store, t) {
      const rev = await store.revision();
      expect(apiRevision.safeParse(rev).success).toBe(true);
      expect(await (await t.make()).revision()).toBe(rev);
      expect(t.makeChanged, "the target must offer a changed store for K10").toBeDefined();
      expect(await (await t.makeChanged!()).revision()).not.toBe(rev);
      const r = await store.listPlaces({});
      expectOk(r);
      if (r.ok) expect(r.revision).toBe(rev);
    },
  },
  {
    id: "K10.mtime",
    title: "touching every data file's mtime does not change the revision",
    method: "revision",
    async run(store, t) {
      const rev = await store.revision();
      expect(t.touch, "the target must say how to touch its files").toBeDefined();
      t.touch!();
      expect(await (await t.make()).revision()).toBe(rev);
    },
  },
];
