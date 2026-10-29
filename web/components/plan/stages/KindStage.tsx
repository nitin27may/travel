'use client';

import Link from 'next/link';
import type { PlanDraft } from '@travel/core/schema/plan-draft.ts';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { PLAN_BUILDER_UI } from '@/lib/config/product';
import { defaultPace } from '@/lib/plan/flow';
import { draftName, draftStateWords, youngestOf } from '@/lib/plan/draft';
import { KINDS } from '@/lib/plan/kinds';
import { plural } from '@/lib/plan/format';
import { removeDraft, saveDraft } from '@/lib/plan/store';
import { useDrafts } from '@/lib/plan/useDrafts';
import { openTripHref } from '@/lib/trip-edit/keys';
import type { StageProps } from './types';

/** Stage 0 (FLOW 4): six kind tiles (a tap advances, L4), then Your trips and the other ways in. */
export function KindStage({ flow, dispatch, party, now, onResume }: StageProps & { onResume: (d: PlanDraft) => void }) {
  const { drafts, ready, status } = useDrafts();
  const { toast } = useToast();
  const full = drafts.length >= PLAN_BUILDER_UI.deviceDrafts;
  // three newest, then "All trips in Mine"; at the cap every plan is listed so one can be removed (X1)
  const shown = full ? drafts : drafts.slice(0, 3);
  const youngest = youngestOf(party);

  const remove = (d: PlanDraft) => {
    if (!removeDraft(d.id)) return;
    toast({ message: 'Removed from this device', actionLabel: 'Undo', onAction: () => void saveDraft(d) });
  };

  return (
    <div className="plan-kind">
      <section aria-labelledby="plan-kind-h" className="plan-sec">
        <h2 id="plan-kind-h" className="plan-h2">
          What kind of trip?
        </h2>
        <ul className="kind-grid" role="list">
          {KINDS.map((k) => (
            <li key={k.id}>
              <button type="button" className="kind-tile" aria-pressed={flow.kind === k.id} onClick={() => dispatch({ t: 'kind', kind: k.id, youngest, now: now() })}>
                <span className="kind-mark" aria-hidden="true" />
                <span className="kind-text">
                  <span className="kind-name">{k.label}</span>
                  <span className="kind-meta">
                    {k.meta.split(' · ').map((part, i) => (
                      <span key={i}>{i ? ' ' : ''}{part}</span>
                    ))}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {youngest !== null && defaultPace(youngest) === 'relaxed' ? <p className="plan-note">With a child under 6 we start with a relaxed pace.</p> : null}
      </section>

      <div className="plan-two plan-two-even">
        {ready && (shown.length || full || status === 'newer') ? (
          <section aria-labelledby="plan-plans-h" className="plan-sec">
            <h2 id="plan-plans-h" className="plan-h3">
              Your trips
            </h2>
            {status === 'newer' ? <Banner kind="caution">These trips were saved by a newer version of the site, so they are left alone.</Banner> : null}
            {full ? (
              <Banner kind="caution" action={<Link href="/mine/">Open Mine</Link>}>
                {PLAN_BUILDER_UI.deviceDrafts} trips on this device. Remove one to start another.
              </Banner>
            ) : null}
            <ul className="plan-rows" role="list">
              {shown.map((d) => {
                const name = draftName(d);
                const words = `${name} · ${plural(d.picks.length, 'place')} · ${draftStateWords(d)}`;
                return (
                  <li key={d.id} className="plan-row">
                    {d.lastBuild || d.template ? (
                      <Link className="plan-row-main" href={openTripHref(d.id)}>
                        {words}
                      </Link>
                    ) : (
                      <button type="button" className="plan-row-main" onClick={() => onResume(d)}>
                        {words}
                      </button>
                    )}
                    <Button variant="ghost" size="sm" aria-label={`Remove ${name}`} onClick={() => remove(d)}>
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
            <p className="plan-more">
              <Link href="/mine/">All trips in Mine</Link>
            </p>
          </section>
        ) : null}

        <section aria-labelledby="plan-from-h" className="plan-sec">
          <h2 id="plan-from-h" className="plan-h3">
            Or start from
          </h2>
          <ul className="plan-rows plan-links" role="list">
            <li>
              <Link href="/trips/">One of our trips</Link>
            </li>
            <li>
              <Link href="/places/">A place you saved</Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
