'use client';

import { useEffect, useMemo, useState } from 'react';
import { revealEntry } from '../revealEntry';
import { fmtHM } from '@travel/core/schedule/rules.ts';
import type { DayTimeline as DayTimelineData, Profile, ScheduleItem, TimelineEntry } from '@travel/core/schedule/types.ts';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Chip } from '@/components/ui/Chip';
import { DaySign } from '@/components/ui/DaySign';
import { Icon, type IconName } from '@/components/ui/Icon';
import { VariantMenu, type MenuEntry } from './VariantMenu';
import { Segmented } from '@/components/ui/Segmented';
import { imageSrcSet, sizedImage } from '@/lib/format/image';
import { usePrefs } from '@/lib/format/prefs';
import { formatDistance } from '@/lib/format/units';
import { AddToDay } from './AddToDay';
import { Entry, LegRow } from './Entry';
import { chipsFor, honestyLabel } from './labels';
import { diffTimelines } from '@travel/core/schedule/diff.ts';
import type { AddCandidate, TimelineDayModel } from './model';
import { Prose } from './Prose';
import { variantLine, type VariantLine } from './consequence';
import { flightEntries, localEntries, zoneNotes, zoneRun } from './marks';
import type { Engine } from './useTimeline';
import { dayReason, useTripSuit } from '@/components/suit/TripSuit';

interface Props {
  day: TimelineDayModel;
  tl: DayTimelineData;
  picked: boolean;
  changed: boolean;
  candidates: AddCandidate[];
  taken: string[];
  /** The youngest's age when the profile is a family, for the no-fit line. */
  age: number | null;
  onSplit: (on: boolean) => void;
  onVariant: (key: string | null) => void;
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  /** key of an added place for an added entry id */
  addedKeys: Map<string, string>;
  /** What the add panel and the version menu work out costs from. */
  engine: Engine | null;
  loadEngine: () => void;
  profile: Profile;
  /** The version the visitor picked for this day, or null for the one the profile chose. */
  override: string | null;
  addedItems: ScheduleItem[];
  /** Position among the days: the cross-fade staggers the first five. */
  index: number;
}

/** "Sunrise 07:05 to 07:27 · Sunset 19:43 to 20:16" from the day's light sentence (spec 3.2, I12): each range carries its word, never a bare glyph. */
export function sunShort(light: string | null): string | null {
  const m = /Sunrise about (\d\d:\d\d) to (\d\d:\d\d), sunset about (\d\d:\d\d) to (\d\d:\d\d)/.exec(light ?? '');
  return m ? `Sunrise ${m[1]} to ${m[2]} · Sunset ${m[3]} to ${m[4]}` : null;
}

/** The word beside a last start the data gives: a lift has a last ride, a boat a last rental. */
function lastStart(item: ScheduleItem | undefined): string | null {
  const t = item?.window?.lastUp;
  if (!t) return null;
  return `${item?.sub === 'lift-ride' ? 'Last ride up' : item?.sub === 'boat' ? 'Last rental' : 'Last start'} ${t}`;
}

const KNOW_VISIBLE = 3;

/** "Copy link to this day": the day's anchor with the profile, versions and additions the visitor is looking at. */
function DayLink({ day }: { day: number }) {
  const { toast } = useToast();
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}${window.location.search}#day-${day}`);
          toast({ message: `Link to day ${day} copied` });
        } catch {
          toast({ message: 'Could not copy the link' });
        }
      }}
    >
      <Icon name="link" size={14} /> Copy link to this day
    </Button>
  );
}

/** One day as a timeline (design 4): header, totals and warnings, the entries on a time rail, add to this day, Know before you go. */
export function DayTimeline({ day, tl, picked, changed, candidates, taken, age, onSplit, onVariant, onAdd, onRemove, addedKeys, engine, loadEngine, profile, override, addedItems, index }: Props) {
  const [prefs] = usePrefs();
  const { toast } = useToast();
  // SW-013: an addition says so, offers Undo, and scrolls to the new row once the scheduler has placed it
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const add = (key: string) => {
    const c = candidates.find((x) => x.key === key);
    onAdd(key);
    setJustAdded(c?.name ?? null);
    toast({ message: `Added ${c?.name ?? 'a place'} to Day ${day.n}`, actionLabel: 'Undo', onAction: () => { setJustAdded(null); onRemove(key); } });
  };
  const suitCtx = useTripSuit();
  const [knowOpen, setKnowOpen] = useState(false);
  const [lane, setLane] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreSummary, setMoreSummary] = useState(false);
  // "moved 40 min later" after an addition, for one viewing: state adjusted while rendering, cleared by a timer
  const [snap, setSnap] = useState<{ tl: DayTimelineData; added: number; moved: Map<string, number>; gone: string[] }>({ tl, added: taken.length, moved: new Map(), gone: [] });
  // a link that arrives with additions in it is not an addition made now: the first moments after load show no "moved" notes
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 1500);
    return () => window.clearTimeout(id);
  }, []);
  if (tl !== snap.tl) {
    const d = ready && taken.length > snap.added ? diffTimelines(snap.tl, tl) : null;
    setSnap({ tl, added: taken.length, moved: d ? d.moved : snap.moved, gone: d ? d.gone.map((e) => e.title) : snap.gone });
  }
  useEffect(() => {
    if (!snap.moved.size && !snap.gone.length) return;
    const t = window.setTimeout(() => setSnap((s) => ({ ...s, moved: new Map(), gone: [] })), 6000);
    return () => window.clearTimeout(t);
  }, [snap.moved, snap.gone]);

  // one value for the visible line, its title and the version button's name: a day never says "fits" in one place and "not suited" in another
  const reasonText = tl.variant.reason ? dayReason(tl.variant.reason, tl.variant.label, tl.entries, suitCtx) : '';
  const sel = day.variants.find((v) => v.key === tl.variant.key);
  const title = sel?.title ?? day.title;
  const showSummary = !sel || sel.key === 'B' || sel.key === 'main';
  const warnByEntry = useMemo(() => {
    const m = new Map<string, DayTimelineData['warnings']>();
    for (const w of tl.warnings) if (w.entryId) m.set(w.entryId, [...(m.get(w.entryId) ?? []), w]);
    return m;
  }, [tl.warnings]);
  const dayWarnings = tl.warnings.filter((w) => !w.entryId || !tl.entries.some((e) => e.id === w.entryId));
  const nWarn = tl.warnings.length;
  const fixed = tl.entries.filter((e) => e.time.confidence === 'fixed' && e.kind !== 'booking' && e.kind !== 'leg').length;
  const est = tl.entries.some((e) => e.kind === 'leg' && e.leg?.basis !== 'routed' && e.leg?.mode === 'drive');
  const split = tl.lanes.length > 1;
  const partyLane = tl.lanes[0] ?? 'all';
  const activeLane = lane ?? partyLane;
  const know = [...(sel?.notes.know ?? []), ...day.know];
  const knowCount = know.reduce((n, g) => n + g.bullets.length, 0);
  const lead = sel?.notes.lead ?? null;
  // display only: a time-zone line and a flight change what the clock says, never the scheduled day
  const entries = useMemo(() => localEntries(flightEntries(tl.entries, day.flight), day.zone), [tl.entries, day.flight, day.zone]);
  useEffect(() => {
    if (!justAdded) return;
    const hit = tl.entries.find((e) => e.addedBy === 'visitor' && e.title === justAdded);
    if (!hit) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: the new row is found, so the request is done
    setJustAdded(null);
    window.requestAnimationFrame(() => revealEntry(`${hit.day}:${hit.id}`));
  }, [justAdded, tl.entries]);
  const run = useMemo(() => (day.zone ? zoneRun(tl.entries, day.zone) : null), [tl.entries, day.zone]);
  const items = useMemo(() => new Map(day.input.variants.flatMap((v) => v.items).map((i) => [i.id, i])), [day.input]);
  const sun = sunShort(day.light);
  const noFit = tl.notes.find((n) => n.kind === 'no-fit');
  const splitOpt = tl.notes.find((n) => n.kind === 'split-option');
  // what each version would do to this day for this party, from the scheduler; worked out only while the menu is open
  const lines = useMemo(() => {
    const out = new Map<string, VariantLine>();
    if (!menuOpen) return out;
    out.set(tl.variant.key, variantLine(tl, prefs.distance));
    if (engine) for (const v of day.variants) if (v.key !== tl.variant.key) out.set(v.key, variantLine(engine.scheduleDay(day.input, profile, { variant: v.key, added: addedItems }), prefs.distance));
    return out;
  }, [menuOpen, engine, tl, day.variants, day.input, profile, addedItems, prefs.distance]);
  const menu: MenuEntry[] = day.variants.map((v) => ({
    label: `${v.label}${v.key === tl.variant.key ? (tl.variant.chosenBy === 'override' ? ' (picked)' : ' (chosen for your settings)') : ''}`,
    detail: lines.get(v.key)?.line ?? null,
    warn: lines.get(v.key)?.warn ?? null,
    onSelect: () => onVariant(v.key),
  }));
  if (tl.variant.chosenBy === 'override') menu.push({ label: 'Back to the version chosen for your settings', onSelect: () => onVariant(null) });

  return (
    <li id={`day-${day.n}`} className="tl-day" style={{ '--i': Math.min(index, 4) } as React.CSSProperties} data-picked={picked || undefined} data-changed={changed || undefined}>
      <header className="tl-day-head">
        <span className="tl-thumb" aria-hidden="true">
          {day.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- static export, remote Commons URLs
            <img src={sizedImage(day.thumb.url, 192)} srcSet={imageSrcSet(day.thumb.url)} sizes="96px" alt="" width={192} height={136} loading="lazy" decoding="async" />
          ) : (
            <Icon name={day.glyph as IconName} size={26} />
          )}
        </span>
        <div className="tl-day-main">
          <div className="tl-day-top">
            <DaySign n={day.n} state={picked ? 'focused' : 'quiet'} size="s" />
            {day.base ? <span className="tl-day-base num">{day.base}</span> : null}
            {tl.span.minutes > 0 && !tl.blocks ? <span className="tl-day-span num">{tl.span.start} to {tl.span.end}</span> : null}
            {sun ? <span className="tl-day-sun num" title={day.light ?? undefined} aria-label={day.light ?? undefined}><Icon name="sun" size={13} /> {sun}</span> : null}
            <span className="tl-day-chip" data-print="hide">
              {day.variants.length > 1 ? (
                <VariantMenu
                  label={tl.variant.label}
                  ariaLabel={`Version of Day ${day.n}: ${tl.variant.label}. ${reasonText}`}
                  entries={menu}
                  onOpenChange={(o) => { setMenuOpen(o); if (o) loadEngine(); }}
                />
              ) : null}
              {changed ? (
                <span className="tl-changed">
                  Changed for this day · <button type="button" className="tl-reset" onClick={() => onVariant(null)}>Reset</button>
                </span>
              ) : null}
            </span>
          </div>
          <h3 className="tl-day-title">{title}</h3>
          <p className="tl-day-totals num">
            {tl.totals.driveMin > 0 ? (
              <span title={est ? 'Includes estimated drive times' : undefined} data-est={est || undefined}>
                <Icon name="car" size={13} /> {est ? '≈' : ''}{fmtHM(tl.totals.driveMin)} driving
              </span>
            ) : null}
            <span>{tl.totals.walkKm > 0 ? `${formatDistance(tl.totals.walkKm, prefs.distance)} walking` : 'No walk planned'}</span>
            {fixed > 0 ? <span>{fixed} fixed {fixed === 1 ? 'slot' : 'slots'}</span> : null}
            {nWarn > 0 ? <span className="tl-warn-count"><Icon name="warn" size={13} /> {nWarn} {nWarn === 1 ? 'warning' : 'warnings'}</span> : null}
          </p>
          {day.light ? <p className="tl-day-light num"><Icon name="sun" size={13} /> {day.light}</p> : null}
        </div>
      </header>

      <div className="tl-day-body">
        {reasonText && day.variants.length > 1 ? <p className="tl-reason num" title={reasonText}><Prose text={reasonText} /></p> : null}
        {noFit ? (
          <p className="tl-nofit" role="note">
            <Icon name="warn" size={15} /> <span>
              <b>{age !== null ? `Not suited to age ${age}.` : 'Not suited to this setting.'}</b> <Prose text={noFit.text} />.
            </span>
          </p>
        ) : null}
        {day.summary && showSummary ? (
          <p className="tl-summary" data-open={moreSummary || undefined}>
            <Prose text={day.summary} />{' '}
            <button type="button" className="tl-reset tl-summary-more" aria-expanded={moreSummary} onClick={() => setMoreSummary((v) => !v)}>{moreSummary ? 'Show less' : 'Show all'}</button>
          </p>
        ) : null}
        {lead ? (
          <p className="tl-lead">
            <Prose text={lead.plain} /> {chipsFor(lead.plain, lead.chips).map((c) => <Chip key={c} kind="honest" icon={false}>{honestyLabel(c)}</Chip>)}
          </p>
        ) : null}
        {dayWarnings.length ? (
          <ul className="tl-day-warns">
            {dayWarnings.map((w) => (
              <li key={`${w.code}:${w.message}`} className="tl-warn" data-code={w.code}>
                <Icon name="warn" size={14} /> <Prose text={w.message} />
              </li>
            ))}
          </ul>
        ) : null}
        {splitOpt ? (
          <p className="tl-split" data-quiet={/^Optional/.test(splitOpt.text) || undefined}>
            <Icon name="trail" size={15} /> <Prose text={splitOpt.text} />
            <button type="button" className="btn btn-sm tl-split-btn" data-print="hide" onClick={() => onSplit(true)}>Show both lanes</button>
          </p>
        ) : null}
        {split ? (
          <div className="tl-lane-bar" data-print="hide">
            <button type="button" className="btn btn-sm tl-split-btn" onClick={() => onSplit(false)}>Show one lane</button>
          </div>
        ) : null}
        {split ? (
          <div className="tl-lane-toggle" data-print="hide">
            <Segmented
              label={`Lanes of Day ${day.n}`}
              size="s"
              value={activeLane}
              onChange={setLane}
              segments={tl.lanes.map((l, i) => ({ value: l, label: i === 0 ? 'Together' : 'The longer walk' }))}
            />
          </div>
        ) : null}
        <ol className="tl-rail" data-lanes={split ? tl.lanes.length : 1} aria-label={`Day ${day.n} in time order`}>
          {split ? (
            <li className="tl-lane-head" aria-hidden="true">
              <span className="tl-lane-name" data-lane={partyLane}>{tl.variant.label}</span>
              <span className="tl-lane-name" data-lane={tl.lanes[1]}>{`The stronger walkers: ${entries.find((e) => e.lane === tl.lanes[1] && e.kind === 'trail')?.title ?? 'a longer walk'}`}</span>
            </li>
          ) : null}
          {entries.map((e: TimelineEntry, i: number) => [
            day.zone && run && i === run.from ? <ZoneRow key={`z-in-${day.n}`} text={zoneNotes(day.zone).enter} /> : null,
            day.zone && run && i === run.back ? <ZoneRow key={`z-out-${day.n}`} text={zoneNotes(day.zone).back} /> : null,
            e.kind === 'leg' && !tl.blocks ? (
              <LegRow key={e.id} e={e} />
            ) : (
              <Entry
                key={e.id}
                entry={e}
                last={lastStart(e.sourceItemId ? items.get(e.sourceItemId) : undefined)}
                warnings={warnByEntry.get(e.id) ?? []}
                moved={snap.moved.get(e.id) ?? null}
                onRemove={e.addedBy === 'visitor' && addedKeys.has(e.id) ? () => onRemove(addedKeys.get(e.id)!) : undefined}
                laneOff={split && e.lane !== 'all' && e.lane !== activeLane}
              />
            ),
          ])}
        </ol>
        {(tl.blocks ? tl.entries.length === 0 : tl.entries.length <= 2) ? <p className="tl-empty">No stops are planned for this day yet.</p> : null}
        {snap.gone.length ? <p className="tl-gone num" role="status">Left out now there is less room: {snap.gone.join(', ')}.</p> : null}
        <AddToDay day={day.n} candidates={candidates} taken={taken} onAdd={add} engine={engine} loadEngine={loadEngine} input={day.input} profile={profile} variant={override} added={addedItems} />
        <div className="tl-day-foot" data-print="hide">
          {knowCount > 0 ? (
            <button type="button" className="btn btn-sm btn-ghost tl-know-btn" aria-expanded={knowOpen} aria-controls={`know-${day.n}`} onClick={() => setKnowOpen((v) => !v)}>
              <Icon name="chevronDown" size={14} /> Know before you go · {knowCount}
            </button>
          ) : null}
          <span data-day-link={day.n}>
            <DayLink day={day.n} />
          </span>
        </div>
        {knowCount > 0 ? (
          <div id={`know-${day.n}`} className="tl-know" hidden={!knowOpen}>
            {knowOpen ? <KnowList groups={know} /> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** The line where the clock changes: a row on the rail, between two entries, that is not an entry. */
function ZoneRow({ text }: { text: string }) {
  return (
    <li className="tl-zone">
      <span className="tl-time" aria-hidden="true" />
      <span className="tl-node" aria-hidden="true" />
      <p className="tl-zone-text"><Icon name="clock" size={14} /> <span>{text}</span></p>
    </li>
  );
}

function KnowList({ groups }: { groups: TimelineDayModel['know'] }) {
  const [all, setAll] = useState(false);
  const flat = groups.flatMap((g) => g.bullets.map((b) => ({ group: g.group, b })));
  const shown = all ? flat : flat.slice(0, KNOW_VISIBLE);
  const rows: { group: string; items: typeof flat }[] = [];
  for (const x of shown) {
    const last = rows[rows.length - 1];
    if (last && last.group === x.group) last.items.push(x);
    else rows.push({ group: x.group, items: [x] });
  }
  return (
    <div className="tl-know-in">
      {rows.map((r) => (
        <section key={r.group}>
          <h4 className="tl-know-h">{r.group}</h4>
          <ul>
            {r.items.map(({ b }, i) => (
              <li key={i}>
                <Prose text={b.plain} /> {chipsFor(b.plain, b.chips).map((c) => <Chip key={c} kind="honest" icon={false}>{honestyLabel(c)}</Chip>)}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {flat.length > KNOW_VISIBLE ? (
        <button type="button" className="tl-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? 'Fewer' : `${flat.length - KNOW_VISIBLE} more`}
        </button>
      ) : null}
    </div>
  );
}
