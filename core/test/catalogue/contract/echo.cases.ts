// K29 (store.ts A40; review API3-R-1): the search box is not an oracle. search echoes `query`, parse `q` and `unused`, card search `terms`:
// a request whose words hold the home town's name, a household term or a coordinate near home answers 200 with the echo, because an echo
// carries nothing the request did not bring. The same words in any field the request did not fill still fail closed. The home town's
// name comes from the home module's own pattern and the point from the probe, so no test types either.
import { expect } from "vitest";
import { privacyHits } from "../../../src/privacy/detect.ts";
import { northOfHome } from "../../privacy/probe.ts";
import { householdHits, type ContractCase } from "./kit.ts";
import { cap, homeWord } from "./townGuard.cases.ts";

const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** What a visitor may type: the home town's name, with a household term, and ordinary searches the text rules would otherwise refuse. */
export function echoProbes(): string[] {
  const p = northOfHome(0.4);
  return [
    cap(homeWord),
    `${cap(homeWord)} hotel ideas`,
    "hotel ideas",
    "base camp: x",
    "100 Queen Street",
    `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)} lookout above the lake`,
  ];
}

type Requester = { request(path: string): Promise<{ status: number; text: string }> };

export const echoCases: ContractCase[] = [
  {
    id: "K29",
    title: "search, parse and card search answer 200 with the echo of a request holding the home-town word, a household term or a point near home",
    method: "handler",
    layer: "handler",
    async run(store) {
      const r = store as unknown as Partial<Requester>;
      if (typeof r.request !== "function") throw new Error("K29 needs a store that can make a raw request through respond()");
      for (const q of echoProbes()) {
        const e = encodeURIComponent(q);
        const search = await r.request(`/api/v1/search/?q=${e}`);
        expect(search.status, `search ${q.length} chars`).toBe(200);
        const s = JSON.parse(search.text) as { query: string };
        expect(fold(q).includes(fold(s.query)), "search echoes the request's words").toBe(true);
        const parse = await r.request(`/api/v1/parse/?q=${e}`);
        expect(parse.status, `parse ${q.length} chars`).toBe(200);
        const p = JSON.parse(parse.text) as { q: string; unused: string[] };
        expect(fold(q).includes(fold(p.q)), "parse echoes the request's words").toBe(true);
        const cards = await r.request(`/api/v1/places/cards/?q=${e}`);
        expect(cards.status, `cards ${q.length} chars`).toBe(200);
        expect(Array.isArray((JSON.parse(cards.text) as { terms: string[] }).terms)).toBe(true);
      }
    },
  },
  {
    id: "K29.detector",
    title: "an echo is lifted only under an echo key and only when the request holds it: the same words anywhere else still fail",
    method: "all",
    async run() {
      for (const q of echoProbes()) {
        const echo = [q];
        // the echoes themselves pass
        expect(householdHits({ query: q, q, unused: q.split(" "), notYet: [q], terms: [q.toLowerCase()], href: `/places/?q=${encodeURIComponent(q)}` }, "echo", { echo })).toEqual([]);
        // the same string in a field the request did not fill: refused
        expect(householdHits({ query: q, groups: [{ hits: [{ n: q }] }] }, "planted hit", { echo }).length, "a hit holding the request's words").toBeGreaterThan(0);
        expect(householdHits({ items: [{ slug: "x", summary: q }] }, "planted summary", { echo }).length).toBeGreaterThan(0);
        // an echo key holding words the request did not send: refused
        expect(householdHits({ query: q }, "not asked", { echo: ["lake"] }).length).toBeGreaterThan(0);
        expect(householdHits({ query: q }, "no request").length).toBeGreaterThan(0);
      }
      // an echo key never lifts a structured point near home, a private key or an origin key the request did not send
      const p = northOfHome(0.4);
      expect(privacyHits({ query: "lake", at: { lat: p.lat, lon: p.lon } }, 20, { echo: ["lake"] }).length).toBe(1);
      expect(privacyHits({ q: "lake", sourceTypes: ["x"] }, 20, { echo: ["lake"] }).length).toBe(1);
      expect(privacyHits({ q: "loc:CA/x" }, 20, { echo: ["lake"] }).length).toBe(1);
    },
  },
];
