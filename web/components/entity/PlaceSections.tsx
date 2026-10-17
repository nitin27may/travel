import { Icon } from '@/components/ui/Icon';
import { globeHref, mapsHref, placeHref } from '@/lib/data/paths';
import type { PlaceRow } from '@/lib/data/types';
import { KID_LABELS, STATUS_LABELS, cap, sourceLabel } from '@/lib/entities/labels';
import type { DetailSection } from '@/lib/entities/types';
import { seasonLabel } from '@/lib/format/season';
import { Elevation, Stats } from './cells';

function Facts({ p }: { p: PlaceRow }) {
  return (
    <dl className="facts">
      <div>
        <dt>Kind</dt>
        <dd>{cap(p.kind)}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>{STATUS_LABELS[p.status] ?? cap(p.status)}</dd>
      </div>
      <div>
        <dt>Best months</dt>
        <dd>{seasonLabel(p.season) || 'Not recorded yet'}</dd>
      </div>
      <div>
        <dt>Kids</dt>
        <dd>{KID_LABELS[p.kid_fit] ?? p.kid_fit}</dd>
      </div>
      {p.elevation_m !== null ? (
        <div>
          <dt>Elevation</dt>
          <dd>
            <Elevation m={p.elevation_m} />
          </dd>
        </div>
      ) : null}
      {Object.keys(p.stats).length ? (
        <div>
          <dt>{p.stats_verified ? 'Trail stats' : 'Trail stats (as posted, unverified)'}</dt>
          <dd>
            <Stats stats={p.stats} />
          </dd>
        </div>
      ) : null}
      {p.lat !== null && p.lon !== null ? (
        <div>
          <dt>Coordinates</dt>
          <dd className="num">
            {p.lat.toFixed(4)}, {p.lon.toFixed(4)}
            {p.location_status !== 'resolved' ? ' (unconfirmed)' : ''}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

export function SourceList({ p }: { p: PlaceRow }) {
  if (!p.sources.length && !p.wikidata) return <p className="muted">No source recorded yet.</p>;
  return (
    <ul className="source-list">
      {p.sources.map((s, i) => (
        <li key={`${s.type}-${i}`}>
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {sourceLabel(s.type)} <Icon name="external" size={12} />
            </a>
          ) : (
            <span>{sourceLabel(s.type)}</span>
          )}
          {s.post_date ? <span className="muted"> posted {s.post_date}</span> : null}
        </li>
      ))}
      {p.wikidata ? (
        <li>
          <a href={`https://www.wikidata.org/wiki/${p.wikidata}`} target="_blank" rel="noopener noreferrer">
            Wikidata {p.wikidata} <Icon name="external" size={12} />
          </a>
        </li>
      ) : null}
    </ul>
  );
}

function Plans({ p }: { p: PlaceRow }) {
  if (!p.plans) return <p className="muted">Not part of a trip plan yet.</p>;
  return (
    <p>
      Part of {p.plans} {p.plans === 1 ? 'plan' : 'plans'}
      {p.trip_url && p.trip_title ? (
        <>
          : <a href={p.trip_url}>{p.trip_title}</a>
        </>
      ) : null}
      .
    </p>
  );
}

export function PlaceLinks({ p, primary }: { p: PlaceRow; primary?: boolean }) {
  const globe = globeHref(p);
  return (
    <div className="link-row">
      {primary ? (
        <a className="btn btn-primary" href={placeHref(p.id)}>
          Open place page <Icon name="arrow" size={14} />
        </a>
      ) : null}
      {globe ? (
        <a className="btn" href={globe}>
          <Icon name="globe" size={14} /> Globe
        </a>
      ) : null}
      <a className="btn" href={mapsHref(p)} target="_blank" rel="noopener noreferrer">
        <Icon name="pin" size={14} /> Map <span className="sr-only">(opens in a new tab)</span>
      </a>
      {p.trip_url ? (
        <a className="btn" href={p.trip_url}>
          <Icon name="calendar" size={14} /> Trip plan
        </a>
      ) : null}
    </div>
  );
}

export const PlaceSections: DetailSection<PlaceRow>[] = [
  { title: 'About', render: (p) => (p.note ? <p className="prose-note">{p.note}</p> : <p className="muted">No notes yet.</p>) },
  { title: 'Key facts', render: (p) => <Facts p={p} /> },
  { title: 'Sources', render: (p) => <SourceList p={p} /> },
  { title: 'Plans', render: (p) => <Plans p={p} /> },
];

const SOURCE_SHORT: Record<string, string> = { instagram: 'Instagram post', official: 'Official site' };

/** Card footer: where the data came from, whether its numbers are checked, and onward links. */
export function PlaceCardFooter({ p }: { p: PlaceRow }) {
  const first = p.sources[0];
  const hasStats = Object.keys(p.stats).length > 0;
  const globe = globeHref(p);
  return (
    <>
      <p className="src" title={first ? sourceLabel(first.type) : 'No source recorded'}>
        <Icon name={first ? 'link' : 'info'} size={13} />
        <span>{first ? (SOURCE_SHORT[first.type] ?? sourceLabel(first.type)) : 'No source yet'}</span>
        {p.sources.length > 1 ? <span className="num">+{p.sources.length - 1}</span> : null}
        {hasStats ? (
          <span className="verify" data-ok={p.stats_verified || undefined}>
            <Icon name={p.stats_verified ? 'check' : 'info'} size={12} />
            {p.stats_verified ? 'Verified' : 'Unverified'}
          </span>
        ) : null}
      </p>
      <p className="card-links">
        <a href={placeHref(p.id)}>
          Place page<span className="sr-only">: {p.name}</span>
        </a>
        {globe ? (
          <a href={globe}>
            Globe<span className="sr-only">: {p.name}</span>
          </a>
        ) : null}
      </p>
    </>
  );
}
