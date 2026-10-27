import { LazyGallery } from '../LazyGallery';
import type { Photo } from '@/lib/public/types';
import { daysLabel, photoGroups, type PlanRow } from './photoGroups';

/**
 * The Photos tab (spec 3.2, W8): the trip gallery by its own sections, each heading with its day signs and a link to its place page when the
 * plan has one, "Nearby, not in this plan" for a section the plan never visits. Each tile carries its credit line (author, licence) under it at
 * rest, because a phone has no hover (UXB-N 8.2); the title, author and licence link are in the lightbox and in the Credits at the foot of the
 * page. The grid is the existing lazy chunk, so the tab adds nothing to the start bundle. Drawn only from 6 photos (Q307; the page decides).
 */
export function PhotosPanel({ photos, rows = [] }: { photos: Photo[]; rows?: readonly PlanRow[] }) {
  if (photos.length === 0) {
    return (
      <section className="trip-sec" aria-labelledby="gallery-h">
        <h2 id="gallery-h" className="trip-h">Photos</h2>
        <p className="trip-sec-note">No licensed photos for this trip yet.</p>
      </section>
    );
  }
  const groups = photoGroups(photos, rows);
  const named = groups.filter((g) => g.name).length;
  const heads = groups.length > 1 || groups[0]?.name;
  return (
    <section className="trip-sec" aria-labelledby="gallery-h">
      <h2 id="gallery-h" className="trip-h">Photos</h2>
      <p className="trip-sec-note" data-testid="ph-summary">
        {photos.length} photos{named ? ` · ${named} ${named === 1 ? 'place' : 'places'}` : ''}. Each credit is under its photo; the full list is at the foot of the page.
      </p>
      {groups.map((g, i) => (
        <section key={g.name ?? `none-${i}`} className="ph-group" aria-labelledby={heads ? `ph-g-${i}` : undefined}>
          {heads ? (
            <h3 id={`ph-g-${i}`} className="ph-group-h">
              {g.placeSlug ? <a href={`/places/${g.placeSlug}/`}>{g.name}</a> : (g.name ?? 'More photos')}
              {g.days.length ? <span className="ph-group-meta num">{daysLabel(g.days)}</span> : null}
              {g.nearby ? <span className="ph-group-meta">Nearby, not in this plan</span> : null}
            </h3>
          ) : null}
          <LazyGallery
            creditAtRest
            photos={g.photos.map((p) => ({ url: p.url, caption: p.caption, title: p.caption, author: p.author, licence: p.licence, licenceUrl: p.licenceUrl ?? undefined, sourceUrl: p.sourceUrl }))}
          />
        </section>
      ))}
    </section>
  );
}
