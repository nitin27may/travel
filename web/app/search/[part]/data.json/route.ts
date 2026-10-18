import { buildSearchParts } from '@/lib/search/build';

// One part of the search index: the records of one kind in one country, written at build time.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams(): { part: string }[] {
  // `output: export` refuses an empty list (the privacy fixture has no places), so one placeholder file is built then.
  const ids = buildSearchParts().manifest.parts.map((p) => p.id);
  return (ids.length ? ids : ['none']).map((part) => ({ part }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ part: string }> }) {
  const { part } = await params;
  return Response.json(buildSearchParts().parts[part] ?? []);
}
