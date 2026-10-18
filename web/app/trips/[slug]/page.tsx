import { pageMetadata } from '@/lib/site';
import { StubPage, titleFromSlug } from '@/components/shell/StubPage';

// STUB (lane L0, handed to L3): the public trip page. L3 fills generateStaticParams from tripSlugs() (lane LD).
export const dynamicParams = false;
export const metadata = pageMetadata({ title: 'Trip', description: 'Public trip page (placeholder).', path: '/trips/stub/', noindex: true });

export function generateStaticParams(): { slug: string }[] {
  // `output: export` refuses an empty list, so one placeholder page (noindex, not in the sitemap) is built until the owning lane fills this.
  return [{ slug: 'stub' }];
}

export default async function TripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StubPage title={titleFromSlug(slug)} stub="trips/[slug]" />;
}
