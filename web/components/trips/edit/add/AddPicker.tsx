'use client';

// The add-a-place picker (STEP2-E3; edit-mode-spec 7; patterns 3.13 item 6): one sheet for "Add a place to Day n" (a bottom sheet on a
// phone, the 460 px side sheet from 640 px) and for the `add=<slug>` arrival from a park or place page. It is its own chunk: it loads on the
// first press of an add row, never at page start (the /t/ start JS stays inside TRIP_EDIT_JS_BUDGET_KB).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ADD_NEARBY_KM } from '@travel/core/config/nearby.ts';
import { dayCapMin, fmtHM } from '@travel/core/schedule/rules.ts';
import type { Profile } from '@travel/core/schedule/types.ts';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SideSheet } from '@/components/ui/SideSheet';
import type { AddCandidate, TimelineModel } from '@/components/trips/timeline/model';
import { PAGE_SIZE, TRIP_EDIT_UI } from '@/lib/config/product';
import { usePrefs } from '@/lib/format/prefs';
import { formatDistance } from '@/lib/format/units';
import { dayDate } from '@/lib/trip-edit/moveFit';
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';
import { movedWords, moveToDayOps, newOpId } from '@/lib/trip-edit/stopOps';
import { usePhone } from '../panel/useMatchMedia';
import { Arrival } from './Arrival';
import type { Fit } from './fit';
import { PickRowView } from './PickRowView';
import { anyRows, buildSections, centreOf, daysByDistance, titleWords, withGhosts, type Chips, type Ghost, type GroupId, type PickRow } from './rows';
import { apiAvailable, newTripHref } from './source';
import { useDebounced, useFitter, useNearRows, useRowsOf, useSearchRows } from './useAdd';

export interface PickerProps {
  doc: PlanDraft;
  model: TimelineModel;
  profile: Profile;
  start: string | null;
  /** the day the picker adds to; null for an arrival with a place (`slug`) that names the days itself */
  day: number | null;
  slug: string | null;
  onClose: () => void;
  /** one undo step with its toast; false when it could not be made */
  commit: (ops: PlanOp[], label: string, opts?: { toast?: boolean }) => boolean;
  /** a place the document is about to name that the plan model does not carry, so the timeline can schedule it */
  register: (c: AddCandidate) => void;
  undo: () => void;
  undoLabel: string | null;
}

interface Done {
  label: string;
  kind: 'add' | 'move' | 'back';
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** The month a dated trip's day falls in (1 to 12), or null for an undated trip. */
export function monthOf(start: string | null, day: number): number | null {
  if (!start) return null;
  const t = new Date(`${start}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + day - 1);
  return t.getUTCMonth() + 1;
}

const firstPages = (): Record<GroupId, number> => ({ versions: PAGE_SIZE.list, removed: PAGE_SIZE.list, maybe: PAGE_SIZE.list, trip: PAGE_SIZE.list, near: PAGE_SIZE.list, search: PAGE_SIZE.list });

/** The sheet: a bottom sheet on a phone, the side sheet from 640 px. */
export function AddPicker(p: PickerProps) {
  const phone = usePhone();
  const title = p.day !== null ? titleWords(p.day) : 'Add a place';
  const body = p.day !== null ? <DayPicker {...p} day={p.day} /> : <Arrival {...p} />;
  const change = (o: boolean) => {
    if (!o) p.onClose();
  };
  return phone ? (
    <BottomSheet open onOpenChange={change} title={title} snaps={['full']} initial="full" className="add-sheet">
      {body}
    </BottomSheet>
  ) : (
    <SideSheet open onOpenChange={change} title={title} modal="trap-focus" className="add-sheet">
      {body}
    </SideSheet>
  );
}

/** What each row's button did, and the words under the day's name. */
function DayPicker(p: PickerProps & { day: number }) {
  const { doc, model, day, commit, register } = p;
  const [prefs] = usePrefs();
  const fmt = useCallback((km: number) => formatDistance(km, prefs.distance), [prefs.distance]);
  const fitter = useFitter(doc, model, p.profile);
  const centre = centreOf(model, day);
  const near = useNearRows(centre);
  const youngest = p.profile.party === 'family' ? p.profile.youngest : null;
  const month = monthOf(p.start, day);
  const [q, setQ] = useState('');
  const words = useDebounced(q, TRIP_EDIT_UI.addSearchMs);
  const search = useSearchRows(words);
  const [chips, setChips] = useState<Chips>({ rainy: false, kids: youngest !== null, month: null });
  const [limit, setLimit] = useState(firstPages);
  const [done, setDone] = useState<Record<string, Done>>({});
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const maybeSlugs = useMemo(() => (doc.template?.maybe ?? []).map((m) => m.ref.replace(/^place\//, '')).filter((s) => !model.addables[s]), [doc, model]);
  const maybeRows = useRowsOf(maybeSlugs);
  const searchBox = useRef<HTMLInputElement>(null);

  // `/` focuses the search field (edit-mode-spec 7.1)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      searchBox.current?.focus();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const sections = useMemo(() => {
    if (!fitter) return null;
    const live = buildSections({
      doc, model, day, onTrip: fitter.onTrip, youngest, near: near.status === 'ok' ? near.rows : null, q, search: words.trim().length >= 2 && search.status === 'ok' ? search.rows : null,
      chips: { ...chips, month: chips.month !== null ? month : null }, maybe: maybeRows ?? [], limit, keep: new Set(Object.keys(done)),
    });
    return live;
  }, [fitter, doc, model, day, youngest, near.status, near.rows, q, words, search.status, search.rows, chips, month, maybeRows, limit, done]);
  const liveKeys = useMemo(() => new Set((sections ?? []).flatMap((s) => s.rows.map((r) => r.key))), [sections]);
  const shownSections = useMemo(() => (sections ? withGhosts(sections, ghosts.filter((g) => done[g.row.key])) : null), [sections, ghosts, done]);

  // the day's words for each row on show: one at a time, so the sheet opens at once
  const [fits, setFits] = useState<{ for: unknown; by: Record<string, { fit: Fit; tryDay: number | null }> }>({ for: null, by: {} });
  useEffect(() => {
    if (!fitter || !shownSections) return;
    let live = true;
    const todo = shownSections.flatMap((s) => s.rows).filter((r) => r.cand && !r.far && !r.here && !r.on && !r.back);
    const by: Record<string, { fit: Fit; tryDay: number | null }> = {};
    const step = (i: number) => {
      if (!live) return;
      const r = todo[i];
      if (!r) return;
      const f = fitter.fit(r.cand!, day);
      let tryDay: number | null = null;
      if (f.state === 'full' && r.cand!.point) {
        for (const d of daysByDistance(model, r.cand!.point).filter((x) => x.n !== day).slice(0, 3)) {
          if (fitter.fit(r.cand!, d.n).state !== 'full') {
            tryDay = d.n;
            break;
          }
        }
      }
      by[r.key] = { fit: f, tryDay };
      setFits({ for: fitter, by: { ...by } });
      window.setTimeout(() => step(i + 1), 0);
    };
    step(0);
    return () => {
      live = false;
    };
    // the rows on show and the fitter stand for every input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitter, shownSections?.map((s) => s.rows.map((r) => r.key).join()).join('|')]);
  const fitOf = (r: PickRow) => (fits.for === fitter ? (fits.by[r.key] ?? null) : null);

  const act = (r: PickRow) => {
    if (!fitter) return;
    let ops: PlanOp[];
    let label: string;
    let kind: Done['kind'] = 'add';
    if (r.back) {
      ops = r.back.ops(newOpId);
      label = r.back.label;
      kind = 'back';
      if (r.cand && r.slug && !model.addables[r.slug]) register(r.cand);
    } else if (r.on) {
      ops = moveToDayOps(doc, r.on.entry, day, fitter.lastStop(day));
      label = movedWords(r.on.entry, day);
      kind = 'move';
    } else if (r.cand && r.slug) {
      if (!model.addables[r.slug]) register(r.cand);
      ops = [{ kind: 'addPlace', id: newOpId(), day, ref: `place/${r.slug}` }];
      label = `Added ${r.name} to Day ${day}`;
    } else return;
    if (!commit(ops, label)) return;
    setDone((d) => ({ ...d, [r.key]: { label, kind } }));
    if (r.back) {
      const s = sections?.find((x) => x.rows.some((y) => y.key === r.key));
      if (s) setGhosts((g) => [...g.filter((x) => x.row.key !== r.key), { id: s.id, index: s.rows.findIndex((y) => y.key === r.key), row: r }]);
    }
  };
  const doneOf = (r: PickRow): { undo: (() => void) | null } | null => {
    const d = done[r.key];
    if (!d) return null;
    const valid = d.kind === 'back' ? !liveKeys.has(r.key) : r.here;
    if (!valid) return null;
    return { undo: p.undoLabel === d.label ? () => { p.undo(); setDone((x) => { const n = { ...x }; delete n[r.key]; return n; }); } : null };
  };

  const d = model.days.find((x) => x.n === day);
  const was = fitter?.base.get(day);
  const free = was && !was.blocks ? Math.max(0, dayCapMin(p.profile) - was.span.minutes) : null;
  const meta = [d?.base ? `Base: ${d.base}` : null, free !== null && free > 0 ? `${fmtHM(free)} free` : null, dayDate(p.start, day)].filter(Boolean).join(' · ');
  const more = (id: GroupId) => {
    const s = shownSections?.find((x) => x.id === id);
    if (s && s.more > 0) setLimit((l) => ({ ...l, [id]: l[id] + PAGE_SIZE.list }));
    else if (id === 'near') near.more();
    else if (id === 'search') search.more();
  };
  const hasNext = (id: GroupId): boolean => (id === 'near' ? near.next !== null : id === 'search' ? search.next !== null : false);
  const loading = !shownSections || (apiAvailable() && near.status === 'loading');
  const typed = q.trim().length >= 2;

  return (
    <div className="add-picker">
      <div className="add-head">
        {meta ? <p className="add-meta num">{meta}</p> : null}
        <div className="add-search">
          <Icon name="search" size={16} />
          <input ref={searchBox} type="search" className="input add-q" placeholder="Search places" aria-label="Search places to add" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="add-chips" role="group" aria-label="Narrow the places">
          <button type="button" className="add-chip" aria-pressed={chips.rainy} onClick={() => setChips((c) => ({ ...c, rainy: !c.rainy }))}>Rainy day</button>
          {youngest !== null ? <button type="button" className="add-chip" aria-pressed={chips.kids} onClick={() => setChips((c) => ({ ...c, kids: !c.kids }))}>Kids</button> : null}
          {month !== null ? <button type="button" className="add-chip" aria-pressed={chips.month !== null} onClick={() => setChips((c) => ({ ...c, month: c.month === null ? month : null }))}>Open in {MONTHS[month - 1]}</button> : null}
        </div>
      </div>
      <div className="add-groups">
        {loading ? <p className="add-empty" role="status">Loading places</p> : null}
        {shownSections?.map((s) => (
          <section key={s.id} className="add-group" aria-labelledby={`add-h-${s.id}`}>
            <h3 id={`add-h-${s.id}`} className="add-h">{s.label}</h3>
            <ul className="add-list">
              {s.rows.map((r) => {
                const f = fitOf(r);
                return <PickRowView key={r.key} row={r} day={day} fit={f?.fit ?? null} waiting={!f} done={doneOf(r)} fmt={fmt} newTrip={newTripHref} full={f?.tryDay ? String(f.tryDay) : null} showKids={youngest !== null} onAct={act} />;
              })}
            </ul>
            {s.more > 0 || hasNext(s.id) ? (
              <Button size="sm" variant="ghost" className="add-more" onClick={() => more(s.id)}>
                {s.more > 0 ? `Show ${Math.min(s.more, PAGE_SIZE.list)} more` : 'Show more'}
              </Button>
            ) : null}
          </section>
        ))}
        {typed && search.status === 'loading' ? <p className="add-empty" role="status">Searching</p> : null}
        {typed && search.status === 'off' ? <p className="add-empty">Search is not available just now.</p> : null}
        {!loading && shownSections && !anyRows(shownSections) && !(typed && search.status === 'loading') ? (
          <p className="add-empty">
            {typed ? `Nothing matches "${q.trim()}".` : near.status === 'off' && !centre ? "Nearby places need this day's base location; it is not researched yet." : `Nothing we hold near ${d?.base ?? 'here'} fits. Try search or another day.`}
          </p>
        ) : null}
        <p className="add-foot num">Within {ADD_NEARBY_KM} km of the day. Drive times are estimates.</p>
      </div>
    </div>
  );
}
