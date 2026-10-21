import { notFound } from 'next/navigation';
import { ExportData } from '@/components/actions/ExportData';
import { Banner } from '@/components/ui/Banner';
import { SeasonBand } from '@/components/trips/SeasonBand';
import { TripCover } from '@/components/trips/TripCover';
import { TripEnd } from '@/components/trips/TripEnd';
import { TripPlan } from '@/components/trips/TripPlan';
import { buildTripPageModel } from '@/components/trips/model';
import type { PlaceLookup } from '@/components/trips/model';
import { tripExportFor } from '@/lib/export/build.server';
import { getPlace, getTrip, listPlaces, tripSlugs } from '@/lib/public';
import { ogImageFor } from '@/lib/og';
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
  return pageMetadata({ title: trip.title, description: trip.subtitle, path: `/trips/${slug}/`, image: ogImageFor('trips', slug) });
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
  const model = buildTripPageModel(trip, lookup, trip.depth === 'overview' ? [] : listPlaces());
  const url = absoluteUrl(`/trips/${slug}/`);
  return (
    <article className="trip-page" data-depth={trip.depth}>
      <TripCover trip={trip} url={url} />
      {trip.isDone ? (
        <section className="trip-sec" aria-label="About this plan" data-print="hide">
          <Banner kind="notice">A finished plan, kept as a template. Copy it to plan your own dates.</Banner>
        </section>
      ) : null}
      {trip.depth === 'overview' ? (
        <section className="trip-sec" aria-label="About this plan">
          {trip.season ? (
            <>
              <SeasonBand trip={trip} />
              <Banner kind="notice">This plan has not been converted to days yet. Only the overview is here so far.</Banner>
            </>
          ) : (
            // one notice, no "valid for" section: the stats card already says the season is not set (T1, review M6)
            <Banner kind="notice">Overview only. No days and no season are written down yet, so check the season yourself before you pick dates.</Banner>
          )}
        </section>
      ) : (
        // "Plan it for" comes first, then the season band (Q7): the plan component draws the band where it belongs
        <TripPlan slug={slug} model={model} title={trip.title} depth={trip.depth} season={<SeasonBand trip={trip} />} />
      )}
      <TripEnd trip={trip} model={model} url={url} />
      <ExportData data={tripExportFor(slug)} />
    </article>
  );
}
