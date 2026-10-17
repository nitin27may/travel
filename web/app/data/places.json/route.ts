import { loadPlaces } from '@/lib/data/places';
import { buildToday } from '@/lib/data/root';
import { entityView, placeView } from '@/lib/views/places';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(entityView(loadPlaces().map(placeView), buildToday()));
}
