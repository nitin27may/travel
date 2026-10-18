import { buildSearchParts } from '@/lib/search/build';

// The list of search parts: written once at build time (principle P8: the index is never one file).
export const dynamic = 'force-static';

export function GET(): Response {
  return Response.json(buildSearchParts().manifest);
}
