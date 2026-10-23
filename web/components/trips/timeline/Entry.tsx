'use client';

import { useState } from 'react';
import '@/styles/suitability.css';
import { fmtHM } from '@travel/core/schedule/rules.ts';
import type { PlaceRef, ScheduleWarning, TimelineEntry } from '@travel/core/schedule/types.ts';
import { Chip } from '@/components/ui/Chip';
import { Icon, type IconName } from '@/components/ui/Icon';
import { usePrefs } from '@/lib/format/prefs';
import { formatDistance, formatElevation } from '@/lib/format/units';
import { EntrySuit } from '@/components/suit/TripSuit';
import { TlIcon, type TlIconName } from './icons';
import { CONF_LABEL, fixedLabel, honestyLabel, KIND_WORD, MODE_WORD, SOURCE_LABEL, timeSpeech, timeText } from './labels';
import { entryKey } from '../mapPins';
import { useMapLink } from './MapLink';
import { FLIGHT_NOTE } from './marks';
import { Prose } from './Prose';

const GLYPH: Record<string, { ui?: IconName; tl?: TlIconName }> = {
  start: { tl: 'key' }, 'start:land': { ui: 'flight' }, 'start:leave-home': { ui: 'home' },
  visit: { ui: 'eye' }, 'visit:lake': { ui: 'lake' }, 'visit:waterfall': { ui: 'waterfall' }, 'visit:viewpoint': { ui: 'eye' }, 'visit:town': { ui: 'sight' }, 'visit:sight': { ui: 'sight' },
  'visit:lift-ride': { ui: 'lift' }, 'visit:boat': { tl: 'boat' }, 'visit:hot-spring': { ui: 'swim' }, 'visit:activity': { ui: 'bolt' }, 'visit:car-hire': { ui: 'car' },
  'visit:errands': { ui: 'sight' }, trail: { tl: 'walker' }, meal: { ui: 'eatery' }, break: { tl: 'cup' }, rest: { tl: 'rest' }, checkin: { tl: 'bed' }, checkout: { tl: 'bed' },
  booking: { ui: 'ticket' }, sun: { ui: 'sun' }, 'sun:sunset': { tl: 'sunset' }, end: { ui: 'pin' },
  'leg:drive': { ui: 'car' }, 'leg:walk': { tl: 'walker' }, 'leg:shuttle': { tl: 'bus' }, 'leg:bus': { tl: 'bus' }, 'leg:train': { tl: 'train' }, 'leg:boat': { tl: 'boat' }, 'leg:ferry': { tl: 'boat' }, 'leg:lift': { ui: 'lift' }, 'leg:flight': { ui: 'flight' },
};

function Glyph({ e, size = 15 }: { e: TimelineEntry; size?: number }) {
  const g = GLYPH[`${e.kind}:${e.sub ?? ''}`] ?? GLYPH[e.kind] ?? { ui: 'pin' as IconName };
  return g.tl ? <TlIcon name={g.tl} size={size} /> : <Icon name={g.ui ?? 'pin'} size={size} />;
}

const QUIET = new Set(['meal', 'break', 'rest', 'checkin', 'checkout', 'end', 'start', 'booking']);

/** A drive, walk or shuttle between two entries: a connector, not an entry (design 4.3). */
export function LegRow({ e }: { e: TimelineEntry }) {
  const [prefs] = usePrefs();
  const est = e.leg ? e.leg.basis !== 'routed' : false;
  const word = MODE_WORD[e.leg?.mode ?? 'drive'] ?? 'Travel';
  const to = e.to?.name ? e.title.replace(/^(Drive|Walk|Shuttle|Bus|Train|Boat|Ferry|Lift|Flight) (?:on )?to |^Back to /, '') : '';
  const back = /^(Back to|Drive on to)/.test(e.title);
  return (
    <li className="tl-leg num" data-lane={e.lane} data-mode={e.leg?.mode} data-estimate={est || undefined}>
      <span className="tl-time" aria-hidden="true" />
      <span className="tl-node" aria-hidden="true" />
      <p className="tl-leg-text">
        <Glyph e={e} size={14} />
        <span className="sr-only">{`${e.start}, ${word} ${fmtHM(e.durationMin)}${est ? ', estimated' : ''}${to ? `, to ${to}` : ''}. `}</span>
        <span aria-hidden="true">
          {est ? <><span className="tl-est" title="A straight line or the plan's own figure, not a routed road time">≈</span>{' '}</> : null}
          {word} <b>{fmtHM(e.durationMin)}</b>
          {e.leg?.km ? ` · ${formatDistance(e.leg.km, prefs.distance)}` : ''}
          {to && !back ? ` to ${to}` : back ? ` ${e.title.replace(/^Drive on to /, 'on to ')}` : ''}
        </span>
      </p>
    </li>
  );
}

function stats(e: TimelineEntry, prefs: ReturnType<typeof usePrefs>[0]): string[] {
  const out: string[] = [];
  if (e.stats?.distanceKm != null) out.push(formatDistance(e.stats.distanceKm, prefs.distance));
  if (e.stats?.gainM != null) out.push(`${formatElevation(e.stats.gainM, prefs.elevation)} up`);
  return out;
}

const place = (p: PlaceRef | null) => (p?.placeSlug ? `/places/${p.placeSlug}/` : null);

interface Props {
  entry: TimelineEntry;
  warnings: ScheduleWarning[];
  /** "moved 40 min later", shown for one viewing after an addition. */
  moved: number | null;
  onRemove?: () => void;
  /** "Last rental 14:00": the latest the data lets this start, beside the other facts. */
  last?: string | null;
  dimmed?: boolean;
  laneOff?: boolean;
}

/** One entry on the day's time rail (design 4.2): time, node, glyph, title, chips, meta, note, warnings; opens to its sources. */
export function Entry({ entry: e, warnings, moved, onRemove, laneOff, last }: Props) {
  const [open, setOpen] = useState(false);
  const [prefs] = usePrefs();
  const link = useMapLink();
  const ek = entryKey(e.day, e.id);
  const num = link?.numbers.get(ek);
  const pinId = link?.pins.get(ek);
  const inert = link ? link.mapDay !== e.day : false;
  const quiet = QUIET.has(e.kind);
  const href = place(e.at);
  const slot = fixedLabel(e);
  const dur = e.durationMin > 0 && e.kind !== 'sun' ? fmtHM(e.durationMin) : null;
  const meta = [slot, last, ...stats(e, prefs), e.kind === 'meal' && e.style === 'on-trail' ? 'eaten on the trail' : null].filter(Boolean) as string[];
  const hasMore = (!quiet || e.addedBy === 'visitor') && e.kind !== 'sun' && !e.block;
  const flagged = [...new Set(e.honesty)].filter((h) => h !== 'drive_estimated');
  const moveText = moved ? `moved ${fmtHM(Math.abs(moved))} ${moved > 0 ? 'later' : 'earlier'}` : null;
  const sr = `${e.block ? e.block.toLowerCase() : timeSpeech(e)}, ${KIND_WORD[e.kind]}, ${e.title}${e.stats?.distanceKm != null ? `, ${formatDistance(e.stats.distanceKm, prefs.distance)}` : ''}${dur ? `, ${dur}` : ''}`;
  return (
    <li
      data-band={e.sub === 'together' || undefined}
      id={e.sourceItemId && !e.insideOf ? `entry-${e.day}-${e.sourceItemId}` : undefined}
      className="tl-entry"
      data-kind={e.kind}
      data-conf={e.time.confidence}
      data-lane={e.lane}
      data-quiet={quiet || undefined}
      data-added={e.addedBy === 'visitor' || undefined}
      data-optional={e.optional || undefined}
      data-lane-off={laneOff || undefined}
      data-inside={e.insideOf ? '' : undefined}
      data-entry={`${e.day}:${e.id}`}
      data-pin={pinId}
    >
      <span className="tl-time num" data-conf={e.time.confidence} data-block={e.block ? '' : undefined}>
        <span aria-hidden="true">{e.block ?? timeText(e)}</span>
        {e.tz.length <= 3 ? <span className="tl-tz" aria-hidden="true">{e.tz}</span> : null}
        {e.kind === 'sun' ? <span className="tl-sun-glyph"><TlIcon name="sunset" size={13} /></span> : null}
      </span>
      <span className="tl-node" data-conf={e.time.confidence} aria-hidden="true" />
      <div className="tl-body">
        <p className="tl-head">
          <span className="sr-only">{sr}. </span>
          <span className="tl-glyph" aria-hidden="true"><Glyph e={e} /></span>
          {num !== undefined && pinId ? (
            <button
              type="button"
              className="tl-badge num"
              data-pin-badge
              aria-label={`Show stop ${num} on the map`}
              aria-disabled={inert || undefined}
              onClick={() => link?.show(e.day, pinId)}
            >
              {num}
            </button>
          ) : null}
          <span className="tl-title">
            {href && !quiet ? <a href={href}>{e.title}</a> : e.title}
          </span>
          {dur ? <span className="tl-dur num" aria-hidden="true">{dur}</span> : null}
          {link?.missing.has(ek) ? <span className="tl-nomap num">· not on the map</span> : null}
          {!quiet && e.kind !== 'leg' ? <EntrySuit slug={e.at?.placeSlug} title={e.title} kind={e.kind} /> : null}
          {e.addedBy === 'visitor' ? <Chip kind="idea" icon={false}>You added this</Chip> : null}
          {e.optional ? <Chip kind="neutral" icon={false}>Optional</Chip> : null}
          {flagged.map((h) => (
            <Chip key={h} kind="honest" icon={false}>{honestyLabel(h)}</Chip>
          ))}
          {moveText ? <span className="tl-moved num">{moveText}</span> : null}
        </p>
        {meta.length ? <p className="tl-meta num">{meta.join(' · ')}</p> : null}
        {e.time.note && (e.kind !== 'start' || e.time.note.startsWith(FLIGHT_NOTE)) ? <p className="tl-note"><Prose text={e.time.note} /></p> : null}
        {warnings.map((w) => (
          <p key={`${w.code}:${w.message}`} className="tl-warn" data-code={w.code}>
            <Icon name="warn" size={14} /> <Prose text={w.message} />
          </p>
        ))}
        {hasMore ? (
          <>
            <button type="button" className="tl-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              <Icon name="chevronDown" size={14} /> <span>{open ? 'Less' : 'Why this time'}</span>
            </button>
            {open ? (
              <dl className="tl-why num">
                <div>
                  <dt>Time</dt>
                  <dd>
                    {e.start} to {e.end}, {CONF_LABEL[e.time.confidence]}. {e.kind === 'meal' || e.kind === 'break' || e.kind === 'rest' || e.time.source === 'rule' ? `${SOURCE_LABEL.rule} for a ${KIND_WORD[e.kind]}.` : `${SOURCE_LABEL[e.time.source]}.`}
                  </dd>
                </div>
                {e.time.anchor ? (
                  <div>
                    <dt>Sun</dt>
                    <dd>{e.time.anchor.to} {e.time.anchor.offsetMin >= 0 ? '+' : '-'}{Math.abs(e.time.anchor.offsetMin)} min, {e.time.anchor.range[0]} to {e.time.anchor.range[1]} in this window.</dd>
                  </div>
                ) : null}
                {dur ? (
                  <div>
                    <dt>Duration</dt>
                    <dd>{e.duration.basis}.</dd>
                  </div>
                ) : null}
                {e.time.window ? (
                  <div>
                    <dt>Hours</dt>
                    <dd>{e.time.window.from ?? '…'} to {e.time.window.to ?? '…'} ({e.time.window.why}).</dd>
                  </div>
                ) : null}
                {e.addedBy === 'visitor' && onRemove ? (
                  <div>
                    <dt />
                    <dd>
                      <button type="button" className="tl-remove" onClick={onRemove}>Remove from this day</button>
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </>
        ) : null}
      </div>
    </li>
  );
}
