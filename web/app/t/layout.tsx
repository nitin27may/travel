import type { ReactNode } from 'react';
import '@/styles/trips.css';

// The person's own trip uses the published plan's cover, tabs and day cards, so it loads the same stylesheets as /trips/.
export default function OwnTripLayout({ children }: { children: ReactNode }) {
  return children;
}
