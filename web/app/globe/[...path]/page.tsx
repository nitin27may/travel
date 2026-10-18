import { pageMetadata } from '@/lib/site';
import { StubPage, titleFromSlug } from '@/components/shell/StubPage';

// STUB (lane L0, handed to L2): /globe/<country>[/<state>[/<district>]]. L2 fills generateStaticParams from globePaths() (lane LD).
export const dynamicParams = false;
export const metadata = pageMetadata({ title: 'Globe', description: 'Globe by country, state and district (placeholder).', path: '/globe/stub/', noindex: true });

export function generateStaticParams(): { path: string[] }[] {
  // `output: export` refuses an empty list, so one placeholder page (noindex, not in the sitemap) is built until the owning lane fills this.
  return [{ path: ['stub'] }];
}

export default async function GlobePathPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return <StubPage title={titleFromSlug(path.join('/'))} stub="globe/[...path]" />;
}
