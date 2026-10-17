import type { EntityDescriptor, EntityType } from './types';
import { placeDescriptor } from './descriptors/place';
import { tripDescriptor } from './descriptors/trip';

// Append-only: one line per entity type (later phases add trail, activity, stay ...).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const registry: Partial<Record<EntityType, EntityDescriptor<any>>> = {
  place: placeDescriptor,
  trip: tripDescriptor,
};
