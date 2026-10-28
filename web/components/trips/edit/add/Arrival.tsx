'use client';

// The picker when a place or park page sends a place (`/t/<id>/?edit=1&add=<slug>`, edit-mode-spec 7.4; README rulings M3 and C5): the place
// pinned at the top and one row per day, best fit first. A park is never a stop, so a park slug opens its members instead; a place or
// park beyond ADD_PIN_FAR_KM of every base offers only "Start a new trip with ...", never a day.
import { useEffect, useMemo, useState } from 'react';
import { ADD_NEARBY_KM, AREA_DEFAULT_R } from '@travel/core/config/nearby.ts';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { KindGlyph } from '@/components/ui/KindGlyph';
import type { AddCandidate } from '@/components/trips/timeline/model';
import { PAGE_SIZE } from '@/lib/config/product';
import { usePrefs } from '@/lib/format/prefs';
import { formatDistance } from '@/lib/format/units';
import { dayDate } from '@/lib/trip-edit/moveFit';
import { movedWords, moveToDayOps, newOpId } from '@/lib/trip-edit/stopOps';
import type { PlanOp } from '@/lib/trip-edit/model';
import type { Fit, Fitter } from './fit';
import type { PickerProps } from './AddPicker';
import { PickRowView } from './PickRowView';
import { candidateOf, kmBetween, type Found } from './place';
import { daysByDistance, farKmOf, rowOfFound, type PickRow } from './rows';
import { newTripHref, oneRow } from './source';
import { useFitter, useNearRows } from './useAdd';

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
  if (!got || got.slug !== slug) return <p className="add-empty" role="status">Looking up the place</p>;
  if (!got.found) return <p className="add-empty">{got.failed ? 'We could not look that place up just now. Try again in a moment.' : 'We do not have this place any more.'}</p>;
  return got.found.kind === 'area' ? <Park park={got.found} fitter={fitter} p={p} /> : <OnePlace place={got.found} fitter={fitter} p={p} />;
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
function OnePlace({ place: f, fitter, p }: { place: Found; fitter: Fitter | null; p: PickerProps }) {
  const [prefs] = usePrefs();
  const point = f.lat !== null && f.lon !== null ? { lat: f.lat, lon: f.lon } : null;
  const far = farKmOf(point, p.model) !== null;
  const cand = useMemo(() => candidateOf(f, null), [f]);
  const on = fitter?.onTrip.get(f.slug) ?? null;
  const rows = useMemo(() => (fitter && !far ? rankDays(fitter, p, cand) : null), [fitter, far, p, cand]);
  const [last, setLast] = useState<{ label: string; day: number } | null>(null);
  const [limit, setLimit] = useState<number>(PAGE_SIZE.list);
  const add = (day: number) => {
    if (!fitter) return;
    let ops: PlanOp[];
    let label: string;
    if (on) {
      ops = moveToDayOps(p.doc, on.entry, day, fitter.lastStop(day));
      label = movedWords(on.entry, day);
    } else {
      if (!p.model.addables[f.slug]) p.register(cand);
      ops = [{ kind: 'addPlace', id: newOpId(), day, ref: `place/${f.slug}` }];
      label = `Added ${f.name} to Day ${day}`;
    }
    if (p.commit(ops, label)) setLast({ label, day });
  };
  return (
    <div className="add-picker">
      <div className="add-head"><Pinned f={f} /></div>
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
                    <p className="add-fit num" data-fit={r.fit.state}>{on?.day === r.n ? 'It is here now' : r.fit.state === 'full' ? 'Day full' : r.fit.words}</p>
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

/** A park is never a stop: its members, those not on the trip first, each with the day nearest it. */
function Park({ park, fitter, p }: { park: Found; fitter: Fitter | null; p: PickerProps }) {
  const [prefs] = usePrefs();
  const fmt = (km: number) => formatDistance(km, prefs.distance);
  const centre = park.lat !== null && park.lon !== null ? { lat: park.lat, lon: park.lon } : null;
  const far = farKmOf(centre, p.model) !== null;
  const near = useNearRows(far ? null : centre, AREA_DEFAULT_R);
  const [last, setLast] = useState<{ label: string } | null>(null);
  const [limit, setLimit] = useState<number>(PAGE_SIZE.list);
  const rows = useMemo(() => {
    if (!fitter || near.status !== 'ok') return null;
    const list = near.rows.map((f) => {
      const pt = f.lat !== null && f.lon !== null ? { lat: f.lat, lon: f.lon } : null;
      const best = pt ? daysByDistance(p.model, pt)[0] : null;
      const day = best && best.km !== null && best.km <= ADD_NEARBY_KM ? best.n : null;
      const row: PickRow = rowOfFound(f, { model: p.model, onTrip: fitter.onTrip, day: day ?? 1 }, 'near');
      return { f, day, row: day === null && !row.on && !row.far ? { ...row, note: 'Not near any day of this trip' } : row };
    });
    return list.sort((a, b) => Number(!!a.row.on) - Number(!!b.row.on) || Number(a.day === null) - Number(b.day === null) || kmBetween(centre!, { lat: a.f.lat!, lon: a.f.lon! }) - kmBetween(centre!, { lat: b.f.lat!, lon: b.f.lon! }));
  }, [fitter, near.status, near.rows, p.model, centre]);
  const [fits, setFits] = useState<{ for: unknown; by: Record<string, Fit> }>({ for: null, by: {} });
  const shown = useMemo(() => (rows ?? []).slice(0, limit), [rows, limit]);
  useEffect(() => {
    if (!fitter) return;
    let live = true;
    const todo = shown.filter((x) => x.day !== null && !x.row.on && x.row.cand);
    const by: Record<string, Fit> = {};
    const step = (i: number) => {
      const x = todo[i];
      if (!live || !x) return;
      by[x.row.key] = fitter.fit(x.row.cand!, x.day!);
      setFits({ for: fitter, by: { ...by } });
      window.setTimeout(() => step(i + 1), 0);
    };
    step(0);
    return () => {
      live = false;
    };
  }, [fitter, shown]);
  const add = (x: { day: number | null; row: PickRow }) => {
    const r = x.row;
    if (!r.cand || !r.slug || x.day === null) return;
    if (!p.model.addables[r.slug]) p.register(r.cand);
    const label = `Added ${r.name} to Day ${x.day}`;
    if (p.commit([{ kind: 'addPlace', id: newOpId(), day: x.day, ref: `place/${r.slug}` }], label)) setLast({ label });
  };
  return (
    <div className="add-picker">
      <div className="add-head"><Pinned f={park}><p className="add-pin-note">A park is not a stop. Pick a place in it.</p></Pinned></div>
      <div className="add-groups">
        {far ? <FarLine f={park} p={p} /> : null}
        {last ? (
          <p className="add-added" role="status">
            {last.label}.{' '}
            {p.undoLabel === last.label ? <button type="button" className="add-undo" onClick={() => { p.undo(); setLast(null); }}>Undo</button> : null}
          </p>
        ) : null}
        {!far && !rows ? <p className="add-empty" role="status">{near.status === 'off' ? 'Places in this park are not available just now.' : 'Looking for places in the park'}</p> : null}
        {rows && !rows.length ? <p className="add-empty">We hold no places in {park.name} yet.</p> : null}
        {shown.length ? (
          <section className="add-group" aria-labelledby="add-h-members">
            <h3 id="add-h-members" className="add-h">In {park.name}</h3>
            <ul className="add-list">
              {shown.map((x) => {
                const fit = fits.for === fitter ? (fits.by[x.row.key] ?? null) : null;
                return <PickRowView key={x.row.key} row={x.row} day={x.day ?? 1} fit={fit} waiting={x.day !== null && !x.row.on} done={null} fmt={fmt} newTrip={newTripHref} full={null} showKids={false} onAct={() => add(x)} move={false} noAct={x.day === null} label={x.day !== null ? `Add to Day ${x.day}` : undefined} />;
              })}
            </ul>
            {rows && rows.length > limit ? <Button size="sm" variant="ghost" className="add-more" onClick={() => setLimit((n) => n + PAGE_SIZE.list)}>Show more</Button> : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
