import Link from 'next/link';
import { AboutData } from '@/components/home/AboutData';
import { CoverGlobe } from '@/components/home/CoverGlobe';
import { CoverSearch } from '@/components/home/CoverSearch';
import { countryPins, pickPlaces } from '@/components/home/pick';
import { HomePlaceCard, HomeTripCard } from '@/components/home/Strips';
import { Credits, type PhotoCredit } from '@/components/ui/Credits';
import { globeIndex, listPlaces, listTrips, type Photo } from '@/lib/public';
import { coverTree } from '@/lib/globe/data';
import { pageMetadata } from '@/lib/site';
import '@/styles/home.css';

export const metadata = pageMetadata({
  title: 'Trip Plans',
  description: 'Researched itineraries, trails, maps, timings and conditions, plus every place we want to go.',
  path: '/',
});

// the builder's flag, as build-time constants (next.config.ts): off, the link below is not in the page. Written here, not imported: the builder's files are fenced.
const PLAN_ON = process.env.NEXT_PUBLIC_PLAN_BUILDER === '1' && process.env.NEXT_PUBLIC_TRIP_EDIT === '1';

const credit = (p: Photo): PhotoCredit => ({ title: p.caption || p.file, author: p.author, licence: p.licence, licenceUrl: p.licenceUrl ?? undefined, sourceUrl: p.sourceUrl });

export default function Home() {
  const allTrips = listTrips();
  const trips = allTrips.slice(0, 6);
  const allPlaces = listPlaces();
  const places = pickPlaces(allPlaces, 8);
  const pins = countryPins(globeIndex());
  // the cover draws country discs from the tree alone (counts and a centre per country); no pins, no cards (backlog 2.39)
  const cover = { index: { continents: coverTree().continents, pins: [] }, cards: {} };
  const photos = [...trips.map((t) => t.cover), ...places.map((p) => p.photo)].filter((p): p is Photo => !!p);
  return (
    <div className="home">
      <section className="home-cover" aria-label="Where we have been and where we are going">
        <div className="home-cover-inner">
          <h1 className="home-title">Trip plans</h1>
          <CoverSearch />
          <p className="home-hint">
            {pins.length} countries · {allTrips.length} trips · {allPlaces.length} places. Pick a pin to open its country.
          </p>
        </div>
        {/* after the card in the source so a phone reads and tabs heading, search, then globe (backlog 4.15); desktop positions both absolutely */}
        <CoverGlobe data={cover} />
      </section>

      <div className="home-wrap">
        <section aria-labelledby="home-trips-h" className="home-strip">
          <div className="home-strip-head">
            <h2 id="home-trips-h" className="home-h2">Trips</h2>
            <Link href="/trips/">All {allTrips.length} trips &rarr;</Link>
          </div>
          {/* X8 (FLOW 9): one plain link into the builder, only with the planBuilder flag on (a build-time constant, so off it is not in the page) */}
          {PLAN_ON ? (
            <p className="home-hint">
              <Link href="/plan/">Plan your own trip &rarr;</Link>
            </p>
          ) : null}
          <ul className="home-cards">
            {trips.map((t, i) => (
              <li key={t.slug}>
                <HomeTripCard trip={t} priority={i === 0} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="home-places-h" className="home-strip">
          <div className="home-strip-head">
            <h2 id="home-places-h" className="home-h2">Places worth a trip</h2>
            <Link href="/places/">All {allPlaces.length} places &rarr;</Link>
          </div>
          <ul className="home-cards">
            {places.map((p) => (
              <li key={p.slug}>
                <HomePlaceCard place={p} />
              </li>
            ))}
          </ul>
        </section>

        <AboutData />
        <Credits photos={photos.map(credit)} />
      </div>
    </div>
  );
}
