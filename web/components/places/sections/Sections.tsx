import type { ReactNode } from 'react';
import { GapChip, RefLink, RowsHtml, fromRow, fromSuit, type ShowRow } from '@/components/suit/Rows';
import { glanceHtml, warningsHtml } from '@/components/suit/html';
import { WhoItSuits, WhoItSuitsEmpty } from '@/components/suit/WhoItSuits';
import { CHIP_ROW_PROPERTIES } from '@/lib/public/contract';
import type { PublicRelevance } from '@/lib/public/relevance';
import type { OfferCard, PageModel, Row, SectionModel } from '@/lib/public/sections';
import type { PublicSuitability } from '@/lib/public/suitability';
import type { Completeness } from '@/lib/public/types';
import { Nearby } from './Relevance';
import { seasonShort } from './SeasonGrid';

// The 14 sections of the capture contract in order (place-page-sections section 2). Each section reads its rows, its structures
// and its closing line from the page model; the only decisions here are by section id, the contract's own, never by the type of the
// place (S3). A section with R or A properties and no value stays, as markers; only an all-N section is absent (owner rule, D9).

/** Rows the page draws elsewhere (the cover, the map, a section's own structure) or that are not copy for a visitor. */
const NOT_ROWS = new Set(['name', 'type', 'area_id', 'summary', 'class_key', 'draw', 'standing', 'distinction', 'easy_payoff', 'weather', 'why', 'why_stay', 'signals', 'geometry', 'pairs_with', 'links', 'photos', 'wikidata', 'point']);
const RELATION_ROW = (r: Row): boolean => r.valueType === 'relation_list' || r.valueType === 'ref';

export interface LegacySlots {
  /** the stat line, profile, huts and route records of a trail (L4b components) */
  activity: ReactNode;
  /** the trailhead and parking cards with their map links, and the booking window of the older record */
  access: ReactNode;
  /** the legacy season strip, when the record has no typed season line */
  season: ReactNode;
  photos: ReactNode;
  links: ReactNode;
  /** every fact of the older record, with its provenance and conflicts (S5: no visible fact is lost) */
  facts: ReactNode;
  /** hazards of the older record, as lines of "Before you go" */
  hazards: string[];
  /** the booking window of the older record */
  booking: string | null;
}

function Head({ sec, meta }: { sec: SectionModel; meta?: string | null }) {
  return (
    <header className="ps-head">
      <h2 id={`h-${sec.id}`}>{sec.title}</h2>
      {meta ? <p className="ps-meta">{meta}</p> : null}
    </header>
  );
}

function Closing({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="su-closing">
      {text}
    </p>
  );
}

const shownRows = (sec: SectionModel, skip: (r: Row) => boolean = () => false): Row[] => sec.rows.filter((r) => !NOT_ROWS.has(r.key) && !skip(r));

function Rows({ rows, slugs }: { rows: Row[]; slugs: Record<string, string> }) {
  return rows.length ? <RowsHtml rows={rows.map(fromRow)} slugs={slugs} /> : null;
}

/* ---------- the glance strip (section 2) ---------- */

/** The row a glance slot is the echo of: a section row, else a "Who it suits" row. */
function findRow(model: PageModel, suit: PublicSuitability | null, key: string): { row: ShowRow; href: string } | null {
  for (const s of model.sections) {
    const r = s.rows.find((x) => x.key === key);
    if (r) return { row: fromRow(r), href: `#row-${key}` };
  }
  for (const g of suit?.groups ?? []) {
    const r = g.rows.find((x) => x.key === key);
    if (r) return { row: fromSuit(r), href: `#su-${key}` };
  }
  return null;
}

/** Six answers at a glance (PS13): the contract's glance, skipping what the chip row below already says. Each is a link to its row. */
export function Glance({ model, suit, level }: { model: PageModel; suit: PublicSuitability | null; level: Completeness }) {
  const slots = model.glance
    .filter((k) => !CHIP_ROW_PROPERTIES.includes(k))
    .map((k) => findRow(model, suit, k))
    .filter((x): x is { row: ShowRow; href: string } => x !== null)
    .slice(0, 6)
    .map(({ row, href }) => ({ row, href, value: (row.valueType === 'season_rows' ? seasonShort(row.value) : '') || row.text || '' }));
  return <section className="ps-glance" id="glance" aria-label="At a glance" dangerouslySetInnerHTML={{ __html: glanceHtml(slots, level, model.checks) }} />;
}

/* ---------- section bodies ---------- */

function Warnings({ sec, rel, legacy, slugs, suitWarning }: { sec: SectionModel; rel: PublicRelevance | null; legacy: LegacySlots; slugs: Record<string, string>; suitWarning: string | null }) {
  return <div className="su-c" dangerouslySetInnerHTML={{ __html: warningsHtml(sec, rel, slugs, legacy.booking, legacy.hazards, suitWarning) }} />;
}

function OfferCardView({ o, slugs }: { o: OfferCard; slugs: Record<string, string> }) {
  const rows = o.rows.filter((r) => r.key !== 'variants');
  return (
    <article className="ps-offer">
      <header>
        <h3>
          <RefLink r={o} slugs={slugs} />
        </h3>
        <p className="ps-stub">{[o.operator?.name, o.offerClass].filter(Boolean).join(' · ')}</p>
      </header>
      <div className="su-rows">
        <RowsHtml rows={rows.map(fromRow)} slugs={slugs} idOf={(r) => `${o.ref}-${r.key}`.replace(/[^\w-]/g, '-')} />
        <div className="su-row">
          <span className="su-lab">Where</span>
          <span className="su-val">{o.at ? <RefLink r={o.at} slugs={slugs} /> : <GapChip>Not checked yet · no meeting place recorded</GapChip>}</span>
        </div>
      </div>
      <Closing text={o.closing} />
    </article>
  );
}

const ROLE_LABEL: Record<string, string> = { starts_at: 'Start', reaches: 'Payoff', passes: 'On the way', ends_at: 'End' };
const AP_ROLE: Record<string, string> = { starts_here: 'Starts here', parks_for: 'Parking', serves: 'Stop', starts_at: 'Start' };

function Access({ sec, model, legacy, slugs }: { sec: SectionModel; model: PageModel; legacy: LegacySlots; slugs: Record<string, string> }) {
  const rows = shownRows(sec, RELATION_ROW);
  const stops = model.routeStops;
  const order = ['starts_at', 'passes', 'reaches', 'ends_at'];
  const sortedStops = [...stops].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  return (
    <>
      {model.ways.length ? (
        <ul className="ps-ways" aria-label="Ways to get here">
          {model.ways.map((w) => (
            <li key={w.ref}>
              <RefLink r={w} slugs={slugs} />
            </li>
          ))}
        </ul>
      ) : null}
      {sortedStops.length ? (
        <ul className="ps-stops" aria-label="Start, on the way, payoff">
          {sortedStops.map((s) => (
            <li key={`${s.role}-${s.ref}`}>
              <span className="ps-kind">{ROLE_LABEL[s.role] ?? s.role}</span>
              <RefLink r={s} slugs={slugs} />
              {s.atKm ? <span className="ps-stub"> · {s.atKm} km</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {model.accessPoints.length && !stops.length ? (
        <ul className="ps-stops" aria-label="Where you arrive">
          {model.accessPoints.map((a) => (
            <li key={a.ref}>
              <span className="ps-kind">{AP_ROLE[a.role] ?? a.role}</span>
              <RefLink r={a} slugs={slugs} />
            </li>
          ))}
        </ul>
      ) : null}
      <Rows rows={rows} slugs={slugs} />
      {legacy.access}
      <Closing text={sec.closing} />
    </>
  );
}

function Around({ sec, model, slugs }: { sec: SectionModel; model: PageModel; slugs: Record<string, string> }) {
  return (
    <>
      {model.partOf.length ? (
        <p className="ps-part">
          Part of{' '}
          {model.partOf.map((p, i) => (
            <span key={p.ref}>
              {i ? ', ' : ''}
              <RefLink r={p} slugs={slugs} />
            </span>
          ))}
        </p>
      ) : null}
      {model.around.map((g) => (
        <div key={`${g.domain}-${g.at?.ref ?? ''}`} className="ps-group">
          <h3 className="ps-sub">{g.at ? `At the payoff: ${g.at.name}` : g.domain}</h3>
          <ul className="ps-around">
            {g.items.slice(0, 6).map((it) => (
              <li key={it.ref}>
                <RefLink r={it} slugs={slugs} />
                {it.where ? <span className="ps-stub"> · at {it.where.name}</span> : null}
              </li>
            ))}
          </ul>
          {g.items.length > 6 ? (
            <details className="ps-more">
              <summary>Show all {g.items.length}</summary>
              <ul className="ps-around">
                {g.items.slice(6).map((it) => (
                  <li key={it.ref}>
                    <RefLink r={it} slugs={slugs} />
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ))}
      <Closing text={sec.closing ?? (model.around.length === 0 && model.partOf.length === 0 ? 'Not checked yet: what else you can do here' : null)} />
    </>
  );
}

export interface SectionsProps {
  model: PageModel;
  suit: PublicSuitability | null;
  rel: PublicRelevance | null;
  slugs: Record<string, string>;
  legacy: LegacySlots;
  /** a trail drawn from the older record: its route block sits in section 5 even where the contract has no row for it */
  hasRoute: boolean;
}

/** Sections 3 to 14, in the contract's order. Sections 1 (the cover) and 2 (the glance) are drawn by the page above them. */
export function Sections({ model, suit, rel, slugs, legacy, hasRoute }: SectionsProps) {
  return (
    <>
      {model.sections
        .filter((s) => s.n >= 3)
        .map((sec) => {
          const hasStructure =
            (sec.id === 'activity' && hasRoute) ||
            (sec.id === 'access' && (model.ways.length > 0 || model.routeStops.length > 0 || model.accessPoints.length > 0 || legacy.access !== null)) ||
            (sec.id === 'options' && model.offers.length > 0) ||
            (sec.id === 'around' && (model.around.length > 0 || model.partOf.length > 0)) ||
            (sec.id === 'when' && legacy.season !== null) ||
            (sec.id === 'warnings' && (legacy.hazards.length > 0 || legacy.booking !== null || !!rel?.planB)) ||
            (sec.id === 'pairs' && !!rel && (rel.pairs.length > 0 || rel.similar.length > 0)) ||
            sec.id === 'photos' ||
            sec.id === 'links' ||
            sec.id === 'sources';
          if (!sec.drawn && !hasStructure) return null;
          if (sec.id === 'suits') return suit ? <WhoItSuits key={sec.id} suit={suit} slugs={slugs} title={sec.title} /> : <WhoItSuitsEmpty key={sec.id} title={sec.title} />;
          const meta = sec.id === 'options' ? '2026 prices used as a pattern' : null;
          return (
            <section key={sec.id} className="ps-sec" id={sec.id} aria-labelledby={`h-${sec.id}`}>
              <Head sec={sec} meta={meta} />
              {sec.id === 'warnings' ? <Warnings sec={sec} rel={rel} legacy={legacy} slugs={slugs} suitWarning={suit?.warning ?? null} /> : null}
              {sec.id === 'activity' ? (
                <>
                  {legacy.activity}
                  <Rows rows={shownRows(sec)} slugs={slugs} />
                  <Closing text={sec.closing} />
                </>
              ) : null}
              {sec.id === 'options' ? (
                <>
                  {model.offers.map((o) => (
                    <OfferCardView key={o.ref} o={o} slugs={slugs} />
                  ))}
                  {sec.empty ? null : <Rows rows={shownRows(sec)} slugs={slugs} />}
                  <Closing text={sec.closing} />
                </>
              ) : null}
              {sec.id === 'access' ? <Access sec={sec} model={model} legacy={legacy} slugs={slugs} /> : null}
              {sec.id === 'when' ? (
                <>
                  <Rows rows={shownRows(sec)} slugs={slugs} />
                  {model.sections.find((x) => x.id === 'when')?.rows.some((r) => r.valueType === 'season_rows' && !r.gap) ? null : legacy.season}
                  <Closing text={sec.closing} />
                </>
              ) : null}
              {sec.id === 'facilities' ? (
                <>
                  {sec.empty ? null : <Rows rows={shownRows(sec)} slugs={slugs} />}
                  <Closing text={sec.closing} />
                </>
              ) : null}
              {sec.id === 'around' ? <Around sec={sec} model={model} slugs={slugs} /> : null}
              {sec.id === 'pairs' ? (rel ? <Nearby rel={rel} slugs={slugs} closing={sec.closing} /> : <Closing text={sec.closing} />) : null}
              {sec.id === 'photos' ? (
                <>
                  {legacy.photos}
                  {sec.closing && !legacy.photos ? <Closing text={sec.closing} /> : null}
                </>
              ) : null}
              {sec.id === 'links' ? (
                <>
                  {legacy.links}
                  {sec.closing ? <Closing text={sec.closing} /> : null}
                </>
              ) : null}
              {sec.id === 'sources' ? (
                <>
                  {legacy.facts}
                  <Rows rows={shownRows(sec)} slugs={slugs} />
                </>
              ) : null}
            </section>
          );
        })}
    </>
  );
}
