import { placeExportFor, placeSlugs } from '@/lib/export/build.server';

// The data behind ExportMenu on a place page (GPX and KML where licensed). (Lane L5.)
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  // `output: export` refuses an empty list (the privacy fixture has none), so one placeholder file is built then.
  const slugs = placeSlugs();
  return (slugs.length ? slugs : ['stub']).map((slug) => ({ slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = placeExportFor(slug);
  return Response.json(data ?? { type: 'none' });
}
