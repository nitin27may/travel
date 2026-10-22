// The globe methods: per country and per item, never the world in one body (P8); shapes and not_found.
import { expect } from "vitest";
import { globeCardFile, globeFeature, globeLine, globeTree, lightPin } from "../../../src/schema/api/index.ts";
import { expectError, expectOk, type ContractCase } from "./kit.ts";

export const globeCases: ContractCase[] = [
  {
    id: "globeTree.shape",
    title: "the tree parses and holds no pin",
    method: "globeTree",
    async run(store) {
      const tree = expectOk(await store.globeTree());
      expect(globeTree.safeParse(tree).success).toBe(true);
      expect(JSON.stringify(tree)).not.toMatch(/"pins"/);
    },
  },
  {
    id: "globePins.scope",
    title: "pins come for one country only; a malformed code is invalid_input",
    method: "globePins",
    async run(store, t) {
      const pins = expectOk(await store.globePins(t.facts.pinCountry));
      expect(pins.length).toBeGreaterThan(0);
      for (const p of pins) {
        expect(lightPin.safeParse(p).success, p.slug).toBe(true);
        expect(p.path[0]).toBe(t.facts.pinCountry);
      }
      expectError(await store.globePins("all"), "invalid_input");
    },
  },
  {
    id: "globeCard.one",
    title: "a card is one pin's; an unknown key is not_found",
    method: "globeCard",
    async run(store, t) {
      const got = expectOk(await store.globeCard(`place:${t.facts.placeSlug}`));
      expect(globeCardFile.safeParse(got).success).toBe(true);
      expect(got.card.slug).toBe(t.facts.placeSlug);
      expectError(await store.globeCard("place:no-such-place-anywhere"), "not_found");
      expectError(await store.globeCard("everything"), "invalid_input");
    },
  },
  {
    id: "globeFeature.one",
    title: "a feature and its line by id; unknown ids are not_found",
    method: "globeFeature",
    async run(store, t) {
      expect(globeFeature.safeParse(expectOk(await store.globeFeature(t.facts.featureId))).success).toBe(true);
      expect(globeLine.safeParse(expectOk(await store.globeLine(t.facts.featureId))).success).toBe(true);
      expectError(await store.globeFeature("no-such-feature"), "not_found");
      expectError(await store.globeLine("no-such-feature"), "not_found");
    },
  },
  {
    id: "globeCity.layer",
    title: "a city outline answers not_available until the towns layer exists",
    method: "globeCity",
    async run(store, t) {
      const r = await store.globeCity(t.facts.town.id);
      if (!t.facts.town.layer) return expectError(r, "not_available");
      expect(r.ok || (!r.ok && r.error.code === "not_found")).toBe(true);
    },
  },
];
