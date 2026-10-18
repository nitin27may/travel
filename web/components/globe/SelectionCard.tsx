'use client';

import { Button, ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EntityImage } from '@/components/ui/EntityImage';
import { Icon, kindIcon } from '@/components/ui/Icon';
import type { BasemapFeature } from '@/lib/globe/engine';
import type { GlobeCard } from '@/lib/globe/types';

/** Place or trip card (components 7.2): photo with credit, name, area chain, kind chip, completeness, and the one primary action. */
export function SelectionCard({ card, onClose }: { card: GlobeCard; onClose(): void }) {
  const icon = card.kind === 'trip' ? 'route' : kindIcon(card.glyph);
  return (
    <article className="globe-card" aria-label={card.title}>
      <div className="globe-card-photo">
        <EntityImage src={card.photo?.url ?? null} width={640} fallbackIcon={icon} />
        <Button size="sm" variant="secondary" icon aria-label="Close details" className="globe-card-x" onClick={onClose}>
          <Icon name="close" size={16} />
        </Button>
      </div>
      {card.photo ? (
        <p className="globe-card-credit">
          Photo: <a href={card.photo.sourceUrl} target="_blank" rel="noopener noreferrer">{card.photo.author}</a> · {card.photo.licence}
        </p>
      ) : null}
      <div className="globe-card-body">
        <h2 className="globe-card-title">{card.title}</h2>
        <p className="globe-card-area">{card.areaLabel}</p>
        <div className="globe-card-chips">
          <Chip kind="kind" icon={icon}>{card.kindLabel}</Chip>
          {card.badge ? <Chip kind={card.kind === 'trip' && card.badge !== 'Full plan' ? 'notice' : 'neutral'}>{card.badge}</Chip> : null}
          {card.approx ? <Chip kind="honest" title="The pin sits at the middle of the country, not at the exact place.">Location approximate</Chip> : null}
        </div>
        <ButtonLink variant="primary" href={card.href} className="globe-card-open">
          {card.kind === 'trip' ? 'Open trip' : 'Open place'}
          <Icon name="arrow" size={16} />
        </ButtonLink>
      </div>
    </article>
  );
}

export interface NearbyPlace { key: string; title: string; km: number }

/** A river, sea, peak, park or town picked off the basemap (or a landform from search). No page of its own: facts, saved places near it, and a fly-to. */
export function FeatureCard({ feature, nearby, onClose, onFly, onPick }: { feature: BasemapFeature; nearby: NearbyPlace[]; onClose(): void; onFly(): void; onPick(key: string): void }) {
  return (
    <aside className="globe-feature" aria-label={feature.name}>
      <p className="globe-feature-k">{feature.kind}</p>
      <p className="globe-feature-n">{feature.name}</p>
      {feature.extra ? <p className="globe-feature-m">{feature.extra}</p> : null}
      {nearby.length ? (
        <div className="globe-feature-near">
          <p className="globe-feature-k">Saved places near here</p>
          <ul>
            {nearby.map((n) => (
              <li key={n.key}><button type="button" onClick={() => onPick(n.key)}>{n.title}<span>{n.km < 1 ? '<1' : Math.round(n.km)} km</span></button></li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="globe-feature-actions">
        <Button size="sm" onClick={onFly}>Fly here</Button>
        {feature.wikidata ? <a href={`https://www.wikidata.org/wiki/${feature.wikidata}`} target="_blank" rel="noopener noreferrer">Wikidata</a> : null}
      </div>
      <Button size="sm" variant="ghost" icon aria-label="Clear selection" className="globe-feature-x" onClick={onClose}><Icon name="close" size={16} /></Button>
    </aside>
  );
}
