import { EntityPage } from '@/components/entity/EntityPage';
import { loadPlaces } from '@/lib/data/places';
import { pageMetadata } from '@/lib/site';
import { placeView } from '@/lib/views/places';

export const metadata = pageMetadata({
  title: 'Places',
  description: 'Every place we want to go, grouped by country, region and area. Filter by kind, status, season and kid fit.',
  path: '/places/',
});

export default function PlacesPage() {
  const rows = loadPlaces().map((p) => placeView(p));
  return <EntityPage type="place" rows={rows} lede="Every place we want to go, by country, region and area. Filter, sort, or switch to the table." />;
}
