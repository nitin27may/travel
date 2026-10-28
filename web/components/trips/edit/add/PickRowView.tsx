'use client';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { KindGlyph } from '@/components/ui/KindGlyph';
import { KID_LABELS } from '@/lib/entities/labels';
import { distanceWords, type PickRow } from './rows';
import type { Fit } from './fit';

export interface RowState {
  /** "Added · Undo" instead of the button */
  done: { undo: (() => void) | null } | null;
}

interface Props {
  row: PickRow;
  day: number;
  fit: Fit | null;
  /** the day's words wait for the scheduler */
  waiting: boolean;
  done: RowState['done'];
  /** formats a distance in the person's unit */
  fmt: (km: number) => string;
  /** a catalogue place far from every base: where "Start a new trip with" goes, or null when the planner is not open */
  newTrip: (slug: string) => string | null;
  full: string | null;
  showKids: boolean;
  onAct: (row: PickRow) => void;
  /** false: a place already on the trip has no Move button (a park's members, ruling C5) */
  move?: boolean;
  /** the button's visible words ("Add to Day 5" in the arrival); the default is the row's own verb */
  label?: string;
  /** no button at all: the place has no day to go on */
  noAct?: boolean;
  /** the stop this pick replaces (Swap for a nearby place): the button says Swap and names both */
  swapFor?: string;
}

/** The row's button word: Add, Move here, Put back. */
export const actionWord = (r: PickRow): string => (r.back ? r.back.verb : r.on ? 'Move here' : 'Add');

/** One place in the picker (edit-mode-spec 7.3): glyph, name and kind chip; the fit line; the distance; and the 44 px button. */
export function PickRowView({ row: r, day, fit, waiting, done, fmt, newTrip, full, showKids, onAct, move = true, label, noAct, swapFor }: Props) {
  const dist = distanceWords(r, fmt);
  const kid = showKids && r.found && r.found.kidFit !== 'unknown' ? KID_LABELS[r.found.kidFit] : null;
  const word = actionWord(r);
  const line2 =
    done ? null
    : r.note ? r.note
    : r.on ? `On Day ${r.on.day}`
    : r.far ? `${r.farKm !== null ? fmt(r.farKm) : 'Far'} from this trip's bases.`
    : fit ? (fit.state === 'full' ? `Day full${full ? `: try Day ${full}` : ''}` : fit.words)
    : waiting && r.cand ? 'Working out the day' : null;
  return (
    <li className="add-row" data-far={r.far || undefined} data-done={done ? '' : undefined} data-fit={fit?.state}>
      <KindGlyph kind={r.kind} />
      <div className="add-main">
        <div className="add-name">
          <span className="add-title">{r.name}</span>
          <Chip kind="kind" icon={false}>{r.kindLabel}</Chip>
          {kid ? <Chip kind="neutral" icon={false}>{kid}</Chip> : null}
          {fit?.state === 'tight' ? <Chip kind="caution" icon="warn">Tight</Chip> : null}
        </div>
        {line2 ? <p className="add-fit num" data-fit={fit?.state ?? 'wait'}>{line2}</p> : null}
        {dist && !r.note ? <p className="add-dist num">{dist}</p> : null}
      </div>
      <div className="add-act">
        {done ? (
          <span className="add-done" role="status">
            <span>Added</span>
            {done.undo ? <button type="button" className="add-undo" onClick={done.undo} aria-label={`Undo adding ${r.name}`}>Undo</button> : null}
          </span>
        ) : r.far ? (
          r.slug && newTrip(r.slug) ? <a className="btn btn-sm add-new" href={newTrip(r.slug)!}>Start a new trip with {r.name}</a> : null
        ) : (r.on && !move) || noAct ? null : (
          <Button size="sm" className="add-btn" disabled={!r.cand && !r.back} onClick={() => onAct(r)} aria-label={swapFor ? `Swap ${swapFor} for ${r.name}` : word === 'Move here' ? `Move ${r.name} to Day ${day}` : `${word} ${r.name}${word === 'Put back' ? '' : ` to Day ${day}`}`}>
            {label ?? (swapFor ? 'Swap' : word)}
          </Button>
        )}
      </div>
    </li>
  );
}
