import { EntityPage } from '@/components/entity/EntityPage';
import { loadListedTrips } from '@/lib/data/trips';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Trips',
  description: 'Researched itineraries with trails, maps, timings and conditions. Each plan keeps its own address.',
  path: '/trips/',
});

export default function TripsPage() {
  return <EntityPage type="trip" rows={loadListedTrips()} lede="Researched itineraries, each with its own address. Upcoming trips come first." />;
}
