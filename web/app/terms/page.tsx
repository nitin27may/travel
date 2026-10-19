import Link from 'next/link';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Terms and copyright',
  description: 'What you can do with this site: read it, share a link, export one trip for your own travel. What you cannot: copy it in bulk, scrape it or train AI on it.',
  path: '/terms/',
});

/** Plain-words terms (backlog 2.37, P8: protect the catalogue). Short on purpose; not legal advice. */
export default function TermsPage() {
  return (
    <>
      <header className="page-head">
        <h1>Terms and copyright</h1>
        <p className="lede">What you are welcome to do here, and what you are not.</p>
      </header>
      <div className="prose">
        <h2>Welcome</h2>
        <ul>
          <li>Read the site and use it to plan your own travel.</li>
          <li>Share a link to any trip or place.</li>
          <li>Export one trip as a PDF, a calendar, a route file or a spreadsheet, and use it for your own trip.</li>
        </ul>

        <h2>Our own work</h2>
        <p>
          The text and research on this site are ours: the trip plans, the place write-ups, the notes and the way the information is organised.
          Please do not republish them or pass them off as yours.
        </p>

        <h2>Not allowed</h2>
        <ul>
          <li>Copying the site, or large parts of it, in bulk.</li>
          <li>Scraping it with a script or a crawler, beyond what a search engine does to index pages.</li>
          <li>Using the content to train an AI model or to build a dataset.</li>
        </ul>
        <p>If you want to do something this does not cover, ask first.</p>

        <h2>Map data and photographs</h2>
        <p>
          Map data comes from OpenStreetMap contributors and is available under the{' '}
          <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener noreferrer">
            Open Database Licence (ODbL)<span className="sr-only"> (opens in a new tab)</span>
          </a>
          . That licence covers the map data, not our write-ups.
        </p>
        <p>
          Photographs carry their own licences. Each one is credited where it appears, with its author and licence, and those terms stay with the
          photo. They are not covered by the permission above.
        </p>
        <p>
          The other sources we draw on, with their licences, are listed on <Link href="/about/data/">About the data</Link>.
        </p>

        <h2>No guarantees</h2>
        <p>
          Opening times, prices and conditions change, and we read them at one point in time. Check with the operator before you book or set out.
          The site is provided as it is, and you use a plan at your own risk.
        </p>
      </div>
    </>
  );
}
