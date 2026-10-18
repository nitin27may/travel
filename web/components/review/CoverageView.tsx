'use client';

import { useMemo, useState } from 'react';
import type { BacklogItem, CoverageArea, Summary } from './api';
import { ENTITY_LABEL, labelOf } from './model';

const TYPES: [string, string][] = [
  ['sights', 'Sights'], ['trails', 'Trails'], ['activities', 'Activities'], ['stays', 'Stays'], ['eateries', 'Eateries'], ['legs', 'Legs'], ['guide', 'Guide'],
];
const BAND_WORD = { thin: 'Thin', usable: 'Usable', good: 'Good' } as const;

function Bar({ value, band }: { value: number; band?: string }) {
  return (
    <span className="cv-bar" data-band={band} role="img" aria-label={`${Math.round(value * 100)} percent`}>
      <i style={{ width: `${Math.round(value * 100)}%` }} />
    </span>
  );
}

function Coverage({ s }: { s: Summary }) {
  const [level, setLevel] = useState<'area' | 'region' | 'country'>('area');
  const [style, setStyle] = useState<string>('all');
  const styles = useMemo(() => Object.keys(s.coverage.find((a) => a.level === 'area')?.by_style ?? {}), [s]);
  const rows = s.coverage.filter((a) => a.level === level);
  const score = (a: CoverageArea): { total: number; band: string } => (style === 'all' ? a : (a.by_style[style] ?? a));
  const areas = s.coverage.filter((a) => a.level === 'area');
  const counts = { thin: 0, usable: 0, good: 0 };
  for (const a of areas) counts[score(a).band as keyof typeof counts]++;
  return (
    <section className="cv" aria-label="Coverage by area">
      <div className="cv-summary">
        {(['thin', 'usable', 'good'] as const).map((b) => (
          <div key={b} className="cv-band" data-band={b}>
            <strong className="num">{counts[b]}</strong>
            <span>{BAND_WORD[b]} {counts[b] === 1 ? 'area' : 'areas'}</span>
          </div>
        ))}
        <p className="rv-note">Thin is under 0.4, usable up to 0.7, good above. The targets are provisional until the first two regions are measured.</p>
      </div>
      <div className="cv-controls">
        <div className="seg" role="group" aria-label="Level">
          {(['area', 'region', 'country'] as const).map((l) => (
            <button key={l} type="button" className="seg-btn" aria-pressed={level === l} onClick={() => setLevel(l)}>{l === 'area' ? 'Areas' : l === 'region' ? 'Regions' : 'Countries'}</button>
          ))}
        </div>
        <label className="select-field">
          <span>Weighted for</span>
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="all">All styles</option>
            {styles.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <ul className="cv-list">
        {rows.map((a) => {
          const sc = score(a);
          return (
            <li key={a.area_id} className="cv-row" data-band={sc.band}>
              <div className="cv-name">
                <strong>{a.name}</strong>
                <span className="rv-id">{a.area_id}</span>
              </div>
              <div className="cv-total">
                <span className="cv-word">{BAND_WORD[sc.band as keyof typeof BAND_WORD]}</span>
                <Bar value={sc.total} band={sc.band} />
                <span className="num">{sc.total.toFixed(2)}</span>
              </div>
              <ul className="cv-types">
                {TYPES.map(([k, label]) => {
                  const t = a.types[k];
                  if (!t) return null;
                  return (
                    <li key={k}>
                      <span>{label}</span>
                      <Bar value={t.score} />
                      <span className="num">{k === 'legs' ? `${Math.round(t.score * 100)}%` : `${t.count}/${t.target}`}</span>
                    </li>
                  );
                })}
              </ul>
              {a.stale_prices ? <p className="rv-note" data-warn="">{a.stale_prices} price{a.stale_prices === 1 ? '' : 's'} past the freshness limit</p> : null}
            </li>
          );
        })}
        {rows.length === 0 ? <li className="rv-note">No coverage yet. Run <code>node core/bin/catalog.ts coverage --write</code>.</li> : null}
      </ul>
    </section>
  );
}

const REASON_WORD: Record<string, string> = { gap: 'Gap', stale: 'Stale', 'low-coverage': 'Thin', conflict: 'Conflict', 'user-request': 'Requested' };

function why(b: BacklogItem, nameOf: (id: string | null) => string): string {
  const where = b.subject_id ? b.subject_id.split('/').pop()!.replace(/-/g, ' ') : nameOf(b.area_id);
  const f = b.field ? labelOf(b.field) : 'a field';
  switch (b.reason) {
    case 'gap': return `${f} on ${where} is marked not found.`;
    case 'stale': return `${f} on ${where} is past its freshness limit.`;
    case 'conflict': return `Two sources disagree about ${f} on ${where}.`;
    case 'low-coverage': return `${ENTITY_LABEL[b.field ?? ''] ?? f} coverage is thin in ${nameOf(b.area_id)}.`;
    default: return `${f} in ${nameOf(b.area_id)}, asked for by the owner.`;
  }
}

function Backlog({ s, nameOf }: { s: Summary; nameOf: (id: string | null) => string }) {
  const [reason, setReason] = useState<string | null>(null);
  const reasons = [...new Set(s.backlog.map((b) => b.reason))].sort();
  const rows = s.backlog.filter((b) => !reason || b.reason === reason);
  return (
    <section className="cv" aria-label="Research backlog">
      <div className="cv-controls">
        <div className="seg" role="group" aria-label="Reason">
          <button type="button" className="seg-btn" aria-pressed={reason === null} onClick={() => setReason(null)}>All</button>
          {reasons.map((r) => <button key={r} type="button" className="seg-btn" aria-pressed={reason === r} onClick={() => setReason(reason === r ? null : r)}>{REASON_WORD[r] ?? r}</button>)}
        </div>
        <span className="rv-note">Showing {rows.length} of {s.backlog_total}. Priority is trips using it, times urgency, times severity, never below 1.</span>
      </div>
      <ol className="bl-list">
        {rows.map((b, i) => (
          <li key={b.id} className="bl-row" data-reason={b.reason}>
            <span className="bl-rank num">{i + 1}</span>
            <span className="bl-prio num" title="priority">{b.priority}</span>
            <div>
              <p>{why(b, nameOf)}</p>
              <p className="rv-id">{nameOf(b.area_id)}{b.lane ? `, lane ${b.lane}` : ''}</p>
            </div>
            <span className="rv-flag" data-flag={b.reason}>{REASON_WORD[b.reason] ?? b.reason}</span>
          </li>
        ))}
        {rows.length === 0 ? <li className="rv-note">The backlog is empty.</li> : null}
      </ol>
    </section>
  );
}

export default function CoverageView({ summary, mode, nameOf }: { summary: Summary; mode: 'coverage' | 'backlog'; nameOf: (id: string | null) => string }) {
  return mode === 'coverage' ? <Coverage s={summary} /> : <Backlog s={summary} nameOf={nameOf} />;
}
