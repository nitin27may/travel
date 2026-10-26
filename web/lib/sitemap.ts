// The sitemap, split by kind once it passes SITEMAP_LIMIT urls (backlog 2.41: 10,000 places). Up to the limit it is one file; past it,
// `/sitemap.xml` is an index of files that each hold one kind (the pages and trips, then the places in parts), so a crawler reads small files.
import { absoluteUrl } from '@/lib/site';

export const SITEMAP_LIMIT = 5000;

export interface SitemapInput {
  fixed: string[];
  places: string[];
  trips: string[];
}

export interface SitemapPlan {
  /** True when `/sitemap.xml` is an index; false when it is the one file. */
  index: boolean;
  /** The files: one with id `all` when no index, else `pages`, `places-1`, `places-2` ... */
  files: { id: string; paths: string[] }[];
}

export function sitemapPlan(input: SitemapInput, limit = SITEMAP_LIMIT): SitemapPlan {
  const all = [...input.fixed, ...input.places, ...input.trips];
  if (all.length <= limit) return { index: false, files: [{ id: 'all', paths: all }] };
  const files: SitemapPlan['files'] = [{ id: 'pages', paths: [...input.fixed, ...input.trips] }];
  for (let i = 0; i * limit < input.places.length; i++) files.push({ id: `places-${i + 1}`, paths: input.places.slice(i * limit, (i + 1) * limit) });
  return { index: true, files };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';

export const urlsetXml = (paths: string[]): string => `${HEAD}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `<url><loc>${esc(absoluteUrl(p))}</loc></url>`).join('\n')}\n</urlset>\n`;
export const indexXml = (ids: string[]): string => `${HEAD}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ids.map((id) => `<sitemap><loc>${esc(absoluteUrl(`/sitemaps/${id}/sitemap.xml`))}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`;

/** The pages the sitemap lists: public pages only, at the same canonical URLs the pages declare. */
export function sitemapInput(placeSlugs: string[], tripSlugs: string[]): SitemapInput {
  return {
    fixed: ['/', '/trips/', '/places/', '/globe/', '/about/', '/about/data/', '/terms/', '/privacy/'],
    places: placeSlugs.map((s) => `/places/${s}/`),
    trips: tripSlugs.map((s) => `/trips/${s}/`),
  };
}
