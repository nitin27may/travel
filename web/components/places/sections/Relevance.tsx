import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { GapChip, RefLink } from '@/components/suit/Rows';
import { withUnits } from '@/components/suit/html';
import { provenanceLines, type PairPlace, type PublicRelevance, type SimilarPlace } from '@/lib/public/relevance';

// The relevance blocks of a page (relevance 3.2, 3.6, 6.2; place-page-sections PS5, PS8 to PS10). The badge is one label in an
// outlined chip with a signpost: never filled, never amber, never green (PS5). Nothing here shows a rating or a review count.

function Signpost() {
  return <Icon name="route" size={13} />;
}

/** The badge as a disclosure: the chip is the summary, the provenance opens under it, non-modal, and Esc closes it. */
export function Badge({ rel }: { rel: PublicRelevance }) {
  if (!rel.badge) {
    return rel.notJudged ? (
      <p className="rv-badge-row">
        <GapChip>Worth the trip? Not checked yet</GapChip>
      </p>
    ) : null;
  }
  const lines = rel.provenance ? provenanceLines(rel.provenance) : [];
  return (
    <details className="rv-badge su-prov">
      <summary>
        <span className="rv-chip">
          <Signpost />
          {rel.badge.label}
        </span>
        <span className="sr-only"> (why)</span>
      </summary>
      <div className="sp rv-pop" role="group" aria-label="Why this badge">
        {lines.map((l, i) => (
          <p key={i} className={i === lines.length - 1 ? 'sp-note' : undefined}>
            {l}
          </p>
        ))}
      </div>
    </details>
  );
}

/** The cover's relevance lines: why, the payoff a route takes its draw from, "Part of", the far-visitor pointer (PS9). */
export function CoverRelevance({ rel, slugs, name }: { rel: PublicRelevance; slugs: Record<string, string>; name: string }) {
  return (
    <div className="rv-cover">
      {rel.payoff && rel.payoff.name.toLowerCase() !== name.toLowerCase() ? (
        <p className="rv-payoff">
          To <strong><RefLink r={rel.payoff} slugs={slugs} /></strong>
          <span className="pb"> · photo and judgement from the place it reaches</span>
        </p>
      ) : rel.payoffMissing ? (
        <p className="rv-payoff">
          <GapChip>Payoff place not checked yet</GapChip>
        </p>
      ) : null}
      <Badge rel={rel} />
      {rel.why ? <p className="rv-why">{rel.why}</p> : null}
      {rel.partOf.length ? (
        <p className="rv-part">
          Part of{' '}
          {rel.partOf.map((p, i) => (
            <span key={p.ref}>
              {i ? ', ' : ''}
              <RefLink r={p} slugs={slugs} />
            </span>
          ))}
        </p>
      ) : rel.pointer ? (
        <p className="rv-pointer">
          <Icon name="navigate" size={14} />
          {rel.pointer.text.split(rel.pointer.name)[0]}
          <strong>
            <RefLink r={rel.pointer} slugs={slugs} />
          </strong>
          {rel.pointer.text.split(rel.pointer.name)[1]}
          <span className="pb"> · <data className="ukm" value={String(Math.round(rel.pointer.km))}>{Math.round(rel.pointer.km)} km</data></span>
        </p>
      ) : null}
    </div>
  );
}

const km = (n: number | null): string => (n === null ? '' : `${n < 10 ? Math.round(n * 10) / 10 : Math.round(n)} km`);

function Pair({ p, slugs }: { p: PairPlace; slugs: Record<string, string> }) {
  const extra = p.relation === 'starts_here' ? (p.onSiteMin ? `starts here · about ${Math.round(p.onSiteMin / 60)} h` : 'starts here') : p.extraMin ? `about ${p.extraMin} min extra` : '';
  return (
    <li className="rv-row">
      <div>
        <p className="rv-name">
          <RefLink r={p} slugs={slugs} />
          {p.badge ? <span className="rv-chip rv-chip-sm"><Signpost />{p.badge.label}</span> : null}
        </p>
        {p.reason ? <p className="rv-reason">{p.reason}</p> : null}
        <p className="pb" dangerouslySetInnerHTML={{ __html: withUnits([p.handPicked ? 'our pick' : null, p.how, km(p.km) || null, extra || null].filter(Boolean).join(' · ')) }} />
      </div>
    </li>
  );
}

function Similar({ s, slugs }: { s: SimilarPlace; slugs: Record<string, string> }) {
  return (
    <li className="rv-row">
      <div>
        <p className="rv-name">
          <RefLink r={s} slugs={slugs} />
          {s.planB ? <span className="rv-tag">Plan B</span> : null}
          {s.badge ? <span className="rv-chip rv-chip-sm"><Signpost />{s.badge.label}</span> : null}
        </p>
        <p className="pb" dangerouslySetInnerHTML={{ __html: withUnits([s.access, s.effortName, km(s.km)].filter(Boolean).join(' · ')) }} />
      </div>
    </li>
  );
}

/** Section 11: "Nearby, worth adding" (as well as), then "Similar nearby" (instead of). A block with nothing to say is not drawn. */
export function Nearby({ rel, slugs, closing }: { rel: PublicRelevance; slugs: Record<string, string>; closing: string | null }) {
  return (
    <>
      {rel.pairs.length ? (
        <ul className="rv-list" aria-label="Nearby, worth adding">
          {rel.pairs.map((p) => (
            <Pair key={p.ref} p={p} slugs={slugs} />
          ))}
        </ul>
      ) : closing ? (
        <p className="sc">
          {closing}
        </p>
      ) : null}
      {rel.similar.length ? (
        <div className="rv-similar">
          <h3 className="ps-sub">Similar nearby</h3>
          <ul className="rv-list">
            {rel.similar.map((s) => (
              <Similar key={s.ref} s={s} slugs={slugs} />
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/** Plan B under the risk it answers (PS8): one line after the booking line in "Before you go". */
export function PlanBLine({ rel, slugs }: { rel: PublicRelevance; slugs: Record<string, string> }) {
  const b = rel.planB;
  if (!b) return null;
  return (
    <li className="ps-line rv-planb">
      <span className="rv-tag">Plan B</span>
      <p className="pt">
        {b.risk ? `${b.risk.charAt(0).toUpperCase()}${b.risk.slice(1)} can fall through. ` : ''}
        <RefLink r={b} slugs={slugs} /> is the same kind of draw: {b.access}
        {b.effortName ? ` · ${b.effortName.toLowerCase()}` : ''} · {km(b.km)}.
      </p>
    </li>
  );
}
