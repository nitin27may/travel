import { notFound } from 'next/navigation';
import { Banner } from '@/components/ui/Banner';
import { SeasonBand } from '@/components/trips/SeasonBand';
import { TripCover } from '@/components/trips/TripCover';
import { TripEnd } from '@/components/trips/TripEnd';
import { TripPlan } from '@/components/trips/TripPlan';
import { buildTripPageModel } from '@/components/trips/model';
import type { PlaceLookup } from '@/components/trips/model';
import { getPlace, getTrip, tripSlugs } from '@/lib/public';
import { absoluteUrl, pageMetadata } from '@/lib/site';

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  // `output: export` refuses an empty list (the privacy fixture has no trips), so one placeholder keeps the build valid
  const slugs = tripSlugs();
  return (slugs.length ? slugs : ['none']).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = getTrip(slug);
  if (!trip) return { robots: { index: false, follow: false } };
  return pageMetadata({ title: trip.title, description: trip.subtitle, path: `/trips/${slug}/`, image: trip.cover?.url });
}

const lookup: PlaceLookup = (slug) => {
  const p = getPlace(slug);
  return p ? { point: p.point ? { lat: p.point.lat, lon: p.point.lon } : null, photo: p.photo } : null;
};

export default async function TripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = getTrip(slug);
  if (!trip) {
    if (tripSlugs().length) notFound();
    return <p className="muted">No published trips in this build.</p>;
  }
  const model = buildTripPageModel(trip, lookup);
  const url = absoluteUrl(`/trips/${slug}/`);
  return (
    <article className="trip-page" data-depth={trip.depth}>
      <TripCover trip={trip} url={url} />
      <SeasonBand trip={trip} />
      {trip.depth === 'overview' ? (
        <section className="trip-sec" aria-label="About this plan">
          <Banner kind="notice" action={<a className="btn btn-sm" href={trip.legacyUrl}>Read the full plan</a>}>
            This plan has not been converted to days yet. Read the full plan.
          </Banner>
        </section>
      ) : (
        <TripPlan model={model} title={trip.title} depth={trip.depth} legacyUrl={trip.legacyUrl} />
      )}
      <TripEnd trip={trip} model={model} url={url} />
    </article>
  );
}
