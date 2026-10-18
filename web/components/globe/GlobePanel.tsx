'use client';

import { Icon, kindIcon } from '@/components/ui/Icon';
import type { CountryBook } from '@/lib/globe/countries';
import { nodeAt, pinsUnder } from '@/lib/globe/model';
import type { GlobeData } from '@/lib/globe/types';

interface Props {
  data: GlobeData;
  book: CountryBook;
  path: string[];
  selected: string | null;
  onArea(path: string[]): void;
  onCard(key: string): void;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const counts = (places: number, trips: number) => [places ? plural(places, 'place') : '', trips ? plural(trips, 'trip') : ''].filter(Boolean).join(' · ');

/**
 * The list equivalent of the canvas (components 7.2): saved places and published trips by continent and country with
 * flags and counts; inside a country it lists the states, trips and places. Everything on the canvas is reachable here.
 */
export function GlobePanelBody({ data, book, path, selected, onArea, onCard }: Props) {
  if (!path.length) {
    return (
      <div className="globe-list">
        {data.index.continents.map((c) => (
          <section key={c.slug} aria-labelledby={`gc-${c.slug}`}>
            <h3 className="globe-list-h" id={`gc-${c.slug}`}>
              <span>{c.name}</span>
              <span className="globe-list-count">{counts(c.places, c.trips)}</span>
            </h3>
            <ul>
              {c.countries.map((n) => {
                const f = book.byA2[n.slug]?.facts;
                return (
                  <li key={n.slug}>
                    <button type="button" className="globe-row" onClick={() => onArea([n.slug])}>
                      <span className="globe-flag" aria-hidden="true">{f?.flag ?? ''}</span>
                      <span className="globe-row-main">
                        <span className="globe-row-name">{f?.name ?? n.name}</span>
                        <span className="globe-row-meta">{counts(n.places, n.trips)}</span>
                      </span>
                      <Icon name="chevronRight" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    );
  }
  const node = nodeAt(data, path);
  const trips = pinsUnder(data, path.slice(0, 1), 'trip');
  const places = pinsUnder(data, path, 'place');
  const children = (node?.children ?? []).filter((c) => c.places + c.trips > 0);
  return (
    <div className="globe-list">
      {children.length ? (
        <section aria-label={path.length === 1 ? 'States and regions' : 'Districts'}>
          <h3 className="globe-list-h"><span>{path.length === 1 ? 'States and regions' : 'Districts'}</span></h3>
          <ul>
            {children.map((c) => (
              <li key={c.slug}>
                <button type="button" className="globe-row" onClick={() => onArea([...path, c.slug])}>
                  <span className="globe-row-main"><span className="globe-row-name">{c.name}</span><span className="globe-row-meta">{counts(c.places, c.trips)}</span></span>
                  <Icon name="chevronRight" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {trips.length ? (
        <section aria-label="Trips">
          <h3 className="globe-list-h"><span>Trips</span></h3>
          <ul>
            {trips.map((t) => {
              const key = `trip:${t.slug}`;
              return (
                <li key={key}>
                  <button type="button" className="globe-row" aria-current={selected === key ? 'true' : undefined} onClick={() => onCard(key)}>
                    <span className="globe-glyph"><Icon name="route" size={16} /></span>
                    <span className="globe-row-main"><span className="globe-row-name">{data.cards[key]?.title ?? t.name}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {places.length ? (
        <section aria-label="Places">
          <h3 className="globe-list-h"><span>Places</span><span className="globe-list-count">{places.length}</span></h3>
          <ul>
            {places.map((p) => {
              const key = `place:${p.slug}`;
              const card = data.cards[key];
              return (
                <li key={key}>
                  <button type="button" className="globe-row" aria-current={selected === key ? 'true' : undefined} onClick={() => onCard(key)}>
                    <span className="globe-glyph"><Icon name={kindIcon(p.type)} size={16} /></span>
                    <span className="globe-row-main"><span className="globe-row-name">{p.name}</span><span className="globe-row-meta">{card?.kindLabel}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
