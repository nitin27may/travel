import { describe, expect, it } from 'vitest';
import { ageBasisWhy, ageLabel } from '@/lib/format/age';
import { kidsLabel } from '@/components/trips/tags/labels';
import { suitChips } from '@/lib/entities/descriptors/place';
import { activeFilters } from '@/lib/entities/filter';
import { placeDescriptor } from '@/lib/entities/descriptors/place';
import { decodeState } from '@/lib/entities/url';
import { fallbackLabel } from '@/lib/entities/valueLabels';
import { createPublicData } from '@/lib/public';
import { tripListRows } from '@/app/trips/rows';
import { placeRows } from '../places/support';

// Review 4.24: one age is written one way. The formatter is the only place an age phrase is made; the wording family is in
// docs/v2/design/suitability-display.md ("Age wording").
describe('ageLabel', () => {
  it('writes the control, the fit and the verdicts one way each', () => {
    expect(ageLabel('control', 6)).toBe('Youngest child 6');
    expect(ageLabel('control', 0)).toBe('Youngest child Baby');
    expect(ageLabel('fit', 6)).toBe('From about 6');
    expect(ageLabel('fit', 0)).toBe('Any age');
    expect(ageLabel('fit', 8, 'rule')).toBe('Minimum age 8');
    expect(ageLabel('fit', 0, 'rule')).toBe('No minimum age');
    expect(ageLabel('fits', 6)).toBe('Fits age 6');
    expect(ageLabel('advice_fail', 3)).toBe('Not suited to age 3');
    expect(ageLabel('rule_fail', 8)).toBe('Not for under 8 · operator rule');
  });

  it('keeps the basis words of a trip: our plan, or checked', () => {
    expect(ageLabel('fit', 6, 'plan')).toBe('From about 6 · our plan');
    expect(ageLabel('fit', 10, 'computed')).toBe('From about 10 · checked');
    expect(ageLabel('fit', 10, 'floor')).toBe('From about 10 · checked');
    expect(ageLabel('fit', 0, 'computed')).toBe('Any age · checked');
    expect(ageBasisWhy('plan')).toMatch(/stated age/);
  });

  it('never uses the dropped phrases anywhere it is asked for', () => {
    for (const kind of ['control', 'fit', 'fits', 'advice_fail', 'rule_fail'] as const) {
      for (const basis of [null, 'rule', 'advice', 'plan', 'computed', 'floor'] as const) for (const v of [0, 5, 12]) expect(ageLabel(kind, v, basis)).not.toMatch(/^Ages? \d|Kids from|\d\+ years/);
    }
  });
});

describe('every surface that draws an age calls it', () => {
  it('the trip card chip and the table cell read the same words', () => {
    expect(kidsLabel(6, 'plan').text).toBe(ageLabel('fit', 6, 'plan'));
    expect(kidsLabel(10, 'computed').text).toBe('From about 10 · checked');
    expect(kidsLabel(0, 'floor').text).toBe('Any age · checked');
  });

  it('the place card chip: a rule is "Minimum age", our advice is "From about", a gap is "not checked yet"', () => {
    const base = placeRows()[0]!;
    expect(suitChips({ ...base, kids_from: 8, kids_basis: 'rule' })[0]!.text).toBe('Minimum age 8');
    expect(suitChips({ ...base, kids_from: 6, kids_basis: 'advice' })[0]!.text).toBe('From about 6');
    expect(suitChips({ ...base, kids_from: 0, kids_basis: 'advice' })[0]!.text).toBe('Any age');
    expect(suitChips({ ...base, kids_from: null, kids_basis: null, kid_fit: 'unknown' })[0]!.text).toBe('Kids: not checked yet');
  });

  it('the filter bar names a chosen age "Youngest child N", and an old kid-fit value by its own words', () => {
    const labelOf = (p: string, v: string) => fallbackLabel(p as never, v);
    const six = activeFilters(decodeState('kid=6'), placeDescriptor, labelOf);
    expect(six.map((c) => c.label)).toEqual(['Youngest child 6']);
    const old = activeFilters(decodeState('kid=yes'), placeDescriptor, labelOf);
    expect(old.map((c) => c.label)).toEqual(['Easy with kids']);
    expect(old.map((c) => c.label).join()).not.toContain('Youngest child');
  });
});

// The Rockies: the card said "Kids from 5", the hero "Ages 5+", and the plan "from about 6". One stated age now feeds all three.
describe('one stated age for a plan (the Rockies)', () => {
  const data = createPublicData();
  it('the hero, the card and the plan bar agree on 6', () => {
    const trip = data.getTrip('canadian-rockies-2029')!;
    expect(trip.schedule!.defaultProfile.youngest).toBe(6);
    expect(trip.ageFit).toBe(6);
    const row = tripListRows().find((r) => r.slug === 'canadian-rockies-2029')!;
    expect(row.ageFit).toBe(6);
    expect(kidsLabel(row.ageFit!, row.kidsBasis).text).toBe('From about 6 · our plan');
    expect(trip.schedule!.writtenFor).toContain('from about 6');
  });

  it('a plan with no family profile keeps its typed age', () => {
    expect(data.getTrip('dolomites-2027')!.schedule!.defaultProfile.party).toBe('adults');
    expect(data.getTrip('utah-five-parks')!.ageFit).toBe(7);
  });
});
