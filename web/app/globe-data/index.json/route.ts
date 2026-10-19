import { buildGlobeFiles } from '@/lib/globe/data';

// The globe's area tree with counts and each country's centre: written once at build time (backlog 2.39). No pins.
export const dynamic = 'force-static';

export function GET(): Response {
  return Response.json(buildGlobeFiles().tree);
}
