import { buildToday } from '@/lib/data/root';
import { loadListedTrips } from '@/lib/data/trips';
import { entityView, tripView } from '@/lib/views/places';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(entityView(loadListedTrips().map(tripView), buildToday()));
}
