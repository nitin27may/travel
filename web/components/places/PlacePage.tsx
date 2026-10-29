import Link from 'next/link';
import type { ReactNode } from 'react';
import { ageLabel } from '@/lib/format/age';
import { ShareButton } from '@/components/actions/ShareButton';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Chip } from '@/components/ui/Chip';
import { Credits } from '@/components/ui/Credits';
import { EntityImage } from '@/components/ui/EntityImage';
import { Icon, kindIcon } from '@/components/ui/Icon';
import { SeasonStrip } from '@/components/ui/SeasonStrip';
import { KID_LABELS } from '@/lib/entities/labels';
import { seasonLabel } from '@/lib/format/season';
import { allTrailsLink, appleMapsUrl, directionsUrl, formatPoint, osmElementUrl, osmPointUrl, searchUrl } from '@/lib/map/links';
import { addressClipboard, addressLine } from '@/lib/public/address';
import type { LngLat } from '@/lib/map/types';
import type { AccessPoint, Fact, PlaceLine as PlaceLineT, PublicPlace, PublicPlaceCard } from '@/lib/public/types';
import { Interactions } from '@/components/suit/Interactions';
import { accessCard, factText, factsDl } from './sections/legacyHtml';
import { withUnits } from '@/components/suit/html';
import { CoverRelevance } from './sections/Relevance';
import './cover.css';
import { Glance, Sections, type LegacySlots } from './sections/Sections';
import { SectionIndex } from './sections/SectionIndex';
import { GalleryLazy } from './GalleryLazy';
import { LinksTabs } from './LinksTabs';
import { dedupeMapPoints } from './mapPoints';
import type { PlaceMapPoint } from './PlaceMap';
import { PlaceShell } from './PlaceShell';
import { CopyAddress } from './CopyAddress';
import { DirectionsChooser, SaveToTrip } from './SaveToTrip';
import { TRIP_EDIT_ON } from '@/lib/trip-edit/flag';
import { tripPickerProps } from './tripPickerProps';
import { TrailExport } from './TrailExport';
import { TrailMap } from './TrailMap';
import { TrailProfile } from './TrailProfile';
import { accessFacts, directionsTarget, publicProvenance, publicText, summaryOrKind, factByLabel, firstNumber, glanceFor, hutFacts, isUrl, lastRead, leanTabs, linkTabs, observed, phoneParts, pointAt, pointSourceInfo, routeLineInfo, seasonMonths } from './model';

/* ---------- small pieces ---------- */

/** Fact text: operator dates read "observed 2026", public business phone numbers are tel: links, a bare URL is a link. */
export function FactText({ text }: { text: string }) {
  return <span dangerouslySetInnerHTML={{ __html: factText(text) }} />;
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
      <a className="btn btn-sm" href={searchUrl(label, at)} target="_blank" rel="noopener noreferrer">
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

function PointSource({ p }: { p: Pick<AccessPoint, 'pointSource' | 'pointChecked'> }) {
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
  const stored = lines.find((l) => l.exportable && (l.geometry?.length ?? 0) > 1);
  if (!info) return <p className="muted small">No route line is stored for this place yet.</p>;
  return (
    <p className="muted small">
      {stored ? info.text.replace(/; (?:not yet )?confirmed by a person\.$/, '; it starts at our trailhead and matches the researched length.') : info.text}
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

const LINK_ONLY_TEXT = /\b(?:alltrails|komoot|tripadvisor)\b/i;

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
            <dd className="num"><data className="um" value={String(p.elevationM)}>{p.elevationM.toLocaleString('en-CA')} m</data></dd>
          </div>
        ) : null}
        {p.fee && !LINK_ONLY_TEXT.test(p.fee) ? (
          <div>
            <dt>Fee</dt>
            <dd>
              <FactText text={p.fee} />
            </dd>
          </div>
        ) : null}
        {p.capacity && !LINK_ONLY_TEXT.test(p.capacity) ? (
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
  /** The place a trail reaches, when it has a page of its own ("To Sentinel Pass"). */
  payoff?: { name: string; slug: string | null } | null;
}

const timeText = (v: string): string => (/\b(h|hours?|min|minutes?)\b/i.test(v) ? v : `${v} h`);

/** "4 h 30–5 h 30", "5-6 h", "45–90 min" as a [low, high] pair in minutes, or null when the words are not a duration. */
export function minutesRange(text: string): [number, number] | null {
  const parts = text.replace(/\s+/g, ' ').trim().split(/\s*[–-]\s*/);
  if (parts.length > 2) return null;
  const unit = /\bmin/i.test(parts[parts.length - 1]!) && !/\bh\b|hours?/i.test(parts[parts.length - 1]!) ? 'min' : 'h';
  const one = (t: string): number | null => {
    const m = /^(\d+(?:\.\d+)?)\s*(h|hours?|min|minutes?)?(?:\s*(\d+)\s*(?:min)?)?$/i.exec(t.trim());
    if (!m) return null;
    const u = m[2] ? (/^h/i.test(m[2]) ? 'h' : 'min') : unit;
    return Math.round(Number(m[1]) * (u === 'h' ? 60 : 1) + (m[3] ? Number(m[3]) : 0));
  };
  const a = one(parts[0]!);
  const b = parts[1] === undefined ? a : one(parts[1]);
  return a === null || b === null ? null : [a, b];
}
const sameRange = (a: [number, number] | null, b: [number, number] | null): boolean => !!a && !!b && a[0] === b[0] && a[1] === b[1];

const COUNTRY_PATH = (p: PublicPlace) => p.areaChain.find((a) => a.level === 'country');

export function PlacePage({ place, inside, url, payoff = null }: PlacePageProps) {
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
  const storedProfile = place.lines.some((l) => l.profile);
  const showProfile = trail && ((km !== null && km > 0 && gain !== null) || storedProfile);
  const guide = thAt && dest && !loop && Math.hypot(thAt.lat - dest.lat, thAt.lng - dest.lng) > 0.001 ? { from: thAt, to: dest } : null;

  // PS4, T5: with no car park of our own, Directions go to the access place the contract found, and only a car park or a start counts. A place
  // reached by a shuttle stop alone gets no driving Directions: a car sent to a stop ends on a road closed to private cars.
  const dirs = place.sections?.directions ?? null;
  const hasCarPark = !!place.access?.parking.length;
  const via = dirs?.mode === 'drive' && !hasCarPark ? dirs : null;
  const shuttleOnly = dirs?.mode === 'transit' && !hasCarPark ? dirs : null;
  const viaPoint: AccessPoint | null = via ? { lat: via.lat, lon: via.lon, pointSource: via.pointSource, pointChecked: null, sourceLicence: via.pointSource.startsWith('osm_') ? 'ODbL' : 'unknown', name: via.name, note: null, elevationM: null } : null;
  const target = shuttleOnly ? null : via ? { at: { lat: via.lat, lng: via.lon }, label: via.name, source: 'access' as const } : directionsTarget(place);
  const targetPoint = viaPoint ?? (target ? (target.source === 'parking' ? place.access?.parking[0] : target.source === 'trailhead' ? th : place.point) : null);
  const unconfirmed = place.honesty.some((h) => h.id === 'location_unconfirmed');
  // LT-M: the address of what the card goes to. When it belongs to another record than the target (the place's own address under a car park
  // of the older data), the line names whose it is. Nothing is drawn when none is stored.
  const addr = target ? (place.sections?.address ?? null) : null;
  const addrIsTarget = !!addr && (target?.source === 'place' ? addr.ref === place.sections?.ref : target?.source === 'access' ? addr.ref === via?.ref : false);
  const sheet = place.sections?.mapSheet ?? null;
  const osmEl = target?.source === 'place' ? osmElementUrl(place.sections?.osmRef) : null;
  // the maps row grows only where the record holds something to show (an address, an OpenStreetMap element or an official map sheet)
  const moreMaps = !!target && (!!addr || !!sheet || !!osmEl);
  // The Directions card's lines are built here so that a page with nothing new to say renders the same elements as before (not one extra
  // empty child in the page payload): the new lines and buttons replace the old tree only where a record holds an address, an OSM element
  // or a map sheet.
  const toLine = target ? (
    <p className="small">
      To <strong>{target.label}</strong>. Our point · {targetPoint ? <PointSource p={targetPoint} /> : null} <span className="num">{formatPoint(target.at)}</span>
    </p>
  ) : null;
  const addrLine = target && addr ? (
    <p className="pl-addr">
      <span className="pl-addr-text">
        <span className="sr-only">Address: </span>
        {addrIsTarget ? null : <strong>{addr.name}: </strong>}
        {addressLine(addr)}
      </span>
      <CopyAddress text={addressClipboard(addr, target.at ? { lat: target.at.lat, lon: target.at.lng } : null)} name={addr.name} />
    </p>
  ) : null;
  const googleBtn = target ? (
    <a className="btn" href={directionsUrl(target.at)} target="_blank" rel="noopener noreferrer">
      <Icon name="navigate" size={14} /> Google Maps directions<span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : null;
  const appleBtn = target ? (
    <a className="btn" href={appleMapsUrl(target.at, target.label)} target="_blank" rel="noopener noreferrer">
      Apple Maps<span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : null;
  const points: PlaceMapPoint[] = [
    ...(th ? [{ id: 'trailhead', at: pointAt(th), style: 'trailhead' as const, label: th.name }] : []),
    ...(place.access?.parking ?? []).map((p, i) => ({ id: `parking-${i}`, at: pointAt(p), style: 'parking' as const, label: p.name })),
    ...(dest ? [{ id: 'place', at: dest, style: 'place' as const, label: place.name }] : []),
  ];
  // a point shared by two roles draws once
  const seen = new Set<string>();
  const unique = dedupeMapPoints(points.filter((p) => {
    const k = `${p.style}:${p.at.lat.toFixed(5)},${p.at.lng.toFixed(5)}`;
    return seen.has(k) ? false : (seen.add(k), true);
  }));
  const selectedPoint = (id: string) => (unique.some((p) => p.id === id) ? id : id === 'place' && unique.some((p) => p.id === 'trailhead') ? 'trailhead' : undefined);

  const hasAccess = !['area', 'town'].includes(place.kind) && place.subkind !== 'range' || Boolean(place.access && (place.access.trailhead || place.access.parking.length));
  const glance = glanceFor(place);
  const allTrails = allTrailsLink({ name: place.name, area: district?.name ?? state?.name ?? null, links: place.links.flatMap((g) => g.links) });
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
  const checked = lastRead(place.facts);
  const tabs = leanTabs(linkTabs(place.links, place.linksNone));
  const photos = place.photos.length ? place.photos : place.photo ? [place.photo] : [];
  const credits = photos.map((p) => ({ title: p.caption || p.file, author: p.author, licence: p.licence, licenceUrl: p.licenceUrl ?? undefined, sourceUrl: p.sourceUrl }));
  const suits: string[] = [];
  if (place.kidFit !== 'unknown') suits.push(KID_LABELS[place.kidFit] ?? place.kidFit);
  if (place.minAge) suits.push(ageLabel('fit', place.minAge, 'rule'));

  const model = place.sections;
  const suit = place.suitability;
  const rel = place.relevance;
  const slugs = place.refSlugs;
  const hasTrack = place.lines.some((l) => (l.geometry?.length ?? 0) > 1 || (l.segments?.length ?? 0) > 0);
  // the older record's blocks, drawn inside the contract's sections so no visible fact is lost (S5)
  // One adult time per trail (S4): the checked record's time lives in "Who it suits"; the older plan's time shows here only when no checked
  // time exists, and as a conflict line, with both sources, when the two disagree (T3).
  const legacyTime = factByLabel(place.facts, 'Time');
  const adultTime = suit?.adultTime ?? null;
  const routeTime = !adultTime && legacyTime ? timeText(legacyTime.value) : null;
  const timeConflict = adultTime && legacyTime && !sameRange(minutesRange(adultTime.text), minutesRange(timeText(legacyTime.value))) ? { adult: adultTime, legacy: legacyTime } : null;
  const activityBlock = showProfile ? (
    <>
      {/* the trail strip above already says length, climb and time (VI-5: no fact twice) */}
      {model ? null : (
        <p
          className="pl-route-line num"
          dangerouslySetInnerHTML={{ __html: withUnits([km !== null ? `${km} km` : null, gain !== null ? `${gain} m ${factByLabel(place.facts, 'Climb') ? 'climb' : 'change'}` : null, routeTime].filter(Boolean).join(' · ')) }}
        />
      )}
      {timeConflict ? (
        <div className="pl-conflict" data-what="adult-time">
          <Chip kind="caution" icon="warn">
            Sources disagree on the adult time
          </Chip>
          <ul>
            <li>
              {timeConflict.adult.text}
              <span className="pl-prov">{timeConflict.adult.basis}</span>
            </li>
            <li>
              {timeText(timeConflict.legacy.value)}
              <span className="pl-prov">{provenanceText(timeConflict.legacy.provenance)}</span>
            </li>
          </ul>
        </div>
      ) : null}
      <TrailProfile km={km} gainM={gain} startM={startM} loop={loop} highM={firstNumber(factByLabel(place.facts, 'High point')?.value)} guide={guide} lines={place.lines} />
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
    </>
  ) : null;
  const mapped = new Set(place.sections?.legacyMapped ?? []);
  const accessHtml =
    (place.access?.trailhead ? `<div class="pl-access-list">${accessCard(place.access.trailhead, 'Trailhead', unconfirmed)}${(place.access.parking ?? []).map((p) => accessCard(p, 'Parking', false)).join('')}</div>` : place.access?.parking.length ? `<div class="pl-access-list">${place.access.parking.map((p) => accessCard(p, 'Parking', false)).join('')}</div>` : '') + factsDl(access.filter((f) => !mapped.has(f.label)));
  const accessBlock = accessHtml ? <div className="su-c" dangerouslySetInnerHTML={{ __html: accessHtml }} /> : null;
  const seasonBlock = place.season.length || publicText(place.seasonNote) ? (
    <>
      {place.season.length ? (
        <>
          <SeasonStrip months={seasonMonths(place.season)} />
          <p className="pl-season num">{seasonLabel(place.season)}</p>
        </>
      ) : null}
      {publicText(place.seasonNote) ? <p>{observed(publicText(place.seasonNote))}</p> : null}
    </>
  ) : null;
  const photosBlock = photos.length ? (
    <>
      <GalleryLazy photos={photos.map((p) => ({ url: p.url, caption: p.caption, title: p.caption || p.file, author: p.author, licence: p.licence, licenceUrl: p.licenceUrl ?? undefined, sourceUrl: p.sourceUrl }))} />
      <Credits photos={credits} />
    </>
  ) : (
    <p className="pl-gap pl-nophotos">
      <Icon name="info" size={14} /> No licensed photo yet, so none is shown.
    </p>
  );
  const modelFacts = place.facts.filter((f, i, all) => !mapped.has(f.label) && !(showProfile && f.label === 'Time') && !accessLabels.has(f.label) && !(showProfile && huts.some((h) => h.label === f.label)) && all.findIndex((g) => g.label === f.label && g.value === f.value) === i);
  const factsBlock = (
    <>
      {modelFacts.length ? <div className="su-c" dangerouslySetInnerHTML={{ __html: factsDl(modelFacts) }} /> : null}
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
            {place.completeness.label} · {place.completeness.failed.length} checks still open
          </summary>
          <p className="muted small">{place.completeness.tooltip}.</p>
          <ul>
            {place.completeness.failed.map((c) => (
              <li key={c.id}>
                <strong>{c.label}:</strong> not checked yet
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
  const legacy: LegacySlots = {
    activity: activityBlock,
    access: accessBlock,
    season: seasonBlock,
    photos: photosBlock,
    links: <LinksTabs tabs={tabs} checked={checked} />,
    facts: factsBlock,
    hazards: place.hazards.map((h) => observed(publicText(h))).filter(Boolean),
    booking: place.booking ? factText(place.booking) : null,
  };

  // An area's own list of the places in it (P5). The contract sections have no slot for it yet (D-E8's lazy "In the same park" is not
  // built), so a page drawn from the sections keeps this list for an area; elsewhere "Also in" stays a legacy-page block.
  const insideSection =
    place.kind === 'area' || inside.length ? (
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
            <Icon name="info" size={14} /> Not checked yet: other places here
          </p>
        )}
      </Section>
    ) : null;

  return (
    <PlaceShell>
      <article className="pl-page" data-kind={place.kind} data-slug={place.slug}>
        <Interactions />
        <Breadcrumbs items={crumbs} className="pl-crumbs" />
        <header className="pl-cover" data-trail={trail || undefined} data-photo={photos[0] ? 'yes' : 'no'}>
          <div className="pl-cover-media">
            {photos[0] ? (
              <EntityImage src={photos[0].url} width={960} height={540} sizes="100vw" priority fallbackIcon={kindIcon(place.kind)} />
            ) : (
              <span className="pl-cover-glyph" aria-hidden="true">
                <Icon name={kindIcon(place.kind)} size={96} />
              </span>
            )}
          </div>
          <div className="pl-cover-title">
            <p className="pl-kicker">{kicker}</p>
            <h1>{place.name}</h1>
          </div>
        </header>
        <div className="pl-cover-body">
          {rel ? <CoverRelevance rel={rel} slugs={slugs} name={place.name} /> : null}
          <p className="pl-summary">{summaryOrKind(place.summary, place.kindLabel, place.areaLabel)}</p>
          {!rel?.payoff && trail && payoff ? (
            <p className="pl-payoff">
              To {payoff.slug ? <Link href={`/places/${payoff.slug}/`}>{payoff.name}</Link> : <strong>{payoff.name}</strong>}
            </p>
          ) : null}
          <div className="pl-actions">
            {target ? <DirectionsChooser at={target.at} label={target.label} /> : null}
            <SaveToTrip url={url} slug={place.slug} formats={['gpx']} primary={!target} {...(TRIP_EDIT_ON ? { edit: tripPickerProps(place) } : {})} />
            <TrailExport slug={place.slug} lines={place.lines} />
            <ShareButton url={url} title={place.name} />
            {place.point ? (
              <Link className="btn" href={`/globe/place/${place.slug}/`}>
                <Icon name="globe" size={15} /> Globe
              </Link>
            ) : null}
          </div>
          {shuttleOnly ? (
            <p className="muted small pl-shuttle-note">
              No driving directions: no private cars on this road. <a href="#access">Shuttle and bus details</a>
            </p>
          ) : null}
        </div>

        {model ? (
          <Glance
            model={model}
            suit={suit}
            level={place.completeness}
            trailhead={place.access?.trailhead?.name ?? null}
            isArea={place.kind === 'area' || place.subkind === 'range'}
            trail={trail ? { extras: { km, gainM: gain, legacyTime: legacyTime ? timeText(legacyTime.value) : null, highPoint: factByLabel(place.facts, 'High point')?.value ?? null, shape: shape ? shape.charAt(0).toUpperCase() + shape.slice(1) : null, trailhead: th?.name ?? null, hazards: place.hazards, parking: place.access?.parking[0]?.name ?? factByLabel(place.facts, 'Parking', 'Lot')?.value ?? null, hasTrack }, place: { name: place.name, area: district?.name ?? state?.name ?? null, links: place.links.flatMap((g) => g.links) } } : null}
          />
        ) : null}
        {model ? <SectionIndex /> : null}
        {!model ? (
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
          {trail ? (
            <p className="pl-alltrails small">
              <a href={allTrails.url} target="_blank" rel="noopener noreferrer" aria-label={`${allTrails.text} on AllTrails (opens in a new tab, third-party site)`}>
                {allTrails.text}
              </a>{' '}
              <span className="muted">third-party site, link only</span>
            </p>
          ) : null}
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
        ) : null}

        {!model && trail && place.hazards.length ? (
          <section className="pl-hazards pl-hazards-top" aria-labelledby="h-hazards-top">
            <h2 id="h-hazards-top">
              <Icon name="warn" size={16} /> Hazards
            </h2>
            <ul>
              {place.hazards.map((h) => (
                <li key={h}>{observed(publicText(h))}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="pl-cols">
          {model ? (
            <div className="pl-main">
              <Sections model={model} suit={suit} rel={rel} slugs={slugs} legacy={legacy} hasRoute={showProfile || hasTrack} stripped={trail} />
              {place.kind === 'area' ? insideSection : null}
            </div>
          ) : (
          <div className="pl-main">
            {showProfile ? (
              <Section id="route" title="The route">
                <p className="pl-route-line num">
                  {[km !== null ? `${km} km` : null, gain !== null ? `${gain} m ${factByLabel(place.facts, 'Climb') ? 'climb' : 'change'}` : null, factByLabel(place.facts, 'Time') ? timeText(factByLabel(place.facts, 'Time')?.value ?? '') : null].filter(Boolean).join(' · ')}
                </p>
                <TrailProfile km={km} gainM={gain} startM={startM} loop={loop} highM={firstNumber(factByLabel(place.facts, 'High point')?.value)} guide={guide} lines={place.lines} />
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
                  <Icon name="info" size={14} /> Not checked yet: trailhead and parking
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
                  <Icon name="info" size={14} /> Not checked yet: season
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
                  <span className="gc">Family checks not done yet</span>
                </p>
              )}
              {factByLabel(place.facts, 'Kids') ? (
                <p>
                  <FactText text={factByLabel(place.facts, 'Kids')?.value ?? ''} />
                </p>
              ) : null}
            </Section>

            {insideSection}

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
                  <Icon name="info" size={14} /> Not checked yet: further facts
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
                    {place.completeness.label} · {place.completeness.failed.length} checks still open
                  </summary>
                  <p className="muted small">{place.completeness.tooltip}.</p>
                  <ul>
                    {place.completeness.failed.map((c) => (
                      <li key={c.id}>
                        <strong>{c.label}:</strong> not checked yet
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
          )}

          <aside className="pl-side" aria-label="Map, directions and links">
            <section className="pl-card pl-mapcard" aria-labelledby="h-map">
              <h2 id="h-map" className="sr-only">
                Map
              </h2>
              {unique.length ? (
                <TrailMap name={place.name} points={unique} guide={guide} lines={place.lines} selectedId={target ? selectedPoint(target.source === 'parking' ? 'parking-0' : target.source === 'trailhead' ? 'trailhead' : 'place') : undefined} />
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
                  {addrLine ? (
                    <>
                      {toLine}
                      {addrLine}
                    </>
                  ) : (
                    toLine
                  )}
                  {unconfirmed ? (
                    <p>
                      <Chip kind="honest" icon="warn" title="A person must confirm this location">
                        Location unconfirmed
                      </Chip>
                    </p>
                  ) : null}
                  {moreMaps ? (
                    <p className="pl-dir-links">
                      {googleBtn}
                      {appleBtn}
                      <a className="btn" href={osmEl ?? osmPointUrl(target.at)} target="_blank" rel="noopener noreferrer">
                        OpenStreetMap<span className="sr-only"> (opens in a new tab)</span>
                      </a>
                      {sheet ? (
                        <a className="btn" href={sheet} target="_blank" rel="noopener noreferrer">
                          Official map<span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      ) : null}
                    </p>
                  ) : (
                    <p className="pl-dir-links">
                      {googleBtn}
                      {appleBtn}
                    </p>
                  )}
                  {via ? <p className="muted small">{place.name} has no car park of its own stored here, so directions go to {via.name}, where you {via.role === 'parks_for' ? 'park' : via.role === 'serves' ? 'catch the shuttle or bus' : 'start'}.</p> : null}
                  {target.source === 'parking' && th ? <p className="muted small">The trail starts at {th.name}, on foot from the car park.</p> : null}
                </>
              ) : shuttleOnly ? (
                <p className="small">
                  No private cars on this road: take the shuttle or bus from {shuttleOnly.stops.map((x) => x.name).join(' or ')}. The access section has the seat, the times and where the shuttle starts. We have no car park stored for it yet, so there is no driving button.
                </p>
              ) : (
                <p className="pl-gap">
                  <Icon name="info" size={14} /> No point is stored yet, so there are no directions.
                </p>
              )}
            </section>

            {!model && !trail ? (
              <section className={place.hazards.length ? 'pl-hazards' : 'pl-card'} aria-labelledby="h-hazards">
                <h2 id="h-hazards">
                  {place.hazards.length ? <Icon name="warn" size={16} /> : null} Hazards
                </h2>
                {place.hazards.length ? (
                  <ul>
                    {place.hazards.map((h) => (
                      <li key={h}>{observed(publicText(h))}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">Not checked yet: hazards</p>
                )}
              </section>
            ) : null}

            {!model ? (
              <section className="pl-card" aria-labelledby="h-links">
                <h2 id="h-links">Links</h2>
                <LinksTabs tabs={tabs} checked={checked} />
              </section>
            ) : null}

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
