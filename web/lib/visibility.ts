// Plan 1.3. One rule, used by every loader and exporter:
//   public   -> built, listed, in /data/*.json, indexes and the sitemap
//   unlisted -> built (reachable by URL), excluded from lists, /data, indexes and the sitemap, noindex
//   private  -> never built
// Anything that is not exactly one of the three words is treated as private (fail closed).
export type Visibility = 'public' | 'unlisted' | 'private';

export function parseVisibility(value: unknown): Visibility {
  return value === 'public' || value === 'unlisted' ? value : 'private';
}

export const isBuilt = (v: Visibility): boolean => v !== 'private';
export const isListed = (v: Visibility): boolean => v === 'public';
export const isIndexable = (v: Visibility): boolean => v === 'public';

export function builtOnly<T extends { visibility: Visibility }>(items: readonly T[]): T[] {
  return items.filter((i) => isBuilt(i.visibility));
}

export function listedOnly<T extends { visibility: Visibility }>(items: readonly T[]): T[] {
  return items.filter((i) => isListed(i.visibility));
}
