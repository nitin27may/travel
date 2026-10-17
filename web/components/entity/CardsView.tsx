'use client';

import { BadgeRow } from '@/components/ui/Badge';
import { EntityImage } from '@/components/ui/EntityImage';
import { GroupHeading } from './GroupHeading';
import { OpenLink } from './OpenLink';
import type { ViewProps } from './viewTypes';

export function CardsView<Row>({ d, groups, state, onOpen }: ViewProps<Row>) {
  return (
    <div className="cards-view">
      {groups.map((g, gi) => (
        <section key={g.key || gi} aria-labelledby={g.key ? `grp-${gi}` : undefined}>
          <GroupHeading group={g} id={`grp-${gi}`} />
          <ul className="card-grid">
            {g.rows.map((row) => {
              const id = d.id(row);
              const summary = d.summary?.(row);
              return (
                <li key={id}>
                  <article className="card" data-entity-id={id} data-focused={state.focus === id || undefined}>
                    <div className="card-media">
                      <EntityImage src={d.image?.(row) ?? null} width={560} fallbackIcon={d.iconFor(row)} fallbackLabel={d.fallbackLabel?.(row)} />
                    </div>
                    <div className="card-body">
                      <h3 className="card-title">
                        <OpenLink id={id} state={state} href={d.href(row)} primary={d.primary} onOpen={onOpen} className="card-open">
                          {d.title(row)}
                        </OpenLink>
                      </h3>
                      {d.subtitle ? <p className="card-sub">{d.subtitle(row)}</p> : null}
                      {d.badges ? <BadgeRow badges={d.badges(row)} /> : null}
                      {summary ? <p className="card-note">{summary}</p> : null}
                      {d.cardFooter ? <div className="card-foot">{d.cardFooter(row)}</div> : null}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
