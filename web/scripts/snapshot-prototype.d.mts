export function sortKeys<T>(v: T): T;
export function snapshotTrip(trip: unknown, dropped?: unknown[]): unknown;
export function snapshotPlaces(places: unknown[]): unknown[];
export function snapshotPublicTrips(trips: unknown[], travellers: unknown[]): unknown[];
export function buildSnapshot(seed: Record<string, unknown>): Record<string, unknown>;
export function runSnapshot(seed: Record<string, unknown>, loadAdapter: () => Promise<unknown>, check: boolean): Promise<string[]>;
export const DATE_TEXT: RegExp;
