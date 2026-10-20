import { placeShards } from '@/app/places/shards';

// One file of Places list rows: the rows of one country (or one 300-row part of a large one), written at build time (backlog 3.59, principle P8:
// no file holds the whole list).
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams(): { part: string }[] {
  // `output: export` refuses an empty list (the privacy fixture has no places), so one placeholder file is built then.
  const ids = Object.keys(placeShards().files);
  return (ids.length ? ids : ['none']).map((part) => ({ part }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ part: string }> }) {
  const { part } = await params;
  return Response.json(placeShards().files[part] ?? []);
}
