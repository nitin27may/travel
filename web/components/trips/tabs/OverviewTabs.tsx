'use client';

import type { ReactNode } from 'react';
import { TAB_LABEL, type TripTab } from '@travel/core/trips/tabs.ts';
import { PageTabs } from '@/components/ui/PageTabs';
import '@/styles/trip-tabs.css';
import { useTripUrl } from '../useTripUrl';
import { TripPanel } from './TripPanel';
import { followLink, useTripTabs } from './useTripTabs';

interface Props {
  slug: string;
  /** `tripTabsFor` of the trip: an overview trip has the Summary and, with a gallery, Photos. */
  available: TripTab[];
  counts: Partial<Record<TripTab, number>>;
  summary: ReactNode;
  photos: ReactNode;
}

/** The tab bar of a trip with no days yet (spec 3.5 "overview"): Summary and Photos, with the same URL, memory and keyboard as the full page. */
export function OverviewTabs({ slug, available, counts, summary, photos }: Props) {
  const url = useTripUrl();
  const tabs = useTripTabs(slug, url, available);
  return (
    <div className="trip-tabs" data-tab={tabs.tab} onClick={(e) => followLink(e, tabs.follow)}>
      <PageTabs label="Trip sections" idPrefix="trip" tabs={available.map((t) => ({ value: t, label: TAB_LABEL[t], count: counts[t] ?? null }))} value={tabs.tab} onActivate={tabs.select} />
      <TripPanel tab="summary" current={tabs.tab}>{summary}</TripPanel>
      {available.includes('photos') && tabs.seen.has('photos') ? <TripPanel tab="photos" current={tabs.tab}>{photos}</TripPanel> : null}
    </div>
  );
}
