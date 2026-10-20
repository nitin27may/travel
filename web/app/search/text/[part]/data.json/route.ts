import { placeTextShards } from '@/app/places/shards';

// One file of the full-text index (backlog 3.60): the places of one list row file, as stemmed terms with counts. Scoped like the row files,
// so no file holds the catalogue (principle P8). Written at build time.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams(): { part: string }[] {
  // `output: export` refuses an empty list (the privacy fixture has no places), so one placeholder file is built then.
  const ids = Object.keys(placeTextShards());
  return (ids.length ? ids : ['none']).map((part) => ({ part }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ part: string }> }) {
  const { part } = await params;
  return Response.json(placeTextShards()[part] ?? { v: 1, ids: [], len: [], terms: [] });
}
