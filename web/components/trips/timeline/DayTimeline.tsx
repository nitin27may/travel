'use client';

import { useEffect, useMemo, useState } from 'react';
import { fmtHM } from '@travel/core/schedule/rules.ts';
import type { DayTimeline as DayTimelineData, TimelineEntry } from '@travel/core/schedule/types.ts';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Chip } from '@/components/ui/Chip';
import { DaySign } from '@/components/ui/DaySign';
import { Icon } from '@/components/ui/Icon';
import { VariantMenu } from './VariantMenu';
import { Segmented } from '@/components/ui/Segmented';
import { imageSrcSet, sizedImage } from '@/lib/format/image';
import { usePrefs } from '@/lib/format/prefs';
import { formatDistance } from '@/lib/format/units';
import { AddToDay } from './AddToDay';
import { Entry, LegRow } from './Entry';
import { chipsFor, honestyLabel } from './labels';
import { movedEntries as moves, type AddCandidate, type TimelineDayModel } from './model';
import { Prose } from './Prose';

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
export function DayTimeline({ day, tl, picked, changed, candidates, taken, age, onSplit, onVariant, onAdd, onRemove, addedKeys }: Props) {
  const [prefs] = usePrefs();
  const [knowOpen, setKnowOpen] = useState(false);
  const [lane, setLane] = useState<string | null>(null);
  // "moved 40 min later" after an addition, for one viewing: state adjusted while rendering, cleared by a timer
  const [snap, setSnap] = useState<{ tl: DayTimelineData; added: number; moved: Map<string, number> }>({ tl, added: taken.length, moved: new Map() });
  // a link that arrives with additions in it is not an addition made now: the first moments after load show no "moved" notes
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 1500);
    return () => window.clearTimeout(id);
  }, []);
  if (tl !== snap.tl) setSnap({ tl, added: taken.length, moved: ready && taken.length > snap.added ? moves(snap.tl, tl) : snap.moved });
  useEffect(() => {
    if (!snap.moved.size) return;
    const t = window.setTimeout(() => setSnap((s) => ({ ...s, moved: new Map() })), 6000);
    return () => window.clearTimeout(t);
  }, [snap.moved]);

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
  const entries = tl.entries;
  const noFit = tl.notes.find((n) => n.kind === 'no-fit');
  const splitOpt = tl.notes.find((n) => n.kind === 'split-option');
  const menu = day.variants.map((v) => ({
    label: `${v.label}${v.key === tl.variant.key ? (tl.variant.chosenBy === 'override' ? ' (picked)' : ' (chosen for your settings)') : ''}`,
    onSelect: () => onVariant(v.key),
  }));
  if (tl.variant.chosenBy === 'override') menu.push({ label: 'Back to the version chosen for your settings', onSelect: () => onVariant(null) });

  return (
    <li id={`day-${day.n}`} className="tl-day" data-picked={picked || undefined} data-changed={changed || undefined}>
      <header className="tl-day-head">
        <span className="tl-thumb" aria-hidden="true">
          {day.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- static export, remote Commons URLs
            <img src={sizedImage(day.thumb.url, 192)} srcSet={imageSrcSet(day.thumb.url)} sizes="96px" alt="" width={192} height={136} loading="lazy" decoding="async" />
          ) : (
            <Icon name="mountain" size={22} />
          )}
        </span>
        <div className="tl-day-main">
          <div className="tl-day-top">
            <DaySign n={day.n} state={picked ? 'focused' : 'quiet'} size="s" />
            {day.base ? <span className="tl-day-base num">{day.base}</span> : null}
            {tl.span.minutes > 0 && !tl.blocks ? <span className="tl-day-span num">{tl.span.start} to {tl.span.end}</span> : null}
          </div>
          <h3 className="tl-day-title">{title}</h3>
          <p className="tl-day-totals num">
            {tl.totals.driveMin > 0 ? (
              <span title={est ? 'Includes estimated drive times' : undefined} data-est={est || undefined}>
                <Icon name="car" size={13} /> {est ? '≈' : ''}{fmtHM(tl.totals.driveMin)} driving
              </span>
            ) : null}
            <span>{tl.totals.walkKm > 0 ? `${formatDistance(tl.totals.walkKm, prefs.distance)} walking` : 'no walking'}</span>
            {fixed > 0 ? <span>{fixed} fixed {fixed === 1 ? 'slot' : 'slots'}</span> : null}
            {nWarn > 0 ? <span className="tl-warn-count"><Icon name="warn" size={13} /> {nWarn} {nWarn === 1 ? 'warning' : 'warnings'}</span> : null}
          </p>
          {day.light ? <p className="tl-day-light num"><Icon name="sun" size={13} /> {day.light}</p> : null}
        </div>
        <div className="tl-day-actions" data-print="hide">
          {day.variants.length > 1 ? (
            <VariantMenu
              label={tl.variant.label}
              ariaLabel={`Version of Day ${day.n}: ${tl.variant.label}. ${tl.variant.reason}`}
              entries={menu}
            />
          ) : null}
          {changed ? (
            <span className="tl-changed">
              Changed for this day · <button type="button" className="tl-reset" onClick={() => onVariant(null)}>Reset</button>
            </span>
          ) : null}
        </div>
      </header>

      <div className="tl-day-body">
        {tl.variant.reason && day.variants.length > 1 ? <p className="tl-reason num" title={tl.variant.reason}><Prose text={tl.variant.reason} /></p> : null}
        {noFit ? (
          <p className="tl-nofit" role="note">
            <Icon name="warn" size={15} /> <span>
              <b>{age !== null ? `Not suited to age ${age}.` : 'Not suited to this setting.'}</b> <Prose text={noFit.text} />.
            </span>
          </p>
        ) : null}
        {day.summary && showSummary ? <p className="tl-summary"><Prose text={day.summary} /></p> : null}
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
          {entries.map((e: TimelineEntry) =>
            e.kind === 'leg' && !tl.blocks ? (
              <LegRow key={e.id} e={e} />
            ) : (
              <Entry
                key={e.id}
                entry={e}
                warnings={warnByEntry.get(e.id) ?? []}
                moved={snap.moved.get(e.id) ?? null}
                onRemove={e.addedBy === 'visitor' && addedKeys.has(e.id) ? () => onRemove(addedKeys.get(e.id)!) : undefined}
                laneOff={split && e.lane !== 'all' && e.lane !== activeLane}
              />
            ),
          )}
        </ol>
        {(tl.blocks ? tl.entries.length === 0 : tl.entries.length <= 2) ? <p className="tl-empty">No stops are planned for this day yet.</p> : null}
        <AddToDay day={day.n} candidates={candidates} taken={taken} onAdd={onAdd} />
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
