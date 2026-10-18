import { pinnedSlugs } from '@/lib/globe/data';
import { pageMetadata } from '@/lib/site';
import { titleFromSlug } from '@/components/shell/StubPage';

// /globe/trip/<trip-slug>: the globe fits the trip and opens its card. The trip has its own indexed page, so this URL is noindex.
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  const slugs = pinnedSlugs('trip').map((slug) => ({ slug }));
  // `output: export` refuses an empty list (the privacy fixture has no data), so one noindex placeholder keeps the build valid.
  return slugs.length ? slugs : [{ slug: 'stub' }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return pageMetadata({ title: `Globe: ${titleFromSlug(slug)}`, description: 'A trip on the globe.', path: `/globe/trip/${slug}/`, noindex: true });
}

export default function GlobeTripPage() {
  return null;
}
