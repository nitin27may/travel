import { StubPage } from '@/components/shell/StubPage';
import { pageMetadata } from '@/lib/site';

// STUB (lane L0, handed to L2): the full-screen globe at /globe.
export const metadata = pageMetadata({ title: 'Globe', description: 'Every place and published trip on a globe.', path: '/globe/' });

export default function GlobePage() {
  return <StubPage title="Globe" stub="globe" note="The full-screen globe arrives with its own page." />;
}
