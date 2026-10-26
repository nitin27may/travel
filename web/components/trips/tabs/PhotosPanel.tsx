import { LazyGallery } from '../LazyGallery';
import type { Photo } from '@/lib/public/types';

/** The Photos tab (spec 3.2): the trip gallery, moved from the foot of the page. The grid and its lightbox are the existing lazy chunk; UXB-6 adds the section grouping and the credit line under each tile. */
export function PhotosPanel({ photos }: { photos: Photo[] }) {
  const places = new Set(photos.map((p) => p.group).filter(Boolean)).size;
  return (
    <section className="trip-sec" aria-labelledby="gallery-h">
      <h2 id="gallery-h" className="trip-h">Photos</h2>
      <p className="trip-sec-note">
        {photos.length} photos{places ? ` · ${places} places` : ''}. Credits are listed at the foot of the page.
      </p>
      <LazyGallery photos={photos.map((p) => ({ url: p.url, caption: p.caption, title: p.caption, author: p.author, licence: p.licence, licenceUrl: p.licenceUrl ?? undefined, sourceUrl: p.sourceUrl }))} />
    </section>
  );
}
