import Link from 'next/link';
import { ReportLink } from './ReportLink';
import { UnitSwitch } from './UnitSwitch';

/** About the data, the credits note and the unit switch (build brief L0, step 5). Photo credits sit on each page that shows photos. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>
          <Link href="/about/data/">About the data</Link> · <Link href="/terms/">Terms and copyright</Link> · <Link href="/privacy/">Privacy</Link>
          <ReportLink joiner />. Credits: OpenStreetMap, OpenFreeMap, Mapterhorn, Wikimedia Commons.
        </p>
        <UnitSwitch />
      </div>
    </footer>
  );
}
