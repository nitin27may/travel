import { EntityPage } from '@/components/entity/EntityPage';
import '@/components/places/families';
import { pageMetadata } from '@/lib/site';
import '@/styles/places.css';
import { placeShards } from './shards';

export const metadata = pageMetadata({
  title: 'Places',
  description: 'Every place we want to go, grouped by country, region and area. Filter by kind, season, kid fit and whether a trip uses them.',
  path: '/places/',
});

export default function PlacesPage() {
  // the page carries the first page of rows and the manifest; the other rows are files the browser loads for the filters it is asked (3.59)
  const { head, manifest } = placeShards();
  return <EntityPage type="place" rows={head} shards={manifest} lede="Every place we want to go, by country, region and area. Filter, sort, or switch to the table or the map." />;
}
