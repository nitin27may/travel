'use client';

// The picker when a place or park page sends a place (`/t/<id>/?edit=1&add=<slug>`, edit-mode-spec 7.4; README rulings M3 and C5): the place
// pinned at the top and one row per day, best fit first. A park is never a stop, so a park slug opens its members instead; a place or
// park beyond ADD_PIN_FAR_KM of every base offers only "Start a new trip with ...", never a day.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { KindGlyph } from '@/components/ui/KindGlyph';
import type { AddCandidate } from '@/components/trips/timeline/model';
import { PAGE_SIZE, TRIP_EDIT_UI } from '@/lib/config/product';
import { usePrefs } from '@/lib/format/prefs';
import { formatDistance } from '@/lib/format/units';
import { dayDate } from '@/lib/trip-edit/moveFit';
import { addPlaceOp } from '@/lib/trip-edit/built';
import { dayRef, movedWords, moveToDayOps, newOpId } from '@/lib/trip-edit/stopOps';
import type { PlanOp } from '@/lib/trip-edit/model';
import type { Fit, Fitter } from './fit';
import type { PickerProps } from './AddPicker';
import { PickRowView } from './PickRowView';
import { groupByBase, nearDays, scoreDays, scoredWords, type Scored } from './members';
import { candidateOf, type Found } from './place';
import { daysByDistance, farKmOf, rowOfFound, type PickRow } from './rows';
import { newTripHref, oneRow } from './source';
import { runStaged } from './stage';
import { useDayView, useFitter, useParkMembers } from './useAdd';

const RANK: Record<Fit['state'], number> = { fits: 0, tight: 1, fix: 2, full: 3 };

interface DayRow {
  n: number;
  fit: Fit;
  km: number | null;
  base: string | null;
}

/** Every day of the trip with how the place fits it, best fit first, then the nearest. */
function rankDays(f: Fitter, p: PickerProps, c: AddCandidate): DayRow[] {
  const dist = new Map(c.point ? daysByDistance(p.model, c.point).map((d) => [d.n, d.km]) : []);
  return p.model.days
    .map((d) => ({ n: d.n, fit: f.fit(c, d.n), km: dist.get(d.n) ?? null, base: d.base }))
    .sort((a, b) => RANK[a.fit.state] - RANK[b.fit.state] || (a.km ?? Infinity) - (b.km ?? Infinity) || a.n - b.n);
}

export function Arrival(p: PickerProps) {
  const slug = p.slug ?? '';
  const [got, setGot] = useState<{ slug: string; found: Found | null; failed: boolean } | null>(null);
  useEffect(() => {
    const c = new AbortController();
    void oneRow(slug, c.signal).then((r) => !c.signal.aborted && setGot({ slug, ...r }));
    return () => c.abort();
  }, [slug]);
  const fitter = useFitter(p.doc, p.model, p.profile);
  const view = useDayView(p.model, fitter);
  if (!got || got.slug !== slug) return <p className="add-empty" role="status">Looking up the place</p>;
  if (!got.found) return <p className="add-empty">{got.failed ? 'We could not look that place up just now. Try again in a moment.' : 'We do not have this place any more.'}</p>;
  return got.found.kind === 'area' ? <Park park={got.found} fitter={fitter} p={{ ...p, model: view }} /> : <OnePlace place={got.found} fitter={fitter} p={{ ...p, model: view }} />;
}

function Pinned({ f, children }: { f: Found; children?: React.ReactNode }) {
  return (
    <div className="add-pin">
      <KindGlyph kind={f.kind} size="md" />
      <div className="add-main">
        <p className="add-pin-name">{f.name}</p>
        <p className="add-pin-sub"><Chip kind="kind" icon={false}>{f.kindLabel}</Chip>{f.area ? <span>{f.area}</span> : null}</p>
        {children}
      </div>
    </div>
  );
}

function FarLine({ f, p }: { f: Found; p: PickerProps }) {
  const [prefs] = usePrefs();
  const km = farKmOf(f.lat !== null && f.lon !== null ? { lat: f.lat, lon: f.lon } : null, p.model);
  const href = newTripHref(f.slug);
  return (
    <div className="add-far">
      <p className="add-far-line">{f.name} is {km !== null ? formatDistance(km, prefs.distance) : 'far'} from this trip&apos;s bases.</p>
      {href ? <a className="btn" href={href}>Start a new trip with {f.name}</a> : null}
    </div>
  );
}

/** A place that is a stop: one row per day. */
function OnePlace({ place: f, fitter, p, back }: { place: Found; fitter: Fitter | null; p: PickerProps; back?: React.ReactNode }) {
  const [prefs] = usePrefs();
  const point = f.lat !== null && f.lon !== null ? { lat: f.lat, lon: f.lon } : null;
  const far = farKmOf(point, p.model) !== null;
  const cand = useMemo(() => candidateOf(f, null), [f]);
  const on = fitter?.onTrip.get(f.slug) ?? null;
  const rows = useMemo(() => (fitter && !far ? rankDays(fitter, p, cand) : null), [fitter, far, p, cand]);
  const [last, setLast] = useState<{ label: string; day: number } | null>(null);
  const [limit, setLimit] = useState<number>(PAGE_SIZE.list);
  // the day a full day's row points to (review STEP2-PRV PR-003 (b)): the best one that is not full, never the full day itself
  const bestOpen = rows?.find((r) => r.fit.state !== 'full' && on?.day !== r.n)?.n ?? null;
  const add = (day: number) => {
    if (!fitter) return;
    let ops: PlanOp[];
    let label: string;
    if (on) {
      ops = moveToDayOps(p.doc, on.entry, day, fitter.lastStop(day));
      label = movedWords(on.entry, day);
    } else {
      if (!p.model.addables[f.slug]) p.register(cand);
      ops = [addPlaceOp(p.doc, dayRef(p.doc, day), f.slug, f.name, newOpId())];
      label = `Added ${f.name} to Day ${day}`;
    }
    if (p.commit(ops, label)) setLast({ label, day });
  };
  return (
    <div className="add-picker">
      <div className="add-head">{back}<Pinned f={f} /></div>
      <div className="add-groups">
        {far ? <FarLine f={f} p={p} /> : null}
        {last ? (
          <p className="add-added" role="status">
            {last.label}.{' '}
            {p.undoLabel === last.label ? <button type="button" className="add-undo" onClick={() => { p.undo(); setLast(null); }}>Undo</button> : null}
          </p>
        ) : null}
        {!far && !rows ? <p className="add-empty" role="status">Checking each day</p> : null}
        {rows ? (
          <section className="add-group" aria-labelledby="add-h-days">
            <h3 id="add-h-days" className="add-h">{on ? `On Day ${on.day} now. Move it to` : 'Add it to a day'}</h3>
            <ul className="add-list">
              {rows.slice(0, limit).map((r) => (
                <li key={r.n} className="add-row add-dayrow" data-fit={r.fit.state} data-current={on?.day === r.n || undefined}>
                  <div className="add-main">
                    <p className="add-name"><span className="add-title">Day {r.n}</span>{dayDate(p.start, r.n) ? <span className="add-date num">{dayDate(p.start, r.n)}</span> : null}{r.base ? <span className="add-date">{r.base}</span> : null}{r.fit.state === 'tight' ? <Chip kind="caution" icon="warn">Tight</Chip> : null}</p>
                    <p className="add-fit num" data-fit={r.fit.state}>{on?.day === r.n ? 'It is here now' : r.fit.state === 'full' ? `Day full${bestOpen !== null ? `: try Day ${bestOpen}` : ''}` : r.fit.words}</p>
                    {r.km !== null ? <p className="add-dist num">{formatDistance(r.km, prefs.distance)} from the day</p> : null}
                  </div>
                  <div className="add-act">
                    {on?.day === r.n ? null : (
                      <Button size="sm" className="add-btn" onClick={() => add(r.n)} aria-label={`${on ? 'Move to' : 'Add to'} Day ${r.n}`}>{on ? `Move to Day ${r.n}` : `Add to Day ${r.n}`}</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {rows.length > limit ? <Button size="sm" variant="ghost" className="add-more" onClick={() => setLimit((n) => n + PAGE_SIZE.list)}>Show more</Button> : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** Rows a park shows at first, and per "Show more" (review STEP2-PRV PR-003: the first page is scored at once; above it a search field shows). */
export const PARK_PAGE = 12;

interface Member {
  f: Found;
  /** the nearest day within the add radius, or null */
  day: number | null;
  /** the days tried for the best fit (members.ts nearDays) */
  near: { n: number; km: number }[];
  row: PickRow;
  on: boolean;
}

/**
 * A park is never a stop: its places (members.ts, by the park's named area, never a radius), grouped by the base of the day nearest each,
 * those already on the trip last. Each row names the day it fits best, scored in idle time for the rows on show (stage.ts); a full day is
 * never offered ("Day 1 full: try Day 3"), and a member with no day that fits, or not scored in time, offers "Pick a day": the day list of
 * that one place, in this sheet.
 */
function Park({ park, fitter, p }: { park: Found; fitter: Fitter | null; p: PickerProps }) {
  const [prefs] = usePrefs();
  const fmt = (km: number) => formatDistance(km, prefs.distance);
  const centreKey = park.lat !== null && park.lon !== null ? `${park.lat},${park.lon}` : null;
  const far = useMemo(() => (centreKey ? farKmOf({ lat: park.lat!, lon: park.lon! }, p.model) !== null : false), [centreKey, park.lat, park.lon, p.model]);
  const members = useParkMembers(far ? null : park);
  const [last, setLast] = useState<{ label: string } | null>(null);
  const [limit, setLimit] = useState<number>(PARK_PAGE);
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<Found | null>(null);
  const list = useMemo((): Member[] | null => {
    if (!fitter || members.status !== 'ok') return null;
    return members.rows.map((f) => {
      const pt = f.lat !== null && f.lon !== null ? { lat: f.lat, lon: f.lon } : null;
      const near = nearDays(p.model, pt);
      const day = near[0]?.n ?? null;
      const row: PickRow = rowOfFound(f, { model: p.model, onTrip: fitter.onTrip, day: day ?? 1 }, 'near');
      return { f, day, near, on: !!row.on, row: day === null && !row.on && !row.far ? { ...row, note: 'Not near any day of this trip' } : row };
    });
  }, [fitter, members.status, members.rows, p.model]);
  const groups = useMemo(() => {
    if (!list) return null;
    const words = q.trim().toLowerCase();
    const kept = words ? list.filter((x) => x.f.name.toLowerCase().includes(words) || x.f.kindLabel.toLowerCase().includes(words)) : list;
    const inGroups = groupByBase(kept, p.model).map((g) => ({ ...g, rows: [...g.rows].sort((a, b) => (a.near[0]?.km ?? Infinity) - (b.near[0]?.km ?? Infinity) || a.f.name.localeCompare(b.f.name)) }));
    return { all: inGroups, count: kept.length };
  }, [list, q, p.model]);
  // the first `limit` rows across the groups, in order: the page on show
  const shown = useMemo(() => {
    if (!groups) return [];
    let left = limit;
    return groups.all.flatMap((g) => {
      const rows = g.rows.slice(0, Math.max(0, left));
      left -= rows.length;
      return rows.length ? [{ ...g, rows }] : [];
    });
  }, [groups, limit]);
  const shownKey = shown.map((g) => g.rows.map((x) => x.f.slug).join(',')).join('|');

  // scores of the rows on show, staged in idle time; kept per fitter so "Show more" scores only the new rows
  const [scores, setScores] = useState<{ for: Fitter | null; by: ReadonlyMap<string, Scored | null> }>({ for: null, by: new Map() });
  const cache = useRef<{ for: Fitter | null; by: Map<string, Scored | null> }>({ for: null, by: new Map() });
  const [late, setLate] = useState<string | null>(null);
  useEffect(() => {
    if (!fitter) return;
    if (cache.current.for !== fitter) cache.current = { for: fitter, by: new Map() };
    const by = cache.current.by;
    const todo = shown.flatMap((g) => g.rows).filter((x) => !x.on && x.day !== null && x.row.cand && !by.has(x.f.slug));
    const publish = () => setScores({ for: fitter, by: new Map(by) });
    if (!todo.length) {
      queueMicrotask(publish);
      return;
    }
    const stop = runStaged(
      todo,
      (x) => scoreDays(x.near.map((d) => ({ ...d, fit: fitter.fit(x.row.cand!, d.n) }))),
      (done) => {
        for (const [x, r] of done) by.set(x.f.slug, r);
        publish();
      },
    );
    const timer = window.setTimeout(() => setLate(shownKey), TRIP_EDIT_UI.parkFitWaitMs);
    return () => {
      stop();
      window.clearTimeout(timer);
    };
    // the rows on show stand for `shown`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitter, shownKey]);

  const add = (x: Member, day: number) => {
    const r = x.row;
    if (!r.cand || !r.slug) return;
    if (!p.model.addables[r.slug]) p.register(r.cand);
    const label = `Added ${r.name} to Day ${day}`;
    if (p.commit([addPlaceOp(p.doc, dayRef(p.doc, day), r.slug, r.name, newOpId())], label)) setLast({ label });
  };

  if (pick) {
    return (
      <OnePlace
        place={pick}
        fitter={fitter}
        p={p}
        back={
          <Button size="sm" variant="ghost" className="add-back" onClick={() => setPick(null)}>
            <Icon name="chevronLeft" size={14} /> Back to {park.name}
          </Button>
        }
      />
    );
  }

  const total = list?.length ?? 0;
  const left = groups ? groups.count - shown.reduce((n, g) => n + g.rows.length, 0) : 0;
  return (
    <div className="add-picker">
      <div className="add-head">
        <Pinned f={park}><p className="add-pin-note">A park is not a stop. Pick a place in it.</p></Pinned>
        {total > PARK_PAGE ? (
          <div className="add-search">
            <Icon name="search" size={16} />
            <input type="search" className="input add-q" placeholder={`Search ${total} places`} aria-label={`Search the places in ${park.name}`} value={q} onChange={(e) => { setQ(e.target.value); setLimit(PARK_PAGE); }} />
          </div>
        ) : null}
      </div>
      <div className="add-groups">
        {far ? <FarLine f={park} p={p} /> : null}
        {last ? (
          <p className="add-added" role="status">
            {last.label}.{' '}
            {p.undoLabel === last.label ? <button type="button" className="add-undo" onClick={() => { p.undo(); setLast(null); }}>Undo</button> : null}
          </p>
        ) : null}
        {!far && !list ? <p className="add-empty" role="status">{members.status === 'off' ? 'Places in this park are not available just now.' : 'Looking for places in the park'}</p> : null}
        {list && !list.length ? <p className="add-empty">We hold no places in {park.name} yet.</p> : null}
        {groups && list?.length && !groups.count ? <p className="add-empty">Nothing in {park.name} matches &quot;{q.trim()}&quot;.</p> : null}
        {shown.length ? (
          <section className="add-group" aria-labelledby="add-h-members">
            <h3 id="add-h-members" className="add-h">In {park.name}</h3>
            {shown.map((g) => (
              <div key={g.key} className="add-sub" role="group" aria-label={g.label}>
                {groups && groups.all.length > 1 ? <h4 className="add-subh">{g.label}</h4> : null}
                <ul className="add-list">
                  {g.rows.map((x) => {
                    const scored = scores.for === fitter ? scores.by.get(x.f.slug) : undefined;
                    const timedOut = late === shownKey && scored === undefined;
                    if (x.on || x.day === null || !x.row.cand) {
                      return <PickRowView key={x.row.key} row={x.row} day={x.day ?? 1} fit={null} waiting={false} done={null} fmt={fmt} newTrip={newTripHref} full={null} showKids={false} onAct={() => undefined} move={false} noAct />;
                    }
                    if (scored === undefined && !timedOut) {
                      return <PickRowView key={x.row.key} row={x.row} day={x.day} fit={null} waiting done={null} fmt={fmt} newTrip={newTripHref} full={null} showKids={false} onAct={() => setPick(x.f)} label="Pick a day" actAria={`Pick a day for ${x.row.name}`} />;
                    }
                    const w = scored ? scoredWords(scored) : null;
                    if (!w || w.day === null) {
                      return <PickRowView key={x.row.key} row={x.row} day={x.day} fit={scored?.nearest.fit ?? null} waiting={false} done={null} fmt={fmt} newTrip={newTripHref} full={null} showKids={false} onAct={() => setPick(x.f)} line={w ? w.line : 'Pick a day to see how it fits'} label="Pick a day" actAria={`Pick a day for ${x.row.name}`} />;
                    }
                    const day = w.day;
                    return <PickRowView key={x.row.key} row={x.row} day={day} fit={scored!.best!.fit} waiting={false} done={null} fmt={fmt} newTrip={newTripHref} full={null} showKids={false} onAct={() => add(x, day)} line={w.line} label={w.button} actAria={`Add ${x.row.name} to Day ${day}`} />;
                  })}
                </ul>
              </div>
            ))}
            {left > 0 ? <Button size="sm" variant="ghost" className="add-more" onClick={() => setLimit((n) => n + PARK_PAGE)}>Show {Math.min(left, PARK_PAGE)} more</Button> : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
