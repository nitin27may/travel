import { tripExportFor, tripSlugs } from '@/lib/export/build.server';

// The data behind ExportMenu and CopySheet on a trip page: built from the public dataset, served as a static file so the
// browser can generate GPX, KML, CSV and the dated calendar without a server. (Lane L5.)
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  // `output: export` refuses an empty list (the privacy fixture has none), so one placeholder file is built then.
  const slugs = tripSlugs();
  return (slugs.length ? slugs : ['stub']).map((slug) => ({ slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = tripExportFor(slug);
  return Response.json(data ?? { type: 'none' });
}
