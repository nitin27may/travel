import { notFound } from 'next/navigation';
import '@/components/places/families';
import { summaryOrKind } from '@/components/places/model';
import { PlacePage } from '@/components/places/PlacePage';
import { getPlace, listPlaces, placeSlugs } from '@/lib/public';
import { absoluteUrl, pageMetadata } from '@/lib/site';
import '@/styles/places.css';

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
  return <PlacePage place={place} inside={inside} url={absoluteUrl(`/places/${slug}/`)} />;
}
