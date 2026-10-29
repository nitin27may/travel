'use client';

import { useMemo, useState } from 'react';
import type { PlanBaseChoice } from '@travel/core/schema/plan-draft.ts';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SearchInput } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { Stepper } from '@/components/ui/Stepper';
import { MAX_BASES, placedNights, splitNights, townName } from '@/lib/plan/bases';
import { driveLimit, moves, moveWords } from '@/lib/plan/baseMoves';
import type { FlowState } from '@/lib/plan/flow';
import { plural } from '@/lib/plan/format';
import { useBaseTowns } from '@/lib/plan/useBaseTowns';
import type { StageProps } from './types';

const nameOf = (flow: Pick<FlowState, 'baseInfo'>, b: PlanBaseChoice): string => flow.baseInfo?.[b.town]?.name ?? townName(b.town);
const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * The estimate card's lines for chosen bases (FLOW stage 4): "Banff 3 nights, Jasper 4 nights" and each move with its drive. An estimate
 * from the towns' public points, so it carries ≈; the build replaces it with the engine's own figures. Nothing is drawn without a base.
 */
export function BaseEstimate({ flow }: { flow: FlowState }) {
  const split = useMemo(() => splitNights(flow.bases, flow.nights), [flow.bases, flow.nights]);
  const limit = driveLimit(flow.pace, flow.driveDayMin);
  const hops = useMemo(() => moves(flow.bases, flow.baseInfo ?? {}, limit), [flow.bases, flow.baseInfo, limit]);
  if (!flow.bases.length) return null;
  return (
    <div className="base-estimate" data-testid="base-estimate">
      <p className="plan-card-line base-split">{flow.bases.map((b, i) => `${nameOf(flow, b)} ${plural(split.nights[i]!, 'night')}`).join(' · ')}</p>
      {split.spare > 0 ? <p className="plan-help">{plural(split.spare, 'night')} not given to a town yet. The plan puts them where the days are busiest.</p> : null}
      {hops.map((m) => (
        <p key={`${m.from}>${m.to}`} className={m.long ? 'plan-card-warn' : 'plan-help'}>
          {moveWords(m)}
        </p>
      ))}
      {hops.length ? <p className="plan-help">Each move takes a day of its own. {plural(hops.length, 'move day')} so far.</p> : null}
    </div>
  );
}

/**
 * Where the trip sleeps (FLOW stage 4; trip-builder 4.5): either the plan chooses its bases, or the visitor picks towns near their places,
 * gives each some nights (or leaves it open) and puts them in the order the trip visits them. Order is by Earlier and Later buttons, not
 * by drag, so it works by keyboard and on a phone (WCAG 2.5.7). The build receives `bases[]` exactly as chosen.
 */
export function BasesSection({ flow, dispatch, now }: StageProps) {
  const [choosing, setChoosing] = useState(flow.bases.length > 0);
  const [q, setQ] = useState('');
  const towns = useBaseTowns(flow.picks, choosing);
  const left = flow.nights - placedNights(flow.bases);
  const full = flow.bases.length >= MAX_BASES;
  const taken = new Set(flow.bases.map((b) => b.town));
  const want = norm(q.trim());
  const found = towns.status === 'ok' ? towns.towns.filter((t) => !taken.has(t.id) && (!want || norm(t.name).includes(want))) : [];
  const shown = found.slice(0, want ? 12 : 8);

  const setMode = (m: 'auto' | 'choose') => {
    if (m === 'auto') {
      setChoosing(false);
      dispatch({ t: 'bases-auto', now: now() });
    } else setChoosing(true);
  };

  return (
    <section className="plan-field base-section" aria-labelledby="plan-bases-h" data-testid="bases">
      <p className="plan-label" id="plan-bases-h">
        Where the trip sleeps
      </p>
      <Segmented
        className="plan-seg"
        label="Where the trip sleeps"
        value={choosing ? 'choose' : 'auto'}
        onChange={setMode}
        segments={[
          { value: 'auto', label: 'Let the plan choose' },
          { value: 'choose', label: 'I choose the towns' },
        ]}
      />
      {!choosing ? (
        <p className="plan-help">We pick towns close to your places and share the nights between them. You can change them on the trip&apos;s page.</p>
      ) : (
        <>
          {flow.bases.length ? (
            <ol className="base-list" aria-label="Your bases, in the order you visit them">
              {flow.bases.map((b, i) => {
                const name = nameOf(flow, b);
                return (
                  <li key={b.town} className="base-row" data-testid="base-row">
                    <span className="base-num num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div className="base-main">
                      <p className="base-name">{name}</p>
                      <Stepper
                        className="base-stepper"
                        label={`Nights in ${name}`}
                        value={b.nights ?? 0}
                        min={0}
                        max={Math.max(b.nights ?? 0, (b.nights ?? 0) + left)}
                        decLabel={`Fewer nights in ${name}`}
                        incLabel={`More nights in ${name}`}
                        format={(n) => (n === 0 ? 'Plan decides' : plural(n, 'night'))}
                        onChange={(n) => dispatch({ t: 'base-nights', town: b.town, nights: n === 0 ? null : n, now: now() })}
                      />
                    </div>
                    <div className="base-ctl">
                      <Button variant="ghost" size="sm" icon aria-label={`Move ${name} earlier`} aria-disabled={i === 0 || undefined} onClick={() => i > 0 && dispatch({ t: 'base-move', town: b.town, by: -1, now: now() })}>
                        <Icon name="chevronUp" size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" icon aria-label={`Move ${name} later`} aria-disabled={i === flow.bases.length - 1 || undefined} onClick={() => i < flow.bases.length - 1 && dispatch({ t: 'base-move', town: b.town, by: 1, now: now() })}>
                        <Icon name="chevronDown" size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`Remove ${name}`} onClick={() => dispatch({ t: 'base-remove', town: b.town, now: now() })}>
                        Remove
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="plan-help">Pick a town below. Pick more than one for a trip that moves.</p>
          )}
          {flow.bases.length > 1 ? <p className="plan-help">Order is the order you sleep in. The days between two towns are move days.</p> : null}

          <p className="plan-label" id="plan-base-add-l">
            Towns near your places
          </p>
          {full ? (
            <p className="plan-help">A plan holds {MAX_BASES} bases. Remove one to add another.</p>
          ) : towns.status === 'loading' || towns.status === 'idle' ? (
            <p className="plan-help">Finding towns near your places…</p>
          ) : towns.status === 'error' ? (
            <Banner kind="urgent">We could not list towns. Let the plan choose, or try again later.</Banner>
          ) : towns.status === 'unavailable' ? (
            <Banner kind="notice">Choosing towns is not available on this site yet. The plan will choose.</Banner>
          ) : (
            <>
              <SearchInput value={q} onChange={setQ} label="Find a town" placeholder="Find a town" status={`${plural(found.length, 'town')}`} />
              {shown.length ? (
                <ul className="cand-list base-cands" role="list" aria-labelledby="plan-base-add-l">
                  {shown.map((t) => (
                    <li key={t.id} className="cand base-cand">
                      <span className="cand-glyph" aria-hidden="true">
                        <Icon name="pin" size={16} />
                      </span>
                      <div className="cand-body">
                        <p className="cand-name">{t.name}</p>
                        <p className="cand-meta">{t.places ? `${plural(t.places, 'place')} we hold nearby` : 'Town'}</p>
                      </div>
                      <button type="button" className="pick-btn" aria-label={`Stay in ${t.name}`} onClick={() => dispatch({ t: 'base-add', town: t.id, info: { name: t.name, lat: t.lat, lon: t.lon }, now: now() })}>
                        <Icon name="plus" size={15} />
                        <span className="pick-word">Stay here</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="plan-help">{want ? `No town near your places matches “${q.trim()}”.` : 'No other town near your places.'}</p>
              )}
              {found.length > shown.length ? <p className="plan-help">{found.length - shown.length} more. Type to narrow the list.</p> : null}
            </>
          )}
        </>
      )}
    </section>
  );
}
