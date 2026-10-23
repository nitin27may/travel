import { movedTo, type SpaceName } from '@travel/core/catalogue/slugs.ts';
import { readSlugRegistry } from '@/lib/public/places';
import { travelRoot } from '@/lib/data/root';

// A slug the registry retired (`slugs.ts rename`) answers 308 to the page's current slug (D-B1, case K9). The page routes read the
// registry here; the API answers the same from JsonStore.
const registry = (() => {
  let r: ReturnType<typeof readSlugRegistry> | null = null;
  return () => (r ??= readSlugRegistry(travelRoot()));
})();

/**
 * The slugs that redirect: the retired ones and the ones pinned to a merged record (its page is the survivor's, `places.merged`, R-1).
 * Pre-rendered as redirects, so `next start` answers them as the API does (audit GB-B-4); a static host has them in web/redirects.json.
 */
export const retiredSlugs = (space: SpaceName): string[] => {
  const s = registry()[space];
  return [...Object.keys(s.retired), ...Object.keys(s.merged).map((k) => s.slugs[k]).filter((x): x is string => !!x)];
};

/** The current slug of a retired one, or null. */
export const currentSlugOf = (slug: string, space: SpaceName): string | null => movedTo(registry(), slug, space)?.slug ?? null;
