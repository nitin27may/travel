import Link from 'next/link';
import { ReportAboutItem } from '@/components/shell/ReportLink';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'About',
  description: 'What this site is, where its data comes from, and what you may do with it.',
  path: '/about/',
});

export default function AboutPage() {
  return (
    <>
      <header className="page-head">
        <h1>About</h1>
        <p className="lede">Researched trip plans and a growing list of places, with the source of every fact kept.</p>
      </header>
      <div className="prose">
        <p>
          Each trip is a Day 1 to Day N plan with the season it is valid for, so you can copy it and pick your own dates. Each place has its
          own page with a map, timings and conditions, and says plainly when a fact has not been checked yet.
        </p>
        <ul>
          <li>
            <Link href="/about/data/">About the data</Link>: where the maps, places, photographs and weather come from, and the licence for each.
          </li>
          <li>
            <Link href="/terms/">Terms and copyright</Link>: what you are welcome to do with the site, and what you are not.
          </li>
          <ReportAboutItem />
        </ul>
      </div>
    </>
  );
}
