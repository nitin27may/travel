export function sortKeys<T>(v: T): T;
export function snapshotTrip(trip: unknown, dropped?: unknown[]): unknown;
export function snapshotPlaces(places: unknown[]): unknown[];
export function snapshotPublicTrips(trips: unknown[], travellers: unknown[]): unknown[];
export function buildSnapshot(): Promise<Record<string, unknown>>;
export const DATE_TEXT: RegExp;
