import Link from 'next/link';
import { TripCard } from '@/components/shell/TripCard';
import { loadPlaces } from '@/lib/data/places';
import { loadListedTrips } from '@/lib/data/trips';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Trip Plans',
  description: 'Researched itineraries, trails, maps, timings and conditions, plus every place we want to go.',
  path: '/',
});

export default function Home() {
  const trips = loadListedTrips();
  const upcoming = trips.filter((t) => t.when !== 'past');
  const past = trips.filter((t) => t.when === 'past').reverse();
  const places = loadPlaces();
  const countries = new Set(places.map((p) => p.country)).size;
  return (
    <>
      <section className="hero">
        <h1>Trip plans</h1>
        <p className="lede">Researched itineraries with trails, maps, timings and conditions. Each plan keeps its own address.</p>
        <div className="hero-links">
          <Link className="btn btn-primary" href="/places/">
            Browse {places.length} places in {countries} countries
          </Link>
          <a className="btn" href="/globe/">
            Explore the globe
          </a>
          <Link className="btn" href="/trips/">
            All trips
          </Link>
        </div>
      </section>

      {upcoming.length ? (
        <section aria-labelledby="upcoming">
          <div className="section-head">
            <h2 id="upcoming">Upcoming</h2>
            <Link href="/trips/">All trips</Link>
          </div>
          <ul className="trip-card-grid">
            {upcoming.map((t) => (
              <li key={t.id}>
                <TripCard trip={t} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {past.length ? (
        <section aria-labelledby="past">
          <div className="section-head">
            <h2 id="past">Past trips</h2>
          </div>
          <ul className="trip-card-grid">
            {past.map((t) => (
              <li key={t.id}>
                <TripCard trip={t} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
