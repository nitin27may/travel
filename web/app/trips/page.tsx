import { EntityPage } from '@/components/entity/EntityPage';
import { Credits } from '@/components/ui/Credits';
import { listTrips } from '@/lib/public';
import { pageMetadata } from '@/lib/site';
import { tripListRows } from './rows';

export const metadata = pageMetadata({
  title: 'Trips',
  description: 'Researched itineraries as Day 1 to Day N plans, with the season each one is valid for. Copy one and pick your own dates.',
  path: '/trips/',
});

export default function TripsPage() {
  const cards = listTrips();
  const rows = tripListRows(cards);
  const covers = cards.flatMap((c) => (c.cover ? [{ title: c.title, author: c.cover.author, licence: c.cover.licence, licenceUrl: c.cover.licenceUrl ?? undefined, sourceUrl: c.cover.sourceUrl }] : []));
  return (
    <>
      <EntityPage type="trip" rows={rows} lede="Researched itineraries, each with its own address. Every plan runs Day 1 to Day N with the season it is valid for; copy one and pick your own dates." />
      <Credits photos={covers} className="trips-credits" />
    </>
  );
}
