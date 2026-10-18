import { pinnedSlugs } from '@/lib/globe/data';
import { pageMetadata } from '@/lib/site';
import { titleFromSlug } from '@/components/shell/StubPage';

// /globe/place/<place-slug>: the globe flies in and opens the card. The place has its own indexed page, so this URL is noindex.
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  const slugs = pinnedSlugs('place').map((slug) => ({ slug }));
  // `output: export` refuses an empty list (the privacy fixture has no data), so one noindex placeholder keeps the build valid.
  return slugs.length ? slugs : [{ slug: 'stub' }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return pageMetadata({ title: `Globe: ${titleFromSlug(slug)}`, description: 'A place on the globe.', path: `/globe/place/${slug}/`, noindex: true });
}

export default function GlobePlacePage() {
  return null;
}
