import { describe, expect, it } from 'vitest';
import { FEATURE_ZOOM, PITCH_MIN_ZOOM, featureZoom, flightPlan, isWide, pitchAt, seaZoom, shiftPx, terrainRamp, wideZoom } from '@/lib/globe/flight';

describe('the fly-in table (spec 5.3, check 21)', () => {
  it('flies a country at pitch 20 with the subject 12% above centre in 1,800 ms at most', () => {
    expect(flightPlan('country', { terrain: false })).toMatchObject({ pitch: 20, shift: 0.12, maxDuration: 1800 });
  });
  it('tilts a state to 45 only with terrain on, a district and a place to 55', () => {
    expect(flightPlan('state', { terrain: true }).pitch).toBe(45);
    expect(flightPlan('state', { terrain: false }).pitch).toBe(0);
    expect(flightPlan('district', { terrain: true })).toMatchObject({ pitch: 55, shift: 0.18 });
    expect(flightPlan('place', { terrain: true })).toMatchObject({ pitch: 55, shift: 0.22 });
  });
  it('keeps an approximate pin flat and gives it the country composition', () => {
    expect(flightPlan('place', { terrain: true, approx: true })).toMatchObject({ pitch: 0, shift: 0.12 });
  });
  it('flies a trip at 40 and a feature in 900 ms: peaks and lakes at 45, seas and rivers flat', () => {
    expect(flightPlan('trip')).toMatchObject({ pitch: 40, shift: 0.15 });
    expect(flightPlan('feature', { terrain: true, featureClass: 'peak' })).toMatchObject({ pitch: 45, maxDuration: 900 });
    expect(flightPlan('feature', { terrain: true, featureClass: 'lake' }).pitch).toBe(45);
    expect(flightPlan('feature', { terrain: true, featureClass: 'sea' }).pitch).toBe(0);
    expect(flightPlan('feature', { terrain: true, featureClass: 'river' }).pitch).toBe(0);
  });
  it('lands features at the class zoom, seas by rank', () => {
    expect(FEATURE_ZOOM).toMatchObject({ river: 8, lake: 11, peak: 12, park: 10, city: 11 });
    expect(featureZoom('peak')).toBe(12);
    expect(seaZoom(1)).toBe(2.2);
    expect(seaZoom(6)).toBe(6);
    expect(featureZoom('sea', 2)).toBe(3.2);
  });
  it('holds no pitch below the terrain gate', () => {
    expect(pitchAt(45, PITCH_MIN_ZOOM - 0.1)).toBe(0);
    expect(pitchAt(45, PITCH_MIN_ZOOM)).toBe(45);
  });
  it('shifts the subject by a share of the free height', () => {
    expect(shiftPx(800, 0.12)).toBe(96);
    expect(shiftPx(-5, 0.2)).toBe(0);
  });
  it('sends a country wider than 170 degrees to its mainland box on the globe', () => {
    expect(isWide(171)).toBe(true);
    expect(isWide(169)).toBe(false);
    expect(wideZoom(1)).toBe(2.6);
    expect(wideZoom(9)).toBe(3.2);
  });
  it('grows the relief in five steps from the terrain gate', () => {
    expect(terrainRamp(3.4, 1.2)).toBe(0);
    expect(terrainRamp(3.5, 1)).toBe(0.2);
    expect(terrainRamp(3.9, 1)).toBe(0.4);
    expect(terrainRamp(5, 1.2)).toBe(1.2);
  });
});

describe('explicit flight durations (spec 5.3, review M1)', () => {
  const country = { maxDuration: 1800 };
  it('never asks MapLibre to cut: every hop gets a duration, long ones capped at 2.4 s', async () => {
    const { flightDuration, LONG_FLIGHT_CAP_MS } = await import('@/lib/globe/flight');
    expect(flightDuration(3, 300, country)).toBeLessThan(1600);
    expect(flightDuration(3, 300, country)).toBeGreaterThan(900);
    expect(flightDuration(10, 6000, { maxDuration: 1600 })).toBe(LONG_FLIGHT_CAP_MS);
    expect(flightDuration(-6, 4000, country)).toBeGreaterThan(1500);
    expect(flightDuration(0, 0, country)).toBeGreaterThanOrEqual(500);
    expect(flightDuration(6, 900, { maxDuration: 900 })).toBeLessThanOrEqual(1200);
  });
});
