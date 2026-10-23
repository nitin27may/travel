import { Icon } from '@/components/ui/Icon';
import type { PlaceListRow } from './rows';

/**
 * Card footer: whether the facts are researched, whether the numbers are checked, how complete the page is, and the two ways on (Place page, Globe).
 * It never says where the owner saved a place from: that is private wishlist data (PRIV1). A place with nothing to say here gets no status line at all.
 */
export function PlaceCardFooter({ p }: { p: PlaceListRow }) {
  const noSource = p.honesty.some((h) => h.id === 'no_source');
  const origin = p.researched && !noSource ? 'Researched' : noSource ? 'No details available' : null;
  const showComplete = p.completeness.level !== 'draft';
  const hasStatus = origin !== null || p.statsState !== null || showComplete;
  const parts: React.ReactNode[] = [];
  if (origin) {
    parts.push(
      <span key="origin" className="src-origin">
        <Icon name={origin === 'Researched' ? 'link' : 'info'} size={13} />
        <span>{origin}</span>
      </span>,
    );
  }
  if (p.statsState) {
    parts.push(
      <span key="verify" className="verify" data-ok={p.statsState === 'verified' || undefined}>
        <Icon name={p.statsState === 'verified' ? 'check' : 'info'} size={12} />
        {p.statsState === 'verified' ? 'Verified' : 'Unverified'}
      </span>,
    );
  }
  /* a place with only the basics has no badge: "Draft" is the workshop's word, not the visitor's */
  if (showComplete) {
    parts.push(
      <span key="complete" className="pc-complete" data-level={p.completeness.level}>
        {p.completeness.label}
      </span>,
    );
  }
  return (
    <>
      {hasStatus ? (
        <p className="src">
          {parts.flatMap((x, i) => (i === 0 ? [x] : [<span key={`sep${i}`} className="foot-sep" aria-hidden="true"> · </span>, x]))}
        </p>
      ) : null}
      <p className="card-links">
        <a href={`/places/${p.slug}/`}>
          Place page<span className="sr-only">: {p.name}</span>
        </a>
        {p.lat !== null ? (
          <a href={`/globe/place/${p.slug}/`}>
            Globe<span className="sr-only">: {p.name}</span>
          </a>
        ) : null}
      </p>
    </>
  );
}
