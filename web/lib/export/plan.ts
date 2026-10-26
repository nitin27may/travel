// The trip export as the page shows it (review SHOULD-7, PL2): the page's chosen timeline applied to the export model by core's one
// function (core/src/export/plan.ts `forTimeline`), which the API's default-profile files use too (BACKLOG 15.223a; TRP-GL-C review F4).
// The page passes its session: the timelines and, when it published them, the displayed days (zone lines and "about" applied).
// Pure, and no longer reaches into components/ (review F8): `printTime` is core's.
import { forTimeline, printTime } from '@travel/core/export/plan.ts';
import type { TimelineSession } from './timelineState';
import type { TripExport } from './types';

type PageSession = Pick<TimelineSession, 'timelines'> & Partial<Pick<TimelineSession, 'display'>>;

export function forPage(model: TripExport, session: PageSession | null): TripExport {
  return forTimeline(model, session);
}

export { printTime };
