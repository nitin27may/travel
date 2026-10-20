import { placeSlugs, tripSlugs } from '@/lib/public';
import { sitemapInput, sitemapPlan, urlsetXml } from '@/lib/sitemap';

// The files an index points to. While the site is small there is no index, so the one placeholder file here is empty and unlinked.
export const dynamic = 'force-static';
export const dynamicParams = false;

const plan = () => sitemapPlan(sitemapInput(placeSlugs(), tripSlugs()));

export function generateStaticParams(): { id: string }[] {
  const p = plan();
  // `output: export` refuses an empty list
  return p.index ? p.files.map((f) => ({ id: f.id })) : [{ id: 'none' }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const file = plan().files.find((f) => f.id === id);
  return new Response(urlsetXml(file?.paths ?? []), { headers: { 'Content-Type': 'application/xml' } });
}
