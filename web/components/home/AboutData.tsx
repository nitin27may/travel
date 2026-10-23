import Link from 'next/link';
import { Chip } from '@/components/ui/Chip';
import type { HonestyId } from '@/lib/public';

/** Each honesty marker once, with what it means (components 2.8). Order matches the adapter's. */
const MARKERS: { id: HonestyId; label: string; means: string }[] = [
  { id: 'location_unconfirmed', label: 'Location unconfirmed', means: 'The pin is approximate; nobody has stood there yet.' },
  { id: 'unverified', label: 'Unverified', means: 'A fact we read in one place and have not checked.' },
  { id: 'no_source', label: 'No details available', means: 'We have no details for this place yet.' },
  { id: 'condensed', label: 'Condensed from the full plan', means: 'The days are a short list of stops, not the whole plan.' },
  { id: 'overview_only', label: 'Overview only', means: 'No day-by-day plan yet; the page has the cover, season and photos.' },
  { id: 'drive_estimated', label: 'Drive time estimated', means: 'A straight line scaled to the road, shown with a tilde.' },
  { id: 'pattern_2026', label: '2026 data used as a pattern', means: 'A past trip used as the template for a future year.' },
];

export function AboutData() {
  return (
    <section className="home-about" aria-labelledby="home-about-h">
      <h2 id="home-about-h" className="home-h2">About the data</h2>
      <p className="home-about-lede">
        Places come from OpenStreetMap, Wikidata and official park and operator pages; towns and cities come from GeoNames (CC BY 4.0), shown as GeoNames has them;
        photographs come from Wikimedia Commons and carry their author and licence. Every fact keeps where it was read. Where we are unsure, the page says so with a dashed marker
        instead of guessing, and each place carries a badge for how many of its checks pass: Draft, Usable or Complete.{' '}
        <Link href="/about/data/">Sources and licences</Link>
      </p>
      <ul className="home-markers">
        {MARKERS.map((m) => (
          <li key={m.id}>
            <Chip kind="honest">{m.label}</Chip>
            <span>{m.means}</span>
          </li>
        ))}
        <li>
          <Chip kind="neutral">Usable · 7 of 11</Chip>
          <span>The completeness badge: checks that pass out of the checks we can track so far.</span>
        </li>
      </ul>
    </section>
  );
}
