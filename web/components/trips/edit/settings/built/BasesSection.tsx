'use client';

import type { Dispatch } from 'react';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { Switch } from '@/components/ui/Switch';
import type { FlowAction, FlowState } from '@/lib/plan/flow';
import type { PlanDraft } from '@/lib/trip-edit/model';

type Base = FlowState['bases'][number];
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/**
 * Bases for a built trip's Settings (edit-mode-spec 8; trip-builder 4.4, 4.5; engine TB-E2). The towns the last build slept at, each with
 * its nights and a Keep this base switch: choosing nights or keeping a town makes it the person's base (pinned), so the engine plans
 * around it; two or more chosen bases are the plan's bases in their order. Let the plan choose takes the town back off. A pick the build
 * left out with "add a base" offers that town. Nothing changes until Apply. Town names come from the build (no lookup, P8).
 */
export function BasesSection({ doc, flow, dispatch, now }: { doc: PlanDraft; flow: FlowState; dispatch: Dispatch<FlowAction>; now: () => string }) {
  const build = doc.lastBuild;
  const names = new Map((build?.bases ?? []).map((b) => [b.town, b.name]));
  const engineNights = new Map((build?.bases ?? []).map((b) => [b.town, b.nights]));
  const chosen = new Map(flow.bases.map((b) => [b.town, b]));
  const towns = [...new Set([...(build?.bases ?? []).filter((b) => b.nights > 0).map((b) => b.town), ...flow.bases.map((b) => b.town)])];
  const set = (bases: Base[]) => dispatch({ t: 'patch', patch: { bases }, now: now() });
  const put = (b: Base) => set(chosen.has(b.town) ? flow.bases.map((x) => (x.town === b.town ? b : x)) : [...flow.bases, b]);
  const drop = (town: string) => set(flow.bases.filter((x) => x.town !== town));
  // the towns a left-out pick asked for ("add a base near it"), not already a base
  const offers = (build?.didNotFit ?? []).flatMap((m) => {
    const town = m.fix?.kind === 'add_base' ? m.fix.town : undefined;
    if (!town || towns.includes(town)) return [];
    const pick = doc.picks.find((p) => p.ref === m.ref);
    return pick ? [{ town, near: pick.name }] : [];
  });
  if (flow.nights === 0) return <p className="plan-help">A day trip has no base.</p>;
  return (
    <div className="bset-bases">
      {towns.length ? (
        <ul className="bset-base-list" role="list">
          {towns.map((town) => {
            const mine = chosen.get(town);
            const name = names.get(town) ?? 'A base you added';
            const nights = mine?.nights ?? engineNights.get(town) ?? 1;
            return (
              <li key={town} className="bset-base">
                <p className="bset-base-name">
                  <b>{name}</b> <span className="bset-base-sub">{mine ? (mine.pinned ? 'your base' : 'your choice') : 'chosen by the plan'}</span>
                </p>
                <Stepper
                  label={`Nights at ${name}`}
                  value={nights}
                  min={0}
                  max={flow.nights}
                  decLabel={`Fewer nights at ${name}`}
                  incLabel={`More nights at ${name}`}
                  format={(n) => plural(n, 'night')}
                  onChange={(n) => put({ town, nights: n, pinned: true })}
                />
                <Switch checked={!!mine?.pinned} onCheckedChange={(on) => put({ town, nights: mine?.nights ?? null, pinned: on })}>
                  Keep this base
                </Switch>
                {mine ? (
                  <button type="button" className="link-btn bset-base-let" onClick={() => drop(town)}>
                    Let the plan choose
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="plan-help">The plan chose no base yet. Rebuild to let it choose one.</p>
      )}
      {offers.map((o) => (
        <Button key={o.town} size="sm" onClick={() => put({ town: o.town, nights: null, pinned: false })}>
          Add a base near {o.near}
        </Button>
      ))}
    </div>
  );
}

/** "Jasper 3 nights · Banff 2 nights" for the section's summary line. */
export function basesWords(doc: PlanDraft, flow: FlowState): string {
  if (flow.nights === 0) return 'None on a day trip';
  const names = new Map((doc.lastBuild?.bases ?? []).map((b) => [b.town, b]));
  const chosen = flow.bases.map((b) => `${names.get(b.town)?.name ?? 'A base'} ${b.nights === null ? '' : plural(b.nights, 'night')}`.trim());
  if (chosen.length) return chosen.join(' · ');
  const built = (doc.lastBuild?.bases ?? []).filter((b) => b.nights > 0).map((b) => `${b.name} ${plural(b.nights, 'night')}`);
  return built.length ? built.join(' · ') : 'Chosen by the plan';
}
