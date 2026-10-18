import type { MetadataRoute } from 'next';
import { placeSlugs, tripSlugs } from '@/lib/public';
import { absoluteUrl } from '@/lib/site';

export const dynamic = 'force-static';

/** Public pages only, at the same canonical URLs the pages declare: lists, every place and every listed trip. */
export default function sitemap(): MetadataRoute.Sitemap {
  const fixed = ['/', '/trips/', '/places/', '/globe/', '/about/data/'];
  const places = placeSlugs().map((s) => `/places/${s}/`);
  const trips = tripSlugs().map((s) => `/trips/${s}/`);
  return [...fixed, ...places, ...trips].map((p) => ({ url: absoluteUrl(p) }));
}
