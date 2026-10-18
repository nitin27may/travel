import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Globe',
  description: 'Every saved place and published trip on a globe. Spin it, fly into a country, a state or a district, and open a place or trip from its pin.',
  path: '/globe/',
});

// The globe itself is drawn by the layout; this page exists for its URL and metadata.
export default function GlobePage() {
  return null;
}
