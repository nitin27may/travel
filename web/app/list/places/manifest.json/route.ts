import { placeShards } from '@/app/places/shards';

// The Places list manifest: the row counts per file and the option counts of the unfiltered list. Written once at build time.
export const dynamic = 'force-static';

export function GET(): Response {
  return Response.json(placeShards().manifest);
}
