import type { ReactNode } from 'react';
import { GapChip, RefLink, RowsHtml, fromRow, type ShowRow } from '@/components/suit/Rows';
import { checksText, glanceHtml, warningsHtml } from '@/components/suit/html';
import { WhoItSuits, WhoItSuitsEmpty } from '@/components/suit/WhoItSuits';
import { CHIP_ROW_PROPERTIES } from '@/lib/public/contract';
import type { PublicRelevance } from '@/lib/public/relevance';
import type { OfferCard, PageModel, Row, SectionModel } from '@/lib/public/sections';
import type { PublicSuitability } from '@/lib/public/suitability';
import type { Completeness } from '@/lib/public/types';
import { Nearby } from './Relevance';
import { seasonShort } from './SeasonGrid';
import { findRow, readLine, trailStrip, type TrailExtras } from './trailFacts';
import { TrailStripTiles, type Tile } from '../SaveToTrip';
import './glance.css';

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
    <header className="ph">
      <h2 id={`h-${sec.id}`}>{sec.title}</h2>
      {meta ? <p className="ps-meta">{meta}</p> : null}
    </header>
  );
}

function Closing({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="sc">
      {text}
    </p>
  );
}

const shownRows = (sec: SectionModel, skip: (r: Row) => boolean = () => false): Row[] => sec.rows.filter((r) => !NOT_ROWS.has(r.key) && !skip(r));

function Rows({ rows, slugs }: { rows: Row[]; slugs: Record<string, string> }) {
  return rows.length ? <RowsHtml rows={rows.map(fromRow)} slugs={slugs} /> : null;
}

/* ---------- the glance strip (section 2) ---------- */

/**
 * A glance tile holds one answer (P3). A list a section keeps whole ("EUR 13 adult; EUR 0 child; EUR 10 person ...", "Tue-Sun 10:00-18:00; Mon, 1 Jul
 * to 31 Aug ...") shows its first entry and a count; the section below has all of it, so the hours are printed in full once (R4-PP4, 3.49).
 */
export function leadOf(text: string): string {
  if (/[()]/.test(text)) return text;
  const parts = text.split(/;\s+/).map((x) => x.trim()).filter(Boolean);
  const uniq = parts.filter((x, i) => parts.indexOf(x) === i);
  return uniq.length > 1 ? `${uniq[0]} · +${uniq.length - 1} more` : text;
}

/** Six answers at a glance (PS13): the contract's glance, skipping what the chip row below already says. Each is a link to its row. */
export function Glance({ model, suit, level, trailhead = null, isArea = false, trail = null }: { model: PageModel; suit: PublicSuitability | null; level: Completeness; trailhead?: string | null; isArea?: boolean; trail?: { extras: TrailExtras; place: { name: string; area: string | null; links: ReadonlyArray<{ kind: string; url: string }> } } | null }) {
  const directions = model.directions?.mode === 'drive' ? model.directions : null;
  // A required row the older record answered (step 9 of the contract mapping) counts as done: the engine ran before the mapping (3.49)
  const mapped = Math.min(
    model.legacyMapped?.length ?? 0,
    model.sections.flatMap((s) => s.rows).filter((r) => r.mark === 'R' && !r.gap && r.val !== null && r.val.basis === null && r.val.sources.length === 0).length,
  );
  const adjusted: Completeness = mapped > 0 ? { ...level, passed: Math.min(level.total, level.passed + mapped), label: level.label.replace(/(\d+) of (\d+)/, (_m, d: string, t: string) => `${Math.min(Number(t), Number(d) + mapped)} of ${t}`) } : level;
  const all = model.glance
    .filter((k) => !CHIP_ROW_PROPERTIES.includes(k))
    .map((k) => ({ key: k, hit: findRow(model, suit, k) }))
    .filter((x): x is { key: string; hit: { row: ShowRow; href: string } } => x.hit !== null)
    // a range or region has no trailhead, no car park and no lift or road season: those tiles would only say "Not checked yet" about things it cannot have
    .filter((x) => !(isArea && x.hit.row.gap && (x.key === 'access_points' || x.key === 'access_season')))
    .map(({ key, hit: { row, href } }) => {
      const value = leadOf((row.valueType === 'season_rows' ? seasonShort(row.value) : '') || row.text || '');
      // Directions already name where you start (S5): a gap here would contradict it, so the slot reads the same stop
      if (key === 'starts_at' && row.gap && directions?.role === 'starts_at') return { row: { ...row, gap: false, text: directions.name }, href, value: directions.name };
      // the Directions card names the trailhead it holds: a "Starts at" gap beside it would say the opposite
      if (key === 'starts_at' && row.gap && trailhead) return { row: { ...row, gap: false, text: trailhead }, href, value: trailhead };
      return { row, href, value };
    });
  // each value has one slot (S5): "Trailhead and parking" and "Starts at" are often the same stop, so the first one stays
  const seen = new Set<string>();
  const slots = all
    .filter((x) => {
      if (x.row.gap || !x.value) return true;
      const k = x.value.trim().toLowerCase();
      return seen.has(k) ? false : (seen.add(k), true);
    })
    .slice(0, 6);
  // A trail leads with its 14 facts and AllTrails (10.1, 10.3): the same tiles and checks line. A long strip keeps no source line per tile (P6: the
  // row each tile links to holds it); one line under the strip says when it was read (M14).
  const checks = { ...model.checks, done: Math.min(model.checks.total, model.checks.done + mapped) };
  const strip = trail ? trailStrip(model, suit, trail.extras, trail.place) : null;
  if (strip) {
    const tiles: Tile[] = strip.slots.map(({ row, href, value }) => {
      const v = row.gap ? undefined : value;
      const c = row.val?.conflicts.length;
      return { l: row.label, h: href, ...(v === undefined ? {} : { v }), ...(c ? { c } : {}) };
    });
    const ext = { l: 'Trail guide · link only', u: strip.allTrails.url, t: strip.allTrails.text, // the accessible name starts with the visible words (WCAG 2.5.3) and is the one place the platform is named
    a: `Trail guide · link only: ${strip.allTrails.text} on AllTrails (opens in a new tab, third-party site)` };
    return (
      <section className="ps-glance" id="glance" aria-label="At a glance">
        <TrailStripTiles tiles={tiles} ext={ext} read={readLine(strip.slots)} level={{ v: adjusted.level, l: adjusted.label, c: checksText(adjusted.label, checks) }} />
      </section>
    );
  }
  // no source line per tile here either (P6, S13): the row each tile links to holds it, and the line below says when the record was read
  const html = glanceHtml(slots, adjusted, checks, { source: false });
  return <section className="ps-glance" id="glance" aria-label="At a glance" dangerouslySetInnerHTML={{ __html: html }} />;
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
        <p className="pb">{[o.operator?.name, o.offerClass].filter(Boolean).join(' · ')}</p>
      </header>
      <div className="srs">
        <RowsHtml rows={rows.map(fromRow)} slugs={slugs} idOf={(r) => `${o.ref}-${r.key}`.replace(/[^\w-]/g, '-')} />
        <div className="sr">
          <span className="sl">Where</span>
          <span className="sv">{o.at ? <RefLink r={o.at} slugs={slugs} /> : <GapChip>Not checked yet · no meeting place recorded</GapChip>}</span>
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
              <span className="pk">{ROLE_LABEL[s.role] ?? s.role}</span>
              <RefLink r={s} slugs={slugs} />
              {s.atKm ? <span className="pb"> · {s.atKm} km</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {model.accessPoints.length && !stops.length ? (
        <ul className="ps-stops" aria-label="Where you arrive">
          {model.accessPoints.map((a) => (
            <li key={a.ref}>
              <span className="pk">{AP_ROLE[a.role] ?? a.role}</span>
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
                {it.where ? <span className="pb"> · at {it.where.name}</span> : null}
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

/** The sections the page draws below the glance, in the contract's order: the cover and the glance are drawn above them. */
export function drawnSections({ model, rel, legacy, hasRoute }: Pick<SectionsProps, 'model' | 'rel' | 'legacy' | 'hasRoute'>): SectionModel[] {
  return model.sections
    .filter((s) => s.n >= 3)
    .filter((sec) => {
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
      return sec.drawn || hasStructure;
    });
}

/** Sections 3 to 14, in the contract's order. Sections 1 (the cover) and 2 (the glance) are drawn by the page above them. */
export function Sections({ model, suit, rel, slugs, legacy, hasRoute }: SectionsProps) {
  const drawn = drawnSections({ model, rel, legacy, hasRoute });
  return (
    <>
      {drawn
        .map((sec) => {
          if (sec.id === 'suits') return suit ? <WhoItSuits key={sec.id} suit={suit} slugs={slugs} title={sec.title} /> : <WhoItSuitsEmpty key={sec.id} title={sec.title} />;
          const meta = sec.id === 'options' ? '2026 prices used as a pattern' : null;
          return (
            <section key={sec.id} className="ps" id={sec.id} aria-labelledby={`h-${sec.id}`}>
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
