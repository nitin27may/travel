import { absoluteUrl } from '@/lib/site';

/**
 * Share image URL for a trip or a place: `/og/<kind>/<slug>.jpg`. scripts/og.mjs writes one per page after
 * `next build` (hero photo, title, Trailhead type), so the tag and the file always come from the same list.
 */
export function ogImageFor(kind: 'trips' | 'places', slug: string): string {
  return absoluteUrl(`/og/${kind}/${slug}.jpg`);
}
