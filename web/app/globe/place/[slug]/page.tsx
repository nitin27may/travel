import { pageMetadata } from '@/lib/site';
import { StubPage, titleFromSlug } from '@/components/shell/StubPage';

// STUB (lane L0, handed to L2): /globe/place/<place-slug>, the globe flying in to one place.
export const dynamicParams = false;
export const metadata = pageMetadata({ title: 'Globe place', description: 'Globe at one place (placeholder).', path: '/globe/place/stub/', noindex: true });

export function generateStaticParams(): { slug: string }[] {
  // `output: export` refuses an empty list, so one placeholder page (noindex, not in the sitemap) is built until the owning lane fills this.
  return [{ slug: 'stub' }];
}

export default async function GlobePlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StubPage title={titleFromSlug(slug)} stub="globe/place/[slug]" />;
}
