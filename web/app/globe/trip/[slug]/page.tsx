import { pageMetadata } from '@/lib/site';
import { StubPage, titleFromSlug } from '@/components/shell/StubPage';

// STUB (lane L0, handed to L2): /globe/trip/<trip-slug>, the globe fitted to one trip's route.
export const dynamicParams = false;
export const metadata = pageMetadata({ title: 'Globe trip', description: 'Globe fitted to one trip (placeholder).', path: '/globe/trip/stub/', noindex: true });

export function generateStaticParams(): { slug: string }[] {
  // `output: export` refuses an empty list, so one placeholder page (noindex, not in the sitemap) is built until the owning lane fills this.
  return [{ slug: 'stub' }];
}

export default async function GlobeTripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StubPage title={titleFromSlug(slug)} stub="globe/trip/[slug]" />;
}
