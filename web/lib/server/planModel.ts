import type { CatalogueStore } from '@travel/core/catalogue/store.ts';
import { fail, ok, type Result } from '@travel/core/catalogue/result.ts';
import type { TripPlanModelLookup } from '@travel/core/schema/api/index.ts';
import { buildTripPageModel, type PlaceLookup } from '@/components/trips/model';
import { getPlace, getTrip, listPlaces } from '@/lib/public';

// `GET /api/v1/trips/{slug}/plan-model` (STEP2-M; gap-analysis D6): the model the public trip page builds and embeds, served alone so
// `/t/<id>/` renders a copy from the same model (P9: one boundary, respond(); the person's delta is applied on the device). The store
// answers which trip a slug is (current, moved, unknown or unlisted, as getTrip) and the revision the ETag carries; the model is then
// built by the page's own function over the page's own inputs (web/app/trips/[slug]/page.tsx), so the two cannot disagree.

/** The page's lookup (web/app/trips/[slug]/page.tsx): a place's map point and photo. */
export const pagePlaceLookup: PlaceLookup = (slug) => {
  const p = getPlace(slug);
  return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null;
};

/** The model a public trip's page embeds, as JSON; null for a slug the public dataset does not hold. */
export function publicTripPlanModel(slug: string): unknown {
  const trip = getTrip(slug);
  if (!trip) return null;
  // the page offers no addables on an overview trip, so it never reads the place list for one
  const model = buildTripPageModel(trip, pagePlaceLookup, trip.depth === 'overview' ? [] : listPlaces());
  // the wire form: what the page serialises (an `undefined` key is dropped, as JSON drops it)
  return JSON.parse(JSON.stringify(model)) as unknown;
}

export async function planModelRun(store: CatalogueStore, slug: string): Promise<Result<TripPlanModelLookup>> {
  const found = await store.getTrip(slug);
  if (!found.ok) return found;
  if ('moved' in found.data) return ok(found.data, found.revision);
  const model = publicTripPlanModel(found.data.slug);
  if (!model) return fail('not_found', 'No such trip.');
  return ok(model as TripPlanModelLookup, found.revision);
}
