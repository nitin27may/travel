import { notFound } from 'next/navigation';
import { ExportData } from '@/components/actions/ExportData';
import '@/components/places/families';
import { summaryOrKind } from '@/components/places/model';
import { PlacePage } from '@/components/places/PlacePage';
import { placeExportFor } from '@/lib/export/build.server';
import { getPlace, listPlaces, placeSlugs } from '@/lib/public';
import { normName } from '@/lib/public/places';
import { ogImageFor } from '@/lib/og';
import { absoluteUrl, pageMetadata } from '@/lib/site';
import '@/styles/places.css';
import '@/styles/suitability.css';

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return placeSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = getPlace(slug);
  if (!place) return {};
  return pageMetadata({
    title: place.name,
    description: summaryOrKind(place.summary, place.kindLabel, place.areaLabel) || `${place.kindLabel} in ${place.areaLabel}.`,
    path: `/places/${slug}/`,
    image: ogImageFor('places', slug),
  });
}

export default async function PlaceRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = getPlace(slug);
  if (!place) notFound();
  const district = place.areaChain.find((a) => a.level === 'district');
  const state = place.areaChain.find((a) => a.level === 'state');
  const inside = listPlaces()
    .filter((c) => c.slug !== place.slug && c.areaChain.find((a) => a.level === 'state')?.slug === state?.slug && c.areaChain.find((a) => a.level === 'district')?.slug === district?.slug && c.areaChain[0]?.slug === place.areaChain[0]?.slug)
    .slice(0, 24);
  // the place a trail reaches links to its page when exactly one other place carries that name
  const reaches = place.kind === 'trail' ? place.facts.find((f) => f.label === 'Payoff')?.value : undefined;
  const named = reaches ? listPlaces().filter((c) => c.slug !== place.slug && normName(c.name) === normName(reaches)) : [];
  // named in words when the trail's name already says it ("Bourgeau Lake" to Bourgeau Lake) or the place has no page of its own
  const payoff = reaches && normName(reaches) !== normName(place.name) ? { name: reaches, slug: named.length === 1 ? named[0].slug : null } : null;
  return (
    <>
      <PlacePage place={place} inside={inside} url={absoluteUrl(`/places/${slug}/`)} payoff={payoff} />
      <ExportData data={placeExportFor(slug)} />
    </>
  );
}
