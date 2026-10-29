'use client';

import Link from 'next/link';
import type { PlanCandidateRow } from '@travel/core/schema/api/plan.ts';
import { Chip } from '@/components/ui/Chip';
import { Icon, kindIcon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { driveText, durationText } from '@/lib/plan/format';

interface Props {
  row: PlanCandidateRow;
  picked: boolean;
  onToggle: (row: PlanCandidateRow) => void;
  /** the youngest child's age, for the "Fits 6" chip; null: no children */
  youngest: number | null;
  /** the place the drive is measured from, for the near strips: "15 min ≈ from Braies" */
  from?: string;
  /** the plan already holds as many places as it can */
  full?: boolean;
  className?: string;
  /** a row of a left-out list ("Not for your party", "Closed in October"): it shows why and cannot be picked (TB-W2) */
  why?: string | null;
}

/** The facts under the name: kind, length, time on site (all from the row). */
export function rowMeta(row: PlanCandidateRow): string {
  const parts: string[] = [row.kindLabel];
  if (row.km) parts.push(`${row.km} km`);
  if (row.visitMin) parts.push(durationText(row.visitMin));
  return parts.join(' · ');
}

/** A candidate (components 9.2, 9.5): name and kind line, the drive from the start or the pick, up to three chips, and the Pick control. */
export function CandidateRow({ row, picked, onToggle, youngest, from, full, className, why }: Props) {
  const chips: { kind: 'ok' | 'toBook' | 'honest' | 'neutral'; text: string }[] = [];
  if (youngest !== null && row.fit === 'pass') chips.push({ kind: 'ok', text: `Fits ${youngest}` });
  if (row.booking && row.booking !== 'none') chips.push({ kind: 'toBook', text: row.booking });
  if (row.seasonState === 'closed') chips.push({ kind: 'honest', text: 'Closed this month' });
  else if (row.badge) chips.push({ kind: 'neutral', text: row.badge });
  const drive = row.driveMin !== null ? `${driveText(row.driveMin, row.driveBasis)}${from ? ` from ${from}` : ''}` : null;
  const disabled = !picked && full;
  return (
    <li className={cx('cand', picked && 'cand-picked', className)}>
      <span className="cand-glyph" aria-hidden="true">
        <Icon name={kindIcon(row.kind)} size={16} />
      </span>
      <div className="cand-body">
        <p className="cand-name">
          <Link href={`/places/${row.slug}/`} target="_blank" rel="noopener noreferrer">
            {row.name}
            <span className="sr-only"> (opens in a new tab)</span>
          </Link>
        </p>
        <p className="cand-meta">
          {rowMeta(row)}
          {drive ? <> · {drive}</> : null}
          {row.kind === 'area' ? ' · we choose its stops' : ''}
        </p>
        {why ? <p className="cand-why">{why}</p> : null}
        {chips.length && !why ? (
          <p className="cand-chips">
            {chips.slice(0, 3).map((c) => (
              <Chip key={c.text} kind={c.kind} icon={c.kind === 'neutral' ? false : undefined}>
                {c.text}
              </Chip>
            ))}
          </p>
        ) : null}
      </div>
      {why ? (
        <span className="cand-aside" aria-hidden="true" />
      ) : (
        <button type="button" className="pick-btn" aria-pressed={picked} aria-label={`Pick ${row.name}`} disabled={disabled} onClick={() => onToggle(row)} title={disabled ? 'A plan holds at most 40 places' : undefined}>
          <Icon name={picked ? 'check' : 'plus'} size={15} />
          <span className="pick-word">{picked ? 'Picked' : 'Pick'}</span>
        </button>
      )}
    </li>
  );
}
