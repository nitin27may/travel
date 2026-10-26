import { notFound, permanentRedirect } from 'next/navigation';
import { tripBookings } from '@travel/core/export/bookings.ts';
import { showTabBar, tripTabsFor, type TripTab } from '@travel/core/trips/tabs.ts';
import { ExportData } from '@/components/actions/ExportData';
import { Banner } from '@/components/ui/Banner';
import { SeasonBand } from '@/components/trips/SeasonBand';
import { TripCover } from '@/components/trips/TripCover';
import { TripEnd } from '@/components/trips/TripEnd';
import { TripPlan } from '@/components/trips/TripPlan';
import { BookingsPanel } from '@/components/trips/tabs/BookingsPanel';
import { prepaintScript } from '@/components/trips/tabs/prepaint';
import { OverviewTabs } from '@/components/trips/tabs/OverviewTabs';
import { PhotosPanel } from '@/components/trips/tabs/PhotosPanel';
import { highlightCards } from '@/components/trips/summary/highlights';
import { SummaryBottom, SummaryTop } from '@/components/trips/summary/Summary';
import { PHOTOS_TAB_MIN } from '@/components/trips/summary/text';
import { buildTripPageModel } from '@/components/trips/model';
import type { PlaceLookup } from '@/components/trips/model';
import { tripExportFor } from '@/lib/export/build.server';
import { getPlace, getTrip, listPlaces, tripSlugs } from '@/lib/public';
import { tripSummaryFor } from '@/lib/public/summary';
import { ogImageFor } from '@/lib/og';
import { currentSlugOf, retiredSlugs } from '@/lib/server/moved';
import { absoluteUrl, pageMetadata } from '@/lib/site';

export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  // `output: export` refuses an empty list (the privacy fixture has no trips), so one placeholder keeps the build valid
  const slugs = [...tripSlugs(), ...retiredSlugs('trips')];
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
    const now = currentSlugOf(slug, 'trips');
    if (now) permanentRedirect(`/trips/${now}/`);
    if (tripSlugs().length) notFound();
    return <p className="muted">No published trips in this build.</p>;
  }
  const overview = trip.depth === 'overview';
  const model = buildTripPageModel(trip, lookup, overview ? [] : listPlaces());
  const url = absoluteUrl(`/trips/${slug}/`);

  // the Summary and the tabs (spec 3.2, 3.5): one adapter, light facts, server-rendered
  const summary = { ...tripSummaryFor(trip, getPlace) };
  summary.counts = { ...summary.counts, photos: model.gallery.length };
  const bookings = tripBookings(Object.values(trip.categories).flat());
  const photosTab = model.gallery.length >= PHOTOS_TAB_MIN;
  const stops = Object.values(trip.categories).reduce((n, rows) => n + rows.length, 0);
  const available = tripTabsFor({ days: overview ? 0 : trip.days.length, stops, bookings: bookings.length, photos: photosTab ? model.gallery.length : 0 });
  const counts: Partial<Record<TripTab, number>> = { stops, bookings: bookings.length, photos: model.gallery.length };
  const highlights = highlightCards(trip, summary, getPlace);
  const galleryGroups = new Set(model.gallery.map((p) => p.group).filter(Boolean)).size;
  const link = { stops: available.includes('stops'), bookings: available.includes('bookings'), photos: available.includes('photos') };
  const top = <SummaryTop trip={trip} summary={summary} link={link} highlights={highlights} galleryGroups={galleryGroups} />;
  const bottom = <SummaryBottom trip={trip} summary={summary} bookings={bookings} />;
  const photosPanel = <PhotosPanel photos={model.gallery} />;
  const season = trip.season || !overview ? <SeasonBand trip={trip} /> : null;
  return (
    <article className="trip-page" data-depth={trip.depth}>
      <TripCover trip={trip} url={url} />
      {trip.isDone ? (
        <section className="trip-sec" aria-label="About this plan" data-print="hide">
          <Banner kind="notice">A finished plan, kept as a template. Copy it to plan your own dates.</Banner>
        </section>
      ) : null}
      {trip.depth === 'overview' ? (
        showTabBar(available) ? (
          <OverviewTabs
            slug={slug}
            available={available}
            counts={counts}
            summary={
              <>
                {top}
                {season}
              </>
            }
            photos={photosPanel}
          />
        ) : (
          <>
            {top}
            {season}
            {trip.season ? null : (
              // one notice, no "valid for" section: the stats card already says the season is not set (T1, review M6)
              <Banner kind="notice">Overview only. No days and no season are written down yet, so check the season yourself before you pick dates.</Banner>
            )}
          </>
        )
      ) : (
        <>
          {model.timeline && showTabBar(available) ? <script dangerouslySetInnerHTML={{ __html: prepaintScript(available) }} /> : null}
          <TripPlan slug={slug} model={model} title={trip.title} depth={trip.depth} season={season} tabs={{ available, counts }} slots={{ summaryTop: top, summaryBottom: bottom, bookings: <BookingsPanel bookings={bookings} />, photos: photosPanel }} />
        </>
      )}
      <TripEnd trip={trip} model={model} url={url} galleryInTab={available.includes('photos')} />
      <ExportData data={tripExportFor(slug)} />
    </article>
  );
}
