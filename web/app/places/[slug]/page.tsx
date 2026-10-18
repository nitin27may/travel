import { pageMetadata } from '@/lib/site';
import { StubPage, titleFromSlug } from '@/components/shell/StubPage';

// STUB (lane L0, handed to L4): the public place and trail page. L4 fills generateStaticParams from placeSlugs() (lane LD).
export const dynamicParams = false;
export const metadata = pageMetadata({ title: 'Place', description: 'Public place page (placeholder).', path: '/places/stub/', noindex: true });

export function generateStaticParams(): { slug: string }[] {
  // `output: export` refuses an empty list, so one placeholder page (noindex, not in the sitemap) is built until the owning lane fills this.
  return [{ slug: 'stub' }];
}

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StubPage title={titleFromSlug(slug)} stub="places/[slug]" />;
}
