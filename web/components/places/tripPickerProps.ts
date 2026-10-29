// What the place page tells the trip picker (STEP2-P1, PR-001, PR-006): called only with `tripEdit` on, so a build with the flag off
// carries nothing of it (EA12). Server side: the day each public trip that uses the place has it on comes from the public plan.
import { getTrip, type PublicPlace } from '@/lib/public';
import type { EditProps } from './SaveToTrip';

export function tripPickerProps(place: Pick<PublicPlace, 'slug' | 'kind' | 'subkind' | 'trips' | 'point'>): EditProps {
  const park = place.kind === 'area' || place.subkind === 'range';
  const days: Record<string, number> = {};
  if (!park) {
    for (const t of place.trips) {
      const day = getTrip(t.slug)?.days.find((d) => d.items.some((i) => i.placeSlug === place.slug))?.n;
      if (day !== undefined) days[t.slug] = day;
    }
  }
  const out: EditProps = { park, trips: place.trips.map((t) => t.slug) };
  if (place.point) out.at = [Math.round(place.point.lon * 100) / 100, Math.round(place.point.lat * 100) / 100];
  if (Object.keys(days).length) out.days = days;
  return out;
}
