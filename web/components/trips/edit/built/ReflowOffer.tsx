'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { buildOps, reflowOffer } from '@/lib/trip-edit/built';
import type { PlanDraft, PlanOp } from '@/lib/trip-edit/model';
import './built.css';

interface Props {
  doc: PlanDraft;
  party: { adults: number; children: readonly number[] };
  commit: (ops: PlanOp[], label: string) => boolean;
}

const dayList = (ns: readonly number[]): string => (ns.length === 1 ? `Day ${ns[0]}` : `Days ${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`);

/**
 * The re-flow offer above Day 1 of a built trip in edit mode (edit-mode-spec 5 "Re-flow: both days, on the device"; 9.3's wording): once a
 * move, an add or a removal leaves a day the build no longer describes, "Re-flow the rest? 3 kept and 2 added by you stay · Re-flow". The
 * re-flow runs on the device (lib/trip-edit/reflow.ts, loaded on the press) and is one undo step. Nothing moves until it is pressed.
 */
export function ReflowOffer({ doc, party, commit }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const words = reflowOffer(doc);
  if (!words) return null;
  const go = async () => {
    setBusy(true);
    try {
      const m = await import('@/lib/trip-edit/reflow');
      const r = m.reflow(doc, party, m.matrixOf(doc.id));
      if (!r) return;
      const moved = r.moved.length ? ` · ${r.moved.length === 1 ? '1 stop moved' : `${r.moved.length} stops moved`} to a day with room` : '';
      commit(buildOps(doc, r.lastBuild), `Re-flowed ${dayList(r.days)}${moved}`);
    } catch {
      toast({ message: 'Could not re-flow the days. Nothing was changed.' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <p className="own-changes-line reflow-line" data-testid="reflow-offer" data-print="hide">
      <span>{words}</span>
      <Button size="sm" loading={busy} onClick={() => void go()}>
        Re-flow
      </Button>
    </p>
  );
}
