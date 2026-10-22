import { movedTo, type SpaceName } from '@travel/core/catalogue/slugs.ts';
import { readSlugRegistry } from '@/lib/public/places';
import { travelRoot } from '@/lib/data/root';

// A slug the registry retired (`slugs.ts rename`) answers 308 to the page's current slug (D-B1, case K9). The page routes read the
// registry here; the API answers the same from JsonStore.
const registry = (() => {
  let r: ReturnType<typeof readSlugRegistry> | null = null;
  return () => (r ??= readSlugRegistry(travelRoot()));
})();

/** The retired slugs of a space: pre-rendered as redirects. */
export const retiredSlugs = (space: SpaceName): string[] => Object.keys(registry()[space].retired);

/** The current slug of a retired one, or null. */
export const currentSlugOf = (slug: string, space: SpaceName): string | null => movedTo(registry(), slug, space)?.slug ?? null;
