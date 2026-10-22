// K-image: the site never reads a photo from Commons or Wikimedia at runtime (principle P8, the rendition rule of lib/format/image.ts).
// No image URL in any answer of any method is an off-site URL; the credit link to a file's own Commons page is a link, not an image.
import { expect } from "vitest";
import { API_LIMITS, type PlaceRow, type TripRow } from "../../../src/schema/api/index.ts";
import { allRows, expectOk, type ContractCase } from "./kit.ts";

const OFF_SITE_IMAGE = /Special:FilePath|upload\.wikimedia\.org/;

/** Every string in an output that is an image address from off the site, with its path. */
export function offSiteImages(out: unknown, where: string, hits: string[] = []): string[] {
  const walk = (x: unknown, p: string): void => {
    if (typeof x === "string") {
      if (OFF_SITE_IMAGE.test(x)) hits.push(`${p}: ${x.slice(0, 90)}`);
    } else if (Array.isArray(x)) x.forEach((y, i) => walk(y, `${p}[${i}]`));
    else if (x && typeof x === "object") for (const [k, y] of Object.entries(x)) walk(y, `${p}.${k}`);
  };
  walk(out, where);
  return hits;
}

export const imageCases: ContractCase[] = [
  {
    id: "K-image",
    title: "no row, detail, trip or globe card carries an off-site image URL: every photo is a same-origin rendition or is left out",
    method: "all",
    async run(store, t) {
      const hits: string[] = [];
      const places = await allRows<PlaceRow>((n) => store.listPlaces({}, { page: n, pageSize: API_LIMITS.pageSize.max }));
      hits.push(...offSiteImages(places, "listPlaces"));
      for (const p of places) {
        hits.push(...offSiteImages(expectOk(await store.getPlace(p.slug)), `getPlace ${p.slug}`));
        const card = await store.globeCard(`place:${p.slug}`);
        if (card.ok) hits.push(...offSiteImages(card.data, `globeCard ${p.slug}`));
      }
      const trips = await allRows<TripRow>((n) => store.listTrips({}, { page: n }));
      hits.push(...offSiteImages(trips, "listTrips"));
      for (const tr of trips) {
        hits.push(...offSiteImages(expectOk(await store.getTrip(tr.slug)), `getTrip ${tr.slug}`));
        const card = await store.globeCard(`trip:${tr.slug}`);
        if (card.ok) hits.push(...offSiteImages(card.data, `globeCard trip ${tr.slug}`));
      }
      hits.push(...offSiteImages(expectOk(await store.getExport({ type: "place", slug: t.facts.exportPlace, format: "print" })), "getExport"));
      expect(hits).toEqual([]);
      // the check is live
      expect(offSiteImages({ image: { url: "https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg?width=960" } }, "probe").length).toBe(1);
    },
  },
];
