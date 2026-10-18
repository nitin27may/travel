import { buildSearchIndex } from '@/lib/search/build';

// Static export: written once at build time to /search-index.json and fetched the first time the search opens.
export const dynamic = 'force-static';

export function GET(): Response {
  return Response.json(buildSearchIndex());
}
