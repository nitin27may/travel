import type { ReactNode } from 'react';
import type { TripTab } from '@travel/core/trips/tabs.ts';

/**
 * One tab's panel (WAI-ARIA tabs, components 1.6): `role="tabpanel"` labelled by its tab, a programmatic focus target (`tabindex="-1"`),
 * `hidden` unless it is the tab on screen. The markup of every panel is in the page, so a reader without script gets the whole page in order
 * (the stylesheet's `noscript` rule un-hides them). The ids match `PageTabs` with the prefix `trip`.
 */
export function TripPanel({ tab, current, children, className }: { tab: TripTab; current: TripTab; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`trip-panel-${tab}`} aria-labelledby={`trip-tab-${tab}`} tabIndex={-1} hidden={current !== tab} data-panel={tab} className={className ? `trip-panel ${className}` : 'trip-panel'}>
      {children}
    </div>
  );
}
