import { snapshotTrip, snapshotPlaces, snapshotPublicTrips } from '../../scripts/snapshot-prototype.mjs';

/** Runs the real allow-list functions over a trip with household values planted in every field. */
export function buildSnapshotAllowList() {
  const trip = {
    id: 'x', title: 'X', start: 'PLANTED-start', nights: 3, zone: 'Europe/Rome',
    travellers: [{ id: 't1', name: 'PLANTEDNAME', age: 7 }],
    days: [{ n: 1, base: 'hotel-cortina', itemIds: ['a', 'b'], title: 'Day one' }],
    lists: [{ id: 'l', name: 'PLANTED-list', itemIds: ['a'] }],
    items: {
      a: { id: 'a', placeId: 'p1', time: '09:00', note: 'Kai 8+ OK PLANTED', who: ['t1'], ticket: 'r1' },
      b: { id: 'b', placeId: 'p2', note: 'Ask PLANTEDNAME about the booked table' },
    },
    reservations: [
      { id: 'r-flight', kind: 'flight', title: 'PLANTED-title', code: 'PLANTED-code', cost: 'PLANTED-cost', phone: 'PLANTED-phone', email: 'PLANTED-email', address: 'PLANTED-address', dayN: 1, notes: 'PLANTED-notes', seats: { t1: 'PLANTED-seat' } },
      { id: 'r-x', kind: 'parking', title: 'Lot P1', code: 'PLANTED-code2', cost: 'PLANTED-cost2', opensAt: '30 days before', dayN: 2, tz: 'Europe/Rome', payment: { total: 1 } },
    ],
    tasks: [{ id: 'k', title: 'PLANTED-task' }],
  };
  const dropped: unknown[] = [];
  return {
    trip: snapshotTrip(trip, dropped),
    places: snapshotPlaces([{ id: 'h', kind: 'stay', name: 'PLANTED hotel' }, { id: 'p', kind: 'lake', name: 'Lake' }]),
    pub: snapshotPublicTrips([{ id: 'p-x', by: 'PLANTEDNAME', copies: 9, days: [{ n: 1, stops: [{ name: 'S', kind: 'hike', durationMin: 5, note: 'with PLANTEDNAME' }] }] }], trip.travellers),
  };
}
