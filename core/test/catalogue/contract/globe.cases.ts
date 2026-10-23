// The globe methods: per country and per item, never the world in one body (P8); shapes and not_found.
import { expect } from "vitest";
import { buildOpenApi } from "../../../src/catalogue/openapi.ts";
import { CATALOGUE_CONTRACT } from "../../../src/catalogue/store.ts";
import { API_LIMITS, GLOBE_CARD_KINDS, globeCardFile, globeFeature, globeLine, globeTree, lightPin } from "../../../src/schema/api/index.ts";
import { expectError, expectOk, type ContractCase } from "./kit.ts";

type Requester = { request(path: string): Promise<{ status: number; text: string }> };

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
    id: "K25",
    title: "the contract and OpenAPI publish the card at /api/v1/globe/card/{kind}/{slug}, kind one of place or trip (A29)",
    method: "globeCard",
    async run() {
      const path = "/api/v1/globe/card/{kind}/{slug}";
      expect(CATALOGUE_CONTRACT.globeCard.http).toBe(`GET ${path}`);
      const op = (buildOpenApi().paths as Record<string, { get?: { operationId: string; parameters: { name: string; in: string; schema: { enum?: string[] } }[] } }>)[path]?.get;
      expect(op?.operationId).toBe("globeCard");
      const params = op!.parameters.filter((p) => p.in === "path");
      expect(params.map((p) => p.name)).toEqual(["kind", "slug"]);
      expect(params[0]!.schema.enum).toEqual([...GLOBE_CARD_KINDS]);
      expect(Object.keys(buildOpenApi().paths as object).filter((p) => p.includes("{key}"))).toEqual([]);
    },
  },
  {
    id: "K25.handler",
    title: "GET /api/v1/globe/card/place/<slug>/ answers the card whose key is place:<slug>; an unknown kind is invalid_input (through respond())",
    method: "handler",
    layer: "handler",
    async run(store, t) {
      const { request } = store as unknown as Requester;
      const res = await request(`/api/v1/globe/card/place/${t.facts.placeSlug}/`);
      expect(res.status).toBe(200);
      expect(JSON.parse(res.text).card.key).toBe(`place:${t.facts.placeSlug}`);
      expect((await request(`/api/v1/globe/card/area/${t.facts.placeSlug}/`)).status).toBe(400);
    },
  },
  {
    id: "globePins.cap",
    title: "a country with more than 2,000 pins answers too_large with details.max, never a cut list (A36, GB-A-10)",
    method: "globePins",
    awaits: { step: "API-3b step 11 (A36: the pins cap)", failsWith: /expected too_large/ },
    async run(_store, t) {
      expect(t.plant, "the target must plant pins").toBeDefined();
      const cc = t.facts.pinCountry;
      const store = await t.plant!({ pins: { cc, n: API_LIMITS.globePins.max + 1 } });
      const r = await store.globePins(cc);
      expectError(r, "too_large", "result: expected too_large");
      if (!r.ok) expect(r.error.details?.max).toBe(API_LIMITS.globePins.max);
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
