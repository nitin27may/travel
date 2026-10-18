import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PlaceLinks, PlaceSections } from '@/components/entity/PlaceSections';
import { BadgeRow } from '@/components/ui/Badge';
import { EntityImage } from '@/components/ui/EntityImage';
import { kindIcon } from '@/components/ui/Icon';
import { loadPlaces } from '@/lib/data/places';
import { placeSegments } from '@/lib/data/paths';
import { placeBadges } from '@/lib/entities/descriptors/place';
import { sizedImage } from '@/lib/format/image';
import { pageMetadata } from '@/lib/site';

export const dynamicParams = false;

// The first segment is named `slug`, not `cc`, because /places/[slug] (the new public place route, lane L0) shares that
// position and Next allows one dynamic name per level. Lane L4 deletes this legacy four-segment route and redirects it.
type Params = { slug: string; region: string; area: string; place: string };

export function generateStaticParams(): Params[] {
  return loadPlaces().map((p) => {
    const [slug, region, area, place] = placeSegments(p.id);
    return { slug, region, area, place };
  });
}

function find(params: Params) {
  const id = [params.slug, params.region, params.area, params.place].map(decodeURIComponent).join('/');
  return loadPlaces().find((p) => p.id === id);
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const place = find(await params);
  if (!place) return {};
  const where = `${place.area_name}, ${place.region_name}, ${place.country_name}`;
  return pageMetadata({
    title: `${place.name}, ${place.region_name}`,
    description: place.note ? `${place.name} (${where}). ${place.note}`.slice(0, 200) : `${place.name} in ${where}.`,
    path: `/places/${placeSegments(place.id).join('/')}/`,
    image: place.image ? sizedImage(place.image, 1200) : null,
  });
}

export default async function PlacePage({ params }: { params: Promise<Params> }) {
  const place = find(await params);
  if (!place) notFound();
  const listHref = (q: string) => `/places/?${q}`;
  return (
    <article>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/places/">Places</Link>
        <span aria-hidden="true">/</span>
        <a href={listHref(`country=${place.country}`)}>{place.country_name}</a>
        <span aria-hidden="true">/</span>
        <a href={listHref(`country=${place.country}&region=${encodeURIComponent(place.region)}`)}>{place.region_name}</a>
        <span aria-hidden="true">/</span>
        <a href={listHref(`country=${place.country}&region=${encodeURIComponent(place.region)}&area=${encodeURIComponent(place.area)}`)}>{place.area_name}</a>
      </nav>
      <header className="place-hero">
        <div className="hero-img">
          <EntityImage src={place.image} width={1400} fallbackIcon={kindIcon(place.kind)} fallbackLabel={place.kind} />
        </div>
        <div className="stack">
          <h1 className="place-title">{place.name}</h1>
          <p className="card-sub">
            {place.area_name}, {place.region_name}, {place.country_name}
          </p>
          <BadgeRow badges={placeBadges(place)} />
          <div style={{ marginTop: '0.9rem' }}>
            <PlaceLinks p={place} />
          </div>
        </div>
      </header>
      <div className="place-cols">
        <div className="stack">
          {PlaceSections.slice(0, 2).map((s) => (
            <section key={s.title} className="sheet-section">
              <h2 className="place-h2">{s.title}</h2>
              {s.render(place)}
            </section>
          ))}
        </div>
        <div className="stack">
          {PlaceSections.slice(2).map((s) => (
            <section key={s.title} className="sheet-section">
              <h2 className="place-h2">{s.title}</h2>
              {s.render(place)}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
