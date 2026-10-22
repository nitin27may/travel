import { notFound } from 'next/navigation';
import { globePaths } from '@/lib/public';
import { pageMetadata } from '@/lib/site';
import { titleFromSlug } from '@/components/shell/StubPage';

// /globe/<country>[/<state>[/<district>]]. Every path with content is pre-rendered. Any other path of the same shape (a country code, then
// up to two slugs) is rendered on request: the globe shell comes from the layout and the client resolves the level from location.pathname,
// as a static host does through the /globe/* rewrite in web/redirects.json (which stays as it is). Anything else is a 404.
export const dynamicParams = true;

// Next matches a request path to a pre-rendered one without regard to case, and caches what it renders under that entry: /globe/CA/ontario/
// must therefore render the same page as /globe/ca/ontario/, never a 404 that would be cached over it. So the shape is tested in lower case.
const COUNTRY = /^[a-z]{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isLevel = (path: string[]): boolean => {
  const p = path.map((s) => s.toLowerCase());
  return p.length >= 1 && p.length <= 3 && COUNTRY.test(p[0]!) && p.slice(1).every((s) => SLUG.test(s));
};

export function generateStaticParams(): { path: string[] }[] {
  const paths = globePaths().map((path) => ({ path }));
  // `output: export` refuses an empty list (the privacy fixture has no data), so one noindex placeholder keeps the build valid.
  return paths.length ? paths : [{ path: ['stub'] }];
}

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (!isLevel(path) && path[0] !== 'stub') return { robots: { index: false, follow: false } };
  const where = path.map((s) => titleFromSlug(s.toLowerCase())).join(', ');
  return pageMetadata({
    title: `Globe: ${path.length === 1 ? path[0].toUpperCase() : where}`,
    description: `Saved places and published trips in ${where} on the globe.`,
    path: `/globe/${path.map((s) => s.toLowerCase()).join('/')}/`,
  });
}

export default async function GlobePathPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (!isLevel(path) && path[0] !== 'stub') notFound();
  return null;
}
