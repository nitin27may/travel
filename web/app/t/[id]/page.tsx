import { notFound } from 'next/navigation';
import { TripShell } from '@/components/trips/edit/shell/TripShell';
import { capabilities } from '@/lib/capabilities';
import { TRIP_EDIT_ON } from '@/lib/trip-edit/flag';
import type { Metadata } from 'next';

// The person's own trip (STEP2-T1; step2 README 3). A private page: never indexed, never cached, never in the sitemap, no share image.
// Everything personal is read in the browser, so this server page knows nothing of the trip: not its title, its dates or whether the id
// exists (rule 9, EA13). The flag is read at build time; off, every address under /t/ answers 404 as it did before this page existed.
export const dynamic = 'force-dynamic';

// Written by hand, not through pageMetadata(): that adds a canonical address and a share image, and this page has neither (EA13).
export function generateMetadata(): Metadata {
  return { title: 'Your trip', description: 'A trip you copied, kept in this browser or your account.', robots: { index: false, follow: false } };
}

export default async function OwnTripPage({ params }: { params: Promise<{ id: string }> }) {
  if (!TRIP_EDIT_ON) notFound();
  const { id } = await params;
  return <TripShell id={id} signIn={capabilities.signIn} />;
}
