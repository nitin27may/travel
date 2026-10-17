import Link from 'next/link';
import { pageMetadata } from '@/lib/site';

// Static export has no redirects: this page forwards to /places/ and web/redirects.json adds the
// 301 for hosts that read a _redirects file.
export const metadata = pageMetadata({ title: 'Places', description: 'The locations list now lives at /places/.', path: '/places/' });

export default function LocationsRedirect() {
  return (
    <>
      {/* React hoists this into <head>. The delay lets the script below keep a #hash or ?query first. */}
      <meta httpEquiv="refresh" content="1; url=/places/" />
      <div className="prose">
        <h1 className="place-title">Moved</h1>
        <p>
          The locations list is now <Link href="/places/">Places</Link>.
        </p>
        <script dangerouslySetInnerHTML={{ __html: `if(location.hash||location.search){location.replace('/places/'+location.search+location.hash)}else{location.replace('/places/')}` }} />
      </div>
    </>
  );
}
