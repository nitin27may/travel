import { describe, expect, it } from 'vitest';
import { factsLine, languagesLine, populationLine } from '@/lib/globe/facts';

const italy = { a2: 'IT', a3: 'ITA', name: 'Italy', capital: 'Rome', population: 58850717, area: 301336, languages: ['Italian', 'Sardinian', 'German', 'French'] };

describe('country facts', () => {
  it('formats people compactly', () => {
    expect(populationLine(58850717)).toBe('59M people');
    expect(populationLine(5800000)).toBe('5.8M people');
    expect(populationLine(106739)).toBe('107k people');
  });
  it('builds the tooltip line for a country with nothing saved', () => {
    expect(factsLine(italy)).toBe('Capital Rome · 59M people · 301,336\u00a0km²');
    expect(languagesLine(italy)).toBe('Italian, Sardinian, German');
  });
  it('is empty without facts', () => {
    expect(factsLine(undefined)).toBe('');
    expect(languagesLine({ a2: 'XX', a3: 'XXX', name: 'X' })).toBe('');
  });
});
