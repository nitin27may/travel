import { cx } from './cx';

export interface PhotoCredit {
  /** Title of the file or the caption, whichever names it. */
  title?: string;
  author: string;
  licence: string;
  licenceUrl?: string;
  sourceUrl?: string;
}

/** Photo credits footer: title · author · licence, each linked where a URL exists. Every screen that shows a photo renders it (plan 2.5). */
export function Credits({ photos, className }: { photos: PhotoCredit[]; className?: string }) {
  const seen = new Set<string>();
  const unique = photos.filter((p) => {
    const key = `${p.title}|${p.author}|${p.licence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!unique.length) return null;
  return (
    <footer className={cx('credits', className)} aria-label="Photo credits">
      <p className="credits-head">Photos</p>
      <ul>
        {unique.map((p, i) => (
          <li key={`${p.title}-${i}`}>
            {p.title ? p.sourceUrl ? <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">{p.title}</a> : p.title : null}
            {p.title ? ' · ' : null}
            {p.author} &middot;{' '}
            {p.licenceUrl ? (
              <a href={p.licenceUrl} target="_blank" rel="noopener noreferrer">
                {p.licence}
              </a>
            ) : (
              p.licence
            )}
          </li>
        ))}
      </ul>
    </footer>
  );
}
