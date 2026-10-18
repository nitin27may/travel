import { Icon } from '@/components/ui/Icon';
import { sourceLabel } from '@/lib/entities/labels';
import type { PlaceListRow } from './rows';

const SOURCE_SHORT: Record<string, string> = { instagram: 'Instagram post', official: 'Official site' };

/** Card footer: where the facts came from, whether the numbers are checked, and the two ways on (Place page, Globe). */
export function PlaceCardFooter({ p }: { p: PlaceListRow }) {
  const first = p.sources[0];
  const hasStats = Object.keys(p.stats).length > 0;
  const researched = p.origins.some((o) => o !== 'locations');
  return (
    <>
      <p className="src" title={first ? sourceLabel(first.type) : 'No source recorded'}>
        <Icon name={first ? 'link' : 'info'} size={13} />
        <span>{first ? (SOURCE_SHORT[first.type] ?? sourceLabel(first.type)) : researched && !p.honesty.some((h) => h.id === 'no_source') ? 'Researched' : 'No source yet'}</span>
        {p.sources.length > 1 ? <span className="num">+{p.sources.length - 1}</span> : null}
        {hasStats && p.sources.length > 0 ? (
          <span className="verify" data-ok={p.stats_verified || undefined}>
            <Icon name={p.stats_verified ? 'check' : 'info'} size={12} />
            {p.stats_verified ? 'Verified' : 'Unverified'}
          </span>
        ) : null}
        <span className="pc-complete" data-level={p.completeness.level} title={p.completeness.tooltip}>
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
