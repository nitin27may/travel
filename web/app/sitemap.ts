import type { MetadataRoute } from 'next';
import { loadPlaces } from '@/lib/data/places';
import { placeHref } from '@/lib/data/paths';
import { loadListedTrips } from '@/lib/data/trips';
import { absoluteUrl } from '@/lib/site';

export const dynamic = 'force-static';

/** Public pages only: lists, place pages and listed trips. Unlisted and private trips never appear. */
export default function sitemap(): MetadataRoute.Sitemap {
  const fixed = ['/', '/trips/', '/places/', '/about/data/'];
  const places = loadPlaces().map((p) => placeHref(p.id));
  const trips = loadListedTrips().map((t) => t.href).filter(Boolean);
  return [...fixed, ...places, ...trips].map((p) => ({ url: absoluteUrl(p) }));
}
