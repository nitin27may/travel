import { notFound, permanentRedirect } from 'next/navigation';
import { bookingCounts, tripBookings } from '@travel/core/export/bookings.ts';
import { showTabBar, tripTabsFor, type TripTab } from '@travel/core/trips/tabs.ts';
import { ExportData } from '@/components/actions/ExportData';
import { PrintParks } from '@/components/actions/PrintParks';
import { Banner } from '@/components/ui/Banner';
import { TripCover } from '@/components/trips/TripCover';
import { TripEnd } from '@/components/trips/TripEnd';
import { TripPlan } from '@/components/trips/TripPlan';
import { BookingsPanel } from '@/components/trips/tabs/BookingsPanel';
import { prepaintScript } from '@/components/trips/tabs/prepaint';
import { OverviewTabs } from '@/components/trips/tabs/OverviewTabs';
import { PhotosPanel } from '@/components/trips/tabs/PhotosPanel';
import { highlightCards } from '@/components/trips/summary/highlights';
import { shapeFactsFor } from '@/components/trips/summary/shapeData';
import { SummaryBottom, SummaryTop } from '@/components/trips/summary/Summary';
import { WhenToGo } from '@/components/trips/summary/WhenToGo';
import { PHOTOS_TAB_MIN } from '@/components/trips/summary/text';
import { buildTripPageModel } from '@/components/trips/model';
import type { PlaceLookup } from '@/components/trips/model';
import { tripExportFor } from '@/lib/export/build.server';
import { getPlace, getTrip, listPlaces, tripSlugs } from '@/lib/public';
import { tripSummaryFor } from '@/lib/public/summary';
import { tripWeatherFor } from '@/lib/public/weatherLinks';
import { tripWindowsFor } from '@/lib/public/windows';
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
  // the Bookings tab's number is the one its heading says, "N to book ahead" (`bookingCounts`), never the row count: a check is listed, not counted
  const toBook = bookingCounts(bookings).toBook;
  const counts: Partial<Record<TripTab, number>> = { stops, ...(toBook > 0 ? { bookings: toBook } : {}), photos: model.gallery.length };
  const rows = Object.values(trip.categories).flat();
  const placeSlugs = Object.fromEntries(bookings.flatMap((b) => { const s = rows.find((r) => r.key === b.ref)?.placeSlug; return s && getPlace(s) ? [[b.ref, s]] : []; }));
  const highlights = highlightCards(trip, summary, getPlace);
  const galleryGroups = new Set(model.gallery.map((p) => p.group).filter(Boolean)).size;
  const link = { stops: available.includes('stops'), bookings: available.includes('bookings'), photos: available.includes('photos') };
  const top = <SummaryTop trip={trip} summary={summary} link={link} highlights={highlights} galleryGroups={galleryGroups} />;
  const bottom = <SummaryBottom trip={trip} summary={summary} bookings={bookings} parkPages={(trip.parks ?? []).flatMap((p) => (p.slug && getPlace(p.slug) ? [p.slug] : []))} />;
  const photosPanel = <PhotosPanel photos={model.gallery} rows={rows.map((r) => ({ name: r.name, placeSlug: r.placeSlug && getPlace(r.placeSlug) ? r.placeSlug : null, days: r.days }))} />;
  const season = trip.season || !overview ? <WhenToGo season={trip.season} weather={tripWeatherFor(slug)} windows={tripWindowsFor(slug)} /> : null;
  return (
    <article className="trip-page" data-depth={trip.depth}>
      <TripCover trip={trip} url={url} />
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
          <TripPlan slug={slug} model={model} title={trip.title} depth={trip.depth} season={season} tabs={{ available, counts }} slots={{ summaryTop: top, summaryBottom: bottom, bookings: <BookingsPanel bookings={bookings} placeSlugs={placeSlugs} />, photos: photosPanel }} shape={shapeFactsFor(trip, getPlace)} />
        </>
      )}
      <TripEnd trip={trip} model={model} url={url} galleryInTab={available.includes('photos')} />
      <ExportData data={tripExportFor(slug)} />
      <PrintParks slug={slug} lines={(trip.parks ?? []).map((p) => p.line)} />
    </article>
  );
}
