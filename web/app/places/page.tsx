import { EntityPage } from '@/components/entity/EntityPage';
import '@/components/places/families';
import { buildPlaceRows } from '@/components/places/rows';
import { loadPlaces } from '@/lib/data/places';
import { getPlace, legacyPlaceRedirects, listPlaces } from '@/lib/public';
import { pageMetadata } from '@/lib/site';
import '@/styles/places.css';

export const metadata = pageMetadata({
  title: 'Places',
  description: 'Every place we want to go, grouped by country, region and area. Filter by kind, status, season and kid fit.',
  path: '/places/',
});

export default function PlacesPage() {
  const rows = buildPlaceRows(listPlaces(), loadPlaces(), legacyPlaceRedirects(), (slug) => getPlace(slug)?.elevationM ?? null);
  return <EntityPage type="place" rows={rows} lede="Every place we want to go, by country, region and area. Filter, sort, or switch to the table or the map." />;
}
