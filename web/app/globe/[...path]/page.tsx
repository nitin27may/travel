import { globePaths } from '@/lib/public';
import { pageMetadata } from '@/lib/site';
import { titleFromSlug } from '@/components/shell/StubPage';

// /globe/<country>[/<state>[/<district>]]. Every path with content is pre-rendered; any other path reaches the globe
// through the /globe/* rewrite in web/redirects.json and is read client-side from location.pathname.
export const dynamicParams = false;

export function generateStaticParams(): { path: string[] }[] {
  const paths = globePaths().map((path) => ({ path }));
  // `output: export` refuses an empty list (the privacy fixture has no data), so one noindex placeholder keeps the build valid.
  return paths.length ? paths : [{ path: ['stub'] }];
}

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const where = path.map((s) => titleFromSlug(s)).join(', ');
  return pageMetadata({
    title: `Globe: ${path.length === 1 ? path[0].toUpperCase() : where}`,
    description: `Saved places and published trips in ${where} on the globe.`,
    path: `/globe/${path.join('/')}/`,
  });
}

export default function GlobePathPage() {
  return null;
}
