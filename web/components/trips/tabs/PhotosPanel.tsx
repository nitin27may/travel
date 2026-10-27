import { LazyGallery } from '../LazyGallery';
import type { Photo } from '@/lib/public/types';
import { daysLabel, photoGroups, sectionsLabel, type PlanRow } from './photoGroups';

/** The flat photo list (one lightbox) and the section headings the Photos tab hands the gallery. Exported for tests. */
export function photoTabModel(photos: Photo[], rows: readonly PlanRow[]) {
  const groups = photoGroups(photos, rows);
  const named = groups.filter((g) => g.name).length;
  const heads = groups.length > 1 || !!groups[0]?.name;
  const flat = groups.flatMap((g) => g.photos.map((p) => ({ url: p.url, caption: p.caption, title: p.caption, author: p.author, licence: p.licence, licenceUrl: p.licenceUrl ?? undefined, sourceUrl: p.sourceUrl, section: g.name ?? undefined })));
  let at = 0;
  const sections = heads
    ? groups.map((g, i) => {
        const from = at;
        at += g.photos.length;
        return {
          from,
          heading: (
            <h3 id={`ph-g-${i}`} className="ph-group-h">
              <span className="ph-group-name">
                {g.name ? g.parts.map((part, k) => (part.slug ? <a key={k} href={`/places/${part.slug}/`}>{part.text}</a> : part.text)) : 'More photos'}
              </span>
              {g.days.length ? <span className="ph-group-meta num">{daysLabel(g.days)}</span> : null}
              {g.nearby ? <span className="ph-group-meta">Nearby, not in this plan</span> : null}
            </h3>
          ),
        };
      })
    : undefined;
  return { flat, sections, named };
}

/**
 * The Photos tab (spec 3.2, W8): the trip gallery by its own sections, each heading naming its places as links to their pages, with the day
 * signs the plan gives them (none when no row matches reliably) and "Nearby, not in this plan" for a section the plan never visits. Each tile
 * carries its credit line (author, licence) under it at rest, because a phone has no hover (UXB-N 8.2): the author truncates, the licence never
 * does. One lightbox runs over every photo, so the arrows walk the whole trip and the caption names the section. The grid is the existing
 * lazy chunk, so the tab adds nothing to the start bundle. Drawn only from 6 photos (Q307; the page decides).
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
  const { flat, sections, named } = photoTabModel(photos, rows);
  return (
    <section className="trip-sec" aria-labelledby="gallery-h">
      <h2 id="gallery-h" className="trip-h">Photos</h2>
      <p className="trip-sec-note" data-testid="ph-summary">
        {photos.length} photos{named ? ` in ${sectionsLabel(named)}` : ''}. Each credit is under its photo; the full list is at the foot of the page.
      </p>
      <LazyGallery creditAtRest photos={flat} sections={sections} />
    </section>
  );
}
