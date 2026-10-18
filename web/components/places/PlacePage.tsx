import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ExportFormat } from '@/components/actions/ExportMenu';
import { ExportMenuLazy as ExportMenu } from './ExportMenuLazy';
import { ShareButton } from '@/components/actions/ShareButton';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Chip } from '@/components/ui/Chip';
import { Credits } from '@/components/ui/Credits';
import { EntityImage } from '@/components/ui/EntityImage';
import { Icon, kindIcon } from '@/components/ui/Icon';
import { SeasonStrip } from '@/components/ui/SeasonStrip';
import { KID_LABELS } from '@/lib/entities/labels';
import { seasonLabel } from '@/lib/format/season';
import { appleMapsUrl, directionsUrl, formatPoint } from '@/lib/map/links';
import type { LngLat } from '@/lib/map/types';
import type { AccessPoint, Fact, PlaceLine as PlaceLineT, PublicPlace, PublicPlaceCard } from '@/lib/public/types';
import { GalleryLazy } from './GalleryLazy';
import { ElevationProfile } from './ElevationProfile';
import { LinksTabs } from './LinksTabs';
import type { PlaceMapPoint } from './PlaceMap';
import { PlaceMapLazy } from './PlaceMapLazy';
import { PlaceShell } from './PlaceShell';
import { SaveToTrip } from './SaveToTrip';
import { accessFacts, directionsTarget, publicProvenance, publicText, summaryOrKind, factByLabel, firstNumber, glanceFor, hutFacts, isUrl, lastRead, linkTabs, observed, phoneParts, pointAt, pointSourceInfo, routeLineInfo, seasonMonths } from './model';

/* ---------- small pieces ---------- */

/** Fact text: operator dates read "observed 2026", public business phone numbers are tel: links, a bare URL is a link. */
export function FactText({ text }: { text: string }) {
  if (isUrl(text)) {
    return (
      <a href={text} target="_blank" rel="noopener noreferrer">
        {text.replace(/^https?:\/\//, '').replace(/\/$/, '')}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <>
      {phoneParts(observed(publicProvenance(text))).map((p, i) =>
        p.tel ? (
          <a key={i} href={`tel:${p.tel}`} className="num">
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** "Operator" provenance as text, never a coloured dot: "PLAN.md, read Aug 2026, (operator)". */
const provenanceText = (s: string) => publicProvenance(s).replace(/,\s*\((official|operator|community|agent[^)]*)\)\s*$/i, ' · $1').replace(/\s+\(([^)]+)\)$/, ' · $1');

function Conflict({ fact }: { fact: Fact }) {
  if (!fact.conflicts.length) return null;
  return (
    <div className="pl-conflict">
      <Chip kind="caution" icon="warn">
        Sources disagree
      </Chip>
      <ul>
        <li>
          <FactText text={fact.value} />
          <span className="pl-prov">{provenanceText(fact.provenance)}</span>
        </li>
        {fact.conflicts.map((c, i) => (
          <li key={i}>
            <FactText text={c.value} />
            <span className="pl-prov">{provenanceText(c.provenance)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ id, title, children, className }: { id: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`pl-sec ${className ?? ''}`} aria-labelledby={`h-${id}`} id={id}>
      <h2 id={`h-${id}`}>{title}</h2>
      {children}
    </section>
  );
}

function Coordinates({ p }: { p: AccessPoint }) {
  return <span className="num pl-point">{formatPoint(pointAt(p))}</span>;
}

function MapLinks({ at, label }: { at: LngLat; label: string }) {
  return (
    <span className="pl-maplinks">
      <a className="btn btn-sm" href={`https://www.google.com/maps/search/?api=1&query=${formatPoint(at)}`} target="_blank" rel="noopener noreferrer">
        Google Maps<span className="sr-only"> for {label} (opens in a new tab)</span>
      </a>
      <a className="btn btn-sm" href={directionsUrl(at)} target="_blank" rel="noopener noreferrer">
        Directions<span className="sr-only"> to {label} (opens in a new tab)</span>
      </a>
      <a className="btn btn-sm" href={appleMapsUrl(at, label)} target="_blank" rel="noopener noreferrer">
        Apple Maps<span className="sr-only"> for {label} (opens in a new tab)</span>
      </a>
    </span>
  );
}

function PointSource({ p }: { p: AccessPoint }) {
  const info = pointSourceInfo(p);
  const [head, ...rest] = info.text.split(' · ');
  return (
    <span className="pl-prov">
      {info.url ? (
        <a href={info.url} target="_blank" rel="noopener noreferrer">
          {head}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        head
      )}
      {rest.length ? ` · ${rest.join(' · ')}` : ''}
    </span>
  );
}

function RouteLine({ lines, confirmed }: { lines: PlaceLineT[]; confirmed: boolean }) {
  const info = routeLineInfo(lines, confirmed);
  if (!info) return <p className="muted small">No route line is stored for this place yet.</p>;
  return (
    <p className="muted small">
      {info.text}
      {info.refs.length ? ' Records: ' : ''}
      {info.refs.map((r, i) => (
        <span key={r.url}>
          {i ? ', ' : ''}
          <a href={r.url} target="_blank" rel="noopener noreferrer">
            {r.label}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </span>
      ))}
    </p>
  );
}

function AccessCard({ p, role, unconfirmed }: { p: AccessPoint; role: 'Trailhead' | 'Parking'; unconfirmed: boolean }) {
  return (
    <article className="pl-access" data-role={role.toLowerCase()}>
      <header>
        <Icon name={role === 'Parking' ? 'parking' : 'pin'} size={16} />
        <h3>{p.name}</h3>
        <Chip kind="kind" icon={false}>
          {role}
        </Chip>
        {unconfirmed || !p.pointChecked ? (
          <Chip kind="honest" icon="warn" title="A person has not checked this pin yet">
            {unconfirmed ? 'Location unconfirmed' : 'Pin not checked yet'}
          </Chip>
        ) : null}
      </header>
      {publicText(p.note) ? <p className="pl-access-note">{observed(publicText(p.note))}</p> : null}
      <dl className="pl-kv pl-kv-stack">
        {p.elevationM !== null ? (
          <div>
            <dt>Elevation</dt>
            <dd className="num">{p.elevationM.toLocaleString('en-CA')} m</dd>
          </div>
        ) : null}
        {p.fee ? (
          <div>
            <dt>Fee</dt>
            <dd>
              <FactText text={p.fee} />
            </dd>
          </div>
        ) : null}
        {p.capacity ? (
          <div>
            <dt>Capacity</dt>
            <dd>
              <FactText text={p.capacity} />
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Point</dt>
          <dd>
            <Coordinates p={p} /> <PointSource p={p} />
          </dd>
        </div>
      </dl>
      <MapLinks at={pointAt(p)} label={p.name} />
    </article>
  );
}

/* ---------- the page ---------- */

export interface PlacePageProps {
  place: PublicPlace;
  /** Other places in the same district (for an area: "the places inside it"). */
  inside: PublicPlaceCard[];
  /** The absolute address, for Share. */
  url: string;
}

const timeText = (v: string): string => (/\b(h|hours?|min|minutes?)\b/i.test(v) ? v : `${v} h`);

const COUNTRY_PATH = (p: PublicPlace) => p.areaChain.find((a) => a.level === 'country');

export function PlacePage({ place, inside, url }: PlacePageProps) {
  const trail = place.kind === 'trail';
  const country = COUNTRY_PATH(place);
  const state = place.areaChain.find((a) => a.level === 'state');
  const district = place.areaChain.find((a) => a.level === 'district');
  const kicker = [place.kindLabel, district?.name, state?.name].filter(Boolean).join(' · ');
  const crumbs = [
    { label: 'Places', href: '/places/' },
    ...(country ? [{ label: country.name, href: `/places/?country=${country.slug.toUpperCase()}` }] : []),
    ...(state && country ? [{ label: state.name, href: `/places/?country=${country.slug.toUpperCase()}&region=${state.slug}` }] : []),
    { label: place.name },
  ];

  const km = place.stats.distanceKm ?? firstNumber(factByLabel(place.facts, 'Distance')?.value);
  const gain = place.stats.gainM ?? firstNumber(factByLabel(place.facts, 'Climb', 'Descent')?.value);
  const shape = factByLabel(place.facts, 'Shape')?.value.toLowerCase() ?? '';
  const th = place.access?.trailhead ?? null;
  const dest = place.point ? { lat: place.point.lat, lng: place.point.lon } : null;
  const thAt = th ? pointAt(th) : null;
  const loop = /loop|lake/.test(shape) || place.kind === 'lake';
  const startM = th?.elevationM ?? place.elevationM ?? 1500;
  const showProfile = trail && km !== null && km > 0 && gain !== null;
  const guide = thAt && dest && !loop && Math.hypot(thAt.lat - dest.lat, thAt.lng - dest.lng) > 0.001 ? { from: thAt, to: dest } : null;

  const target = directionsTarget(place);
  const unconfirmed = place.honesty.some((h) => h.id === 'location_unconfirmed');
  const points: PlaceMapPoint[] = [
    ...(th ? [{ id: 'trailhead', at: pointAt(th), style: 'trailhead' as const, label: th.name }] : []),
    ...(place.access?.parking ?? []).map((p, i) => ({ id: `parking-${i}`, at: pointAt(p), style: 'parking' as const, label: p.name })),
    ...(dest ? [{ id: 'place', at: dest, style: 'place' as const, label: place.name }] : []),
  ];
  // a point shared by two roles draws once
  const seen = new Set<string>();
  const unique = points.filter((p) => {
    const k = `${p.style}:${p.at.lat.toFixed(5)},${p.at.lng.toFixed(5)}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });

  const hasAccess = !['area', 'town'].includes(place.kind) || Boolean(place.access && (place.access.trailhead || place.access.parking.length));
  const glance = glanceFor(place);
  const huts = hutFacts(place.facts);
  const access = accessFacts(place.facts).filter((f, i, all) => all.findIndex((g) => g.label === f.label && g.value === f.value) === i);
  const shownLabels = new Set([...glance.filter((g) => g.fact).map((g) => g.fact?.label), ...(showProfile ? huts.map((h) => h.label) : [])]);
  const accessLabels = new Set(access.map((f) => f.label));
  const seenFacts = new Set<string>();
  const rest = place.facts.filter((f) => {
    if (shownLabels.has(f.label) || accessLabels.has(f.label)) return false;
    const key = `${f.label}|${f.value}`;
    return seenFacts.has(key) ? false : (seenFacts.add(key), true);
  });
  const formats: ExportFormat[] = place.lines.length ? (place.lines.every((l) => l.exportable) ? ['gpx', 'kml'] : ['gpx']) : ['gpx'];
  const checked = lastRead(place.facts);
  const tabs = linkTabs(place.links, place.linksNone);
  const photos = place.photos.length ? place.photos : place.photo ? [place.photo] : [];
  const credits = photos.map((p) => ({ title: p.caption || p.file, author: p.author, licence: p.licence, licenceUrl: p.licenceUrl ?? undefined, sourceUrl: p.sourceUrl }));
  const suits: string[] = [];
  if (place.kidFit !== 'unknown') suits.push(KID_LABELS[place.kidFit] ?? place.kidFit);
  if (place.minAge) suits.push(`${place.minAge}+ years`);

  return (
    <PlaceShell>
      <article className="pl-page" data-kind={place.kind} data-slug={place.slug}>
        <Breadcrumbs items={crumbs} className="pl-crumbs" />
        <header className="pl-cover" data-trail={trail || undefined}>
          <div className="pl-cover-media">
            {photos[0] ? (
              <EntityImage src={photos[0].url} width={1600} fallbackIcon={kindIcon(place.kind)} />
            ) : (
              <span className="pl-cover-glyph" aria-hidden="true">
                <Icon name={kindIcon(place.kind)} size={120} />
              </span>
            )}
          </div>
          <div className="pl-cover-body">
            <p className="pl-kicker">{kicker}</p>
            <h1>{place.name}</h1>
            <p className="pl-summary">{summaryOrKind(place.summary, place.kindLabel, place.areaLabel)}</p>
            <div className="pl-actions">
              <SaveToTrip url={url} slug={place.slug} formats={['gpx']} />
              <ExportMenu target={{ type: 'place', slug: place.slug }} formats={formats} />
              <ShareButton url={url} title={place.name} />
              {place.point ? (
                <Link className="btn" href={`/globe/place/${place.slug}/`}>
                  <Icon name="globe" size={15} /> Globe
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        <section className="pl-glance" aria-label="At a glance">
          <ul>
            {glance.map((g) => (
              <li key={g.label} data-empty={!g.fact || undefined}>
                <span className="pl-glance-label">{g.label}</span>
                {g.fact ? (
                  <>
                    <strong className="pl-glance-value">
                      <FactText text={g.fact.value} />
                    </strong>
                    <span className="pl-prov">{provenanceText(g.fact.provenance)}</span>
                    {g.fact.conflicts.length ? (
                      <Chip kind="caution" icon="warn" title="Other sources give other values; see Facts and sources">
                        {g.fact.conflicts.length + 1} values
                      </Chip>
                    ) : null}
                  </>
                ) : (
                  <span className="pl-glance-empty">{g.empty}</span>
                )}
              </li>
            ))}
          </ul>
          {place.honesty.length ? (
            <ul className="pl-honesty" aria-label="Data notes">
              {place.honesty.map((h) => (
                <li key={h.id}>
                  <Chip kind="honest" icon="warn" title={h.reason}>
                    {h.label}
                  </Chip>
                </li>
              ))}
              <li>
                <span className="pl-complete" data-level={place.completeness.level} title={place.completeness.tooltip}>
                  {place.completeness.label}
                </span>
              </li>
            </ul>
          ) : (
            <p className="pl-honesty">
              <span className="pl-complete" data-level={place.completeness.level} title={place.completeness.tooltip}>
                {place.completeness.label}
              </span>
            </p>
          )}
        </section>

        {trail && place.hazards.length ? (
          <section className="pl-hazards pl-hazards-top" aria-labelledby="h-hazards-top">
            <h2 id="h-hazards-top">
              <Icon name="warn" size={16} /> Hazards
            </h2>
            <ul>
              {place.hazards.map((h) => (
                <li key={h}>{observed(publicText(h) || h)}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="pl-cols">
          <div className="pl-main">
            {showProfile ? (
              <Section id="route" title="The route">
                <p className="pl-route-line num">
                  {[km !== null ? `${km} km` : null, gain !== null ? `${gain} m ${factByLabel(place.facts, 'Climb') ? 'climb' : 'change'}` : null, factByLabel(place.facts, 'Time') ? timeText(factByLabel(place.facts, 'Time')?.value ?? '') : null].filter(Boolean).join(' · ')}
                </p>
                <ElevationProfile km={km as number} gainM={gain as number} startM={startM} loop={loop} highM={firstNumber(factByLabel(place.facts, 'High point')?.value)} guide={guide} />
                {huts.length ? (
                  <ul className="pl-huts" aria-label="Huts and refuges">
                    {huts.map((h) => (
                      <li key={h.label}>
                        <strong>{h.label}</strong>
                        <span>
                          <FactText text={h.value} />
                        </span>
                        <span className="pl-prov">{provenanceText(h.provenance)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <RouteLine lines={place.lines} confirmed={!unconfirmed && Boolean(place.access?.trailhead?.pointChecked)} />
              </Section>
            ) : null}

            {hasAccess ? (
            <Section id="access" title="Trailhead and parking">
              {place.access && (place.access.trailhead || place.access.parking.length) ? (
                <div className="pl-access-list">
                  {place.access.trailhead ? <AccessCard p={place.access.trailhead} role="Trailhead" unconfirmed={unconfirmed} /> : null}
                  {place.access.parking.map((p, i) => (
                    <AccessCard key={`${p.name}-${i}`} p={p} role="Parking" unconfirmed={false} />
                  ))}
                </div>
              ) : (
                <p className="pl-gap">
                  <Icon name="info" size={14} /> No trailhead or parking recorded yet.
                </p>
              )}
              {access.length ? (
                <dl className="pl-kv pl-kv-wide">
                  {access.map((f, i) => (
                    <div key={`${f.label}-${i}`}>
                      <dt>{f.label}</dt>
                      <dd>
                        <FactText text={f.value} />
                        <span className="pl-prov">{provenanceText(f.provenance)}</span>
                        <Conflict fact={f} />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {place.booking ? (
                <aside className="pl-callout" aria-label="Booking window">
                  <Icon name="ticket" size={16} />
                  <p>
                    <strong>Booking window.</strong> <FactText text={place.booking} />
                  </p>
                </aside>
              ) : null}
            </Section>
            ) : null}

            <Section id="when" title="When to go">
              {place.season.length ? (
                <>
                  <SeasonStrip months={seasonMonths(place.season)} />
                  <p className="pl-season num">{seasonLabel(place.season)}</p>
                </>
              ) : (
                <p className="pl-gap">
                  <Icon name="info" size={14} /> No season recorded yet.
                </p>
              )}
              {publicText(place.seasonNote) ? <p>{observed(publicText(place.seasonNote))}</p> : null}
            </Section>

            <Section id="suits" title="Who it suits">
              {suits.length ? (
                <ul className="pl-fit" aria-label="Who it suits">
                  {suits.map((s) => (
                    <li key={s}>
                      <Chip kind="neutral" icon="user">
                        {s}
                      </Chip>
                    </li>
                  ))}
                  {place.honesty.some((h) => h.id === 'unverified') ? (
                    <li>
                      <Chip kind="honest" icon="warn">
                        Unverified
                      </Chip>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="pl-gap">
                  <Icon name="info" size={14} /> Kid fit has not been assessed yet.
                </p>
              )}
              {factByLabel(place.facts, 'Kids') ? (
                <p>
                  <FactText text={factByLabel(place.facts, 'Kids')?.value ?? ''} />
                </p>
              ) : null}
            </Section>

            {place.kind === 'area' || inside.length ? (
              <Section id="inside" title={place.kind === 'area' ? `Places in ${place.name}` : `Also in ${district?.name ?? 'this area'}`}>
                {inside.length ? (
                  <ul className="pl-inside">
                    {inside.map((c) => (
                      <li key={c.slug}>
                        <Icon name={kindIcon(c.kind)} size={16} />
                        <Link href={`/places/${c.slug}/`}>{c.name}</Link>
                        <span className="muted">{c.kindLabel}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="pl-gap">
                    <Icon name="info" size={14} /> No other places are recorded here yet.
                  </p>
                )}
              </Section>
            ) : null}

            <Section id="facts" title="Facts and sources">
              {rest.length ? (
                <dl className="pl-kv pl-kv-wide">
                  {rest.map((f, i) => (
                    <div key={`${f.label}-${i}`}>
                      <dt>{f.label}</dt>
                      <dd>
                        <FactText text={f.value} />
                        <span className="pl-prov">{provenanceText(f.provenance)}</span>
                        <Conflict fact={f} />
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="pl-gap">
                  <Icon name="info" size={14} /> No further facts recorded yet.
                </p>
              )}
              {publicText(place.notes) && publicText(place.notes) !== publicText(place.summary) ? <p className="pl-notes">{observed(publicText(place.notes))}</p> : null}
              {place.honesty.length ? (
                <ul className="pl-reasons">
                  {place.honesty.map((h) => (
                    <li key={h.id}>
                      <strong>{h.label}.</strong> {h.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              {place.completeness.failed.length ? (
                <details className="pl-missing">
                  <summary>
                    {place.completeness.label}: {place.completeness.failed.length} checks missing
                  </summary>
                  <p className="muted small">{place.completeness.tooltip}.</p>
                  <ul>
                    {place.completeness.failed.map((c) => (
                      <li key={c.id}>
                        <strong>{c.label}.</strong> {c.hint}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </Section>

            {photos.length ? (
              <Section id="photos" title="Photos">
                <GalleryLazy photos={photos.map((p) => ({ url: p.url, caption: p.caption, title: p.caption || p.file, author: p.author, licence: p.licence, licenceUrl: p.licenceUrl ?? undefined, sourceUrl: p.sourceUrl }))} />
                <Credits photos={credits} />
              </Section>
            ) : (
              <p className="pl-gap pl-nophotos">
                <Icon name="info" size={14} /> No licensed photo yet, so none is shown.
              </p>
            )}
          </div>

          <aside className="pl-side" aria-label="Map, directions and links">
            <section className="pl-card pl-mapcard" aria-labelledby="h-map">
              <h2 id="h-map" className="sr-only">
                Map
              </h2>
              {unique.length ? (
                <PlaceMapLazy name={place.name} points={unique} guide={guide} selectedId={target ? (target.source === 'parking' ? 'parking-0' : target.source === 'trailhead' ? 'trailhead' : 'place') : undefined} />
              ) : (
                <p className="pl-gap">
                  <Icon name="info" size={14} /> No point is stored for this place yet, so there is no map.
                </p>
              )}
            </section>

            <section className="pl-card" aria-labelledby="h-dir">
              <h2 id="h-dir">Directions</h2>
              {target ? (
                <>
                  <p className="small">
                    To <strong>{target.label}</strong>
                    {target.source === 'parking' ? ', the car park we stored' : target.source === 'trailhead' ? ', the trailhead we stored' : ', the pin we stored'}. <span className="num">{formatPoint(target.at)}</span>
                  </p>
                  {unconfirmed ? (
                    <p>
                      <Chip kind="honest" icon="warn" title="A person must confirm this location">
                        Location unconfirmed
                      </Chip>
                    </p>
                  ) : null}
                  <p className="pl-dir-links">
                    <a className="btn btn-primary" href={directionsUrl(target.at)} target="_blank" rel="noopener noreferrer">
                      <Icon name="navigate" size={14} /> Google Maps directions<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                    <a className="btn" href={appleMapsUrl(target.at, target.label)} target="_blank" rel="noopener noreferrer">
                      Apple Maps<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </p>
                  {target.source === 'parking' && th ? <p className="muted small">The trail starts at {th.name}, on foot from the car park.</p> : null}
                </>
              ) : (
                <p className="pl-gap">
                  <Icon name="info" size={14} /> No point is stored yet, so there are no directions.
                </p>
              )}
            </section>

            {!trail ? (
              <section className={place.hazards.length ? 'pl-hazards' : 'pl-card'} aria-labelledby="h-hazards">
                <h2 id="h-hazards">
                  {place.hazards.length ? <Icon name="warn" size={16} /> : null} Hazards
                </h2>
                {place.hazards.length ? (
                  <ul>
                    {place.hazards.map((h) => (
                      <li key={h}>{observed(h)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">No hazards recorded yet.</p>
                )}
              </section>
            ) : null}

            <section className="pl-card" aria-labelledby="h-links">
              <h2 id="h-links">Links</h2>
              <LinksTabs tabs={tabs} checked={checked} />
            </section>

            {place.trips.length ? (
              <section className="pl-card" aria-labelledby="h-trips">
                <h2 id="h-trips">Used in</h2>
                <ul className="pl-trips">
                  {place.trips.map((t) => (
                    <li key={t.slug}>
                      <Link href={`/trips/${t.slug}/`}>{t.title}</Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
        {place.wikidata ? (
          <p className="muted small pl-foot">
            Wikidata{' '}
            <a href={`https://www.wikidata.org/wiki/${place.wikidata}`} target="_blank" rel="noopener noreferrer">
              {place.wikidata}
            </a>
          </p>
        ) : null}
      </article>
    </PlaceShell>
  );
}
