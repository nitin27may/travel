import Link from 'next/link';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({ title: 'Not found', description: 'That page does not exist on this site.', path: '/404/', noindex: true });

export default function NotFound() {
  return (
    <div className="prose">
      <h1 className="place-title">Not here</h1>
      <p>That page does not exist on this site. Try the trips or the places list.</p>
      <div className="hero-links">
        <Link className="btn btn-primary" href="/trips/">
          Trips
        </Link>
        <Link className="btn" href="/places/">
          Places
        </Link>
      </div>
    </div>
  );
}
