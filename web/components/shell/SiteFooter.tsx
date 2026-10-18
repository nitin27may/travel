import Link from 'next/link';
import { UnitSwitch } from './UnitSwitch';

/** About the data, the credits note and the unit switch (build brief L0, step 5). Photo credits sit on each page that shows photos. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>
          <Link href="/about/data/">About the data</Link>. Maps and photographs are credited where they appear: OpenStreetMap contributors, OpenFreeMap, Mapterhorn and Wikimedia Commons authors.
        </p>
        <UnitSwitch />
      </div>
    </footer>
  );
}
