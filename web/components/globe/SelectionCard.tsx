'use client';

import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EntityImage } from '@/components/ui/EntityImage';
import { Icon, kindIcon } from '@/components/ui/Icon';
import { formatDistance, formatElevation } from '@/lib/format/units';
import { usePrefs } from '@/lib/format/prefs';
import type { BasemapFeature } from '@/lib/globe/engine';
import type { CardFact, GlobeCard } from '@/lib/globe/types';
import type { FeatureFacts } from '@/lib/globe/wikidata';
import { directionsUrl } from '@/lib/globe/links';

/** The value of a fact in the visitor's units (the page's km/m or mi/ft switch). */
function useFactText(): (f: CardFact) => string {
  const [prefs] = usePrefs();
  return (f) => ('text' in f ? f.text : 'elevationM' in f ? formatElevation(f.elevationM, prefs.elevation) : formatDistance(f.distanceKm, prefs.distance));
}

/**
 * Place or trip card (spec 4.3, components 7.2). Image first: the place's photo, a gallery photo, the Wikidata image, or a compact
 * header with the kind glyph and the area, never an empty well (F6). Then kicker, title, one line, three facts, the trip that uses
 * it, and the actions. A field with no value is left out, never shown as "unknown". The card never says "Draft" and never shows a
 * household status.
 */
export function SelectionCard({ card, point, onClose }: { card: GlobeCard; point?: { lat: number; lon: number } | null; onClose(): void }) {
  const icon = card.kind === 'trip' ? 'route' : kindIcon(card.glyph);
  const factText = useFactText();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${window.location.origin}${card.kind === 'trip' ? `/globe/trip/${card.slug}/` : `/globe/place/${card.slug}/`}`;
    try {
      if (navigator.share) await navigator.share({ title: card.title, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    } catch { /* the visitor closed the share sheet */ }
  };
  const img = card.image;
  return (
    <article className="globe-card" aria-label={card.title}>
      {img ? (
        <div className="globe-card-photo">
          <EntityImage src={img.url} width={640} sizes="360px" fallbackIcon={icon} />
          <span className="globe-card-credit-on">
            <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer">{img.author}</a> · {img.licence}
          </span>
          <Button size="sm" variant="secondary" icon aria-label="Close details" className="globe-card-x" onClick={onClose}>
            <Icon name="close" size={16} />
          </Button>
        </div>
      ) : (
        <div className="globe-card-head">
          <span className="globe-card-glyph" aria-hidden="true"><Icon name={icon} size={24} /></span>
          <span className="globe-card-head-area">{card.areaLabel}</span>
          <Button size="sm" variant="ghost" icon aria-label="Close details" onClick={onClose}>
            <Icon name="close" size={16} />
          </Button>
        </div>
      )}
      <div className="globe-card-body">
        <p className="globe-card-kicker"><span>{card.kindLabel}</span>{img ? <> · {card.areaLabel}</> : null}</p>
        <h2 className="globe-card-title">{card.title}</h2>
        {card.summary ? <p className="globe-card-summary">{card.summary}</p> : null}
        {card.facts.length ? (
          <dl className="globe-card-facts">
            {card.facts.map((f) => (
              <div key={f.label}><dt>{f.label}</dt><dd>{factText(f)}</dd></div>
            ))}
          </dl>
        ) : null}
        {card.usedIn ? (
          <p className="globe-card-used">
            <Icon name="route" size={14} />
            <span>Used in <a href={`/trips/${card.usedIn.slug}/`}>{card.usedIn.title}</a>{card.usedIn.day ? `, day ${card.usedIn.day}` : ''}</span>
          </p>
        ) : null}
        <div className="globe-card-actions">
          <ButtonLink variant="primary" href={card.href} className="globe-card-open">
            {card.kind === 'trip' ? 'Open trip' : 'Open place'}
            <Icon name="arrow" size={16} />
          </ButtonLink>
          {point && !card.approx ? (
            <a className="globe-card-act" href={directionsUrl(point)} target="_blank" rel="noopener noreferrer"><Icon name="navigate" size={15} />Directions</a>
          ) : null}
          <button type="button" className="globe-card-act" onClick={share} aria-label={copied ? 'Link copied' : 'Share'} title={copied ? 'Link copied' : 'Share'}><Icon name={copied ? 'check' : 'share'} size={16} /></button>
        </div>
        <div className="globe-card-chips">
          {card.approx ? <Chip kind="honest" title="The pin sits at the middle of the country, not at the exact place.">Location approximate</Chip> : null}
          {card.badge ? <Chip kind={card.kind === 'trip' && card.badge !== 'Full plan' ? 'notice' : 'neutral'}>{card.badge}</Chip> : null}
        </div>
      </div>
    </article>
  );
}

export interface NearbyPlace { key: string; title: string; km: number }

/**
 * A river, sea, peak, park or town picked off the basemap (or a landform from search). It has no page of its own: facts from the tile and
 * from Wikidata (loaded after it opens, rows left out if the call fails), saved places near it, and a fly-to. Spec 4.2, 4.3.
 */
export function FeatureCard({ feature, facts, loading, nearby, boundary, onClose, onFly, onPick }: { feature: BasemapFeature; facts: FeatureFacts | null; loading: boolean; nearby: NearbyPlace[]; boundary?: 'loaded' | 'none' | null; onClose(): void; onFly(): void; onPick(key: string): void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* clipboard not allowed */ }
  };
  const wiki = facts?.wikipedia ?? `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(feature.name)}`;
  return (
    <aside className="globe-feature" aria-label={feature.name}>
      <p className="globe-feature-k">{feature.kind}{facts?.where ? ` · ${facts.where}` : ''}</p>
      <h2 className="globe-feature-n">{facts?.label ?? feature.name}</h2>
      {feature.extra ? <p className="globe-feature-m">{feature.extra}</p> : null}
      {loading ? (
        <div className="globe-feature-skel" aria-hidden="true"><span /><span /></div>
      ) : facts?.rows.length ? (
        <dl className="globe-feature-rows">
          {facts.rows.map((r) => (<div key={r.label}><dt>{r.label}</dt><dd title="Wikidata">{r.value}</dd></div>))}
        </dl>
      ) : null}
      {boundary === 'none' ? <p className="globe-feature-m">Boundary not loaded</p> : null}
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
        <a href={wiki} target="_blank" rel="noopener noreferrer">Wikipedia</a>
        <button type="button" className="globe-feature-copy" onClick={copy}>{copied ? 'Link copied' : 'Copy link'}</button>
      </div>
      {facts?.rows.length ? <p className="globe-feature-foot">Facts: OpenStreetMap, Wikidata</p> : <p className="globe-feature-foot">Facts: OpenStreetMap</p>}
      <Button size="sm" variant="ghost" icon aria-label="Clear selection" className="globe-feature-x" onClick={onClose}><Icon name="close" size={16} /></Button>
    </aside>
  );
}
