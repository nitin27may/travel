import { Credits } from '@/components/ui/Credits';
import { LazyGallery } from './LazyGallery';
import type { PublicTrip } from '@/lib/public/types';
import type { TripPageModel } from './model';
import { TripActions } from './TripActions';

/** Copy and export again, the gallery, credits and attribution (patterns 3.4 step 5). */
export function TripEnd({ trip, model, url }: { trip: PublicTrip; model: TripPageModel; url: string }) {
  return (
    <>
      <section className="trip-sec trip-end" aria-labelledby="end-h">
        <h2 id="end-h" className="trip-h">Take this plan with you</h2>
        <p className="trip-sec-note">{trip.isDone ? 'Use it as a template for your own dates, or export' : 'Copy it to plan your own dates, or export'} it as a PDF, a calendar, a route file or a spreadsheet.</p>
        <TripActions slug={trip.slug} title={trip.title} nights={trip.nights ?? 0} days={trip.daysCount ?? 0} url={url} hasDays={trip.depth !== 'overview'} seasonMonths={trip.season?.months} done={trip.isDone} />
      </section>
      {model.gallery.length ? (
        <section className="trip-sec" aria-labelledby="gallery-h">
          <h2 id="gallery-h" className="trip-h">Photos</h2>
          <LazyGallery photos={model.gallery.map((p) => ({ url: p.url, caption: p.caption, title: p.caption, author: p.author, licence: p.licence, licenceUrl: p.licenceUrl ?? undefined, sourceUrl: p.sourceUrl }))} />
        </section>
      ) : null}
      <Credits photos={model.credits} />
      <p className="trip-attribution">
        Maps: <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>, data &copy;{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors, relief by{' '}
        <a href="https://mapterhorn.com" target="_blank" rel="noopener noreferrer">Mapterhorn</a>. Photos from Wikimedia Commons, credited above. Plan researched and written by Nitin from the sources named on each place page.
      </p>
    </>
  );
}
