'use client';

import { BadgeRow } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { GroupHeading } from './GroupHeading';
import { OpenLink } from './OpenLink';
import type { ViewProps } from './viewTypes';

export function CardsView<Row>({ d, groups, state, onOpen }: ViewProps<Row>) {
  // the high-priority image is the first card that has a photo (a leading group of photoless trail pages must not leave the list with none)
  const lead = groups.flatMap((g, gi) => g.rows.map((row, ri) => ({ gi, ri, has: !!d.image?.(row) }))).find((x) => x.has) ?? { gi: 0, ri: 0 };
  return (
    <div className="cards-view">
      {groups.map((g, gi) => (
        <section key={g.key || gi} aria-labelledby={g.key ? `grp-${gi}` : undefined}>
          <GroupHeading group={g} id={`grp-${gi}`} />
          <ul className="card-grid">
            {g.rows.map((row, ri) => {
              const id = d.id(row);
              return (
                <li key={id}>
                  <Card
                    variant={d.type === 'trip' ? 'publicTrip' : d.type === 'trail' ? 'trail' : 'place'}
                    priority={gi === lead.gi && ri === lead.ri}
                    eager={gi === lead.gi && ri > lead.ri && ri < lead.ri + 4}
                    data-entity-id={id}
                    data-focused={state.focus === id || undefined}
                    data-fade={d.fade?.(row)}
                    photo={d.image?.(row) ?? null}
                    fallbackIcon={d.iconFor(row)}
                    fallbackLabel={d.fallbackLabel?.(row)}
                    title={
                      <OpenLink id={id} state={state} href={d.href(row)} primary={d.primary} onOpen={onOpen} className="card-open">
                        {d.title(row)}
                      </OpenLink>
                    }
                    meta={d.subtitle?.(row)}
                    chips={d.badges ? <BadgeRow badges={d.badges(row)} /> : undefined}
                    summary={d.summary?.(row)}
                    footer={d.cardFooter?.(row)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
