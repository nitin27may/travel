// What the server hands the trip's shape (UXB-3; spec trip-and-places-ux-fixes.md 4.5): the light facts core's `tripShape` needs besides the
// timelines the page already carries, as plain JSON (P8). The shape component calls `tripShape` with the timelines on screen, on the server
// for the plan as written (the collapsed ribbon and count line) and in the browser for the visitor's party, so the two can never disagree.
import type { ShapeBaseInput, ShapeModel } from '@travel/core/trips/shape.ts';

export interface ShapeFacts {
  bases: ShapeBaseInput[];
  /** The plan's own drive figure by day, where it has one (a condensed day: the scheduler invents no legs). */
  planned: Record<number, number>;
  bookingDays: number[];
  highlightSlugs: string[];
  highlightVersions: Record<number, string[]>;
}

export type ShapePhraseKey = ShapeModel['phrases'][number]['key'];
