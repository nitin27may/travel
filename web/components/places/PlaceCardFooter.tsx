import { Icon } from '@/components/ui/Icon';
import { sourceLabel } from '@/lib/entities/labels';
import type { PlaceListRow } from './rows';

const SOURCE_SHORT: Record<string, string> = { instagram: 'Instagram post', official: 'Official site' };

/** Card footer: where the facts came from, whether the numbers are checked, and the two ways on (Place page, Globe). */
export function PlaceCardFooter({ p }: { p: PlaceListRow }) {
  const first = p.sourceTypes[0];
  const researched = p.researched;
  return (
    <>
      <p className="src" title={first ? sourceLabel(first) : 'No source recorded'}>
        <Icon name={first ? 'link' : 'info'} size={13} />
        <span>{first ? (SOURCE_SHORT[first] ?? sourceLabel(first)) : researched && !p.honesty.some((h) => h.id === 'no_source') ? 'Researched' : 'No source yet'}</span>
        {p.sourceTypes.length > 1 ? <span className="num">+{p.sourceTypes.length - 1}</span> : null}
        {p.statsState && p.sourceTypes.length > 0 ? (
          <span className="verify" data-ok={p.statsState === 'verified' || undefined}>
            <Icon name={p.statsState === 'verified' ? 'check' : 'info'} size={12} />
            {p.statsState === 'verified' ? 'Verified' : 'Unverified'}
          </span>
        ) : null}
        <span className="pc-complete" data-level={p.completeness.level}>
          {p.completeness.label}
        </span>
      </p>
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
