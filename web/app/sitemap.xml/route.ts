import { placeSlugs, tripSlugs } from '@/lib/public';
import { indexXml, sitemapInput, sitemapPlan, urlsetXml } from '@/lib/sitemap';

export const dynamic = 'force-static';

/** One file while the site is small; an index of per-kind files past 5,000 urls (see lib/sitemap.ts). */
export function GET(): Response {
  const plan = sitemapPlan(sitemapInput(placeSlugs(), tripSlugs()));
  const body = plan.index ? indexXml(plan.files.map((f) => f.id)) : urlsetXml(plan.files[0]!.paths);
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
}
