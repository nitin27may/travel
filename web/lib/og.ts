import { absoluteUrl } from '@/lib/site';

/**
 * Share image URL for a trip or a place: `/og/<kind>/<slug>.jpg`. scripts/og.mjs --prebuild writes one per page before
 * `next build` (hero photo, title, Trailhead type), from the same loaders the pages use, so the tag and the file always match.
 */
export function ogImageFor(kind: 'trips' | 'places', slug: string): string {
  return absoluteUrl(`/og/${kind}/${slug}.jpg`);
}
