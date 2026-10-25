import { describe, expect, it } from 'vitest';
import { checkTitle, isUuid, parseDraftRows, TITLE_MAX } from '@/lib/drafts-shared';

describe('checkTitle (shared 1..160 rule)', () => {
  it('trims and accepts a normal title', () => {
    expect(checkTitle('  Patagonia ideas  ')).toEqual({ ok: true, title: 'Patagonia ideas' });
  });
  it('rejects empty or whitespace-only', () => {
    expect(checkTitle('')).toEqual({ ok: false, reason: 'empty' });
    expect(checkTitle('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(checkTitle(undefined)).toEqual({ ok: false, reason: 'empty' });
    expect(checkTitle(123)).toEqual({ ok: false, reason: 'empty' });
  });
  it('accepts exactly 160 and rejects 161 (after trim)', () => {
    expect(checkTitle('a'.repeat(TITLE_MAX)).ok).toBe(true);
    expect(checkTitle('a'.repeat(TITLE_MAX + 1))).toEqual({ ok: false, reason: 'too_long' });
  });
});

describe('isUuid', () => {
  it('accepts a v4-shaped uuid and rejects junk', () => {
    expect(isUuid('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});

describe('parseDraftRows (re-fetch payload → DraftRow[])', () => {
  it('converts ISO date strings back to Date', () => {
    const rows = parseDraftRows([{ id: 'd1', title: 'Rome', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T03:04:05.000Z' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].created_at).toBeInstanceOf(Date);
    expect(rows[0].updated_at.toISOString()).toBe('2026-01-02T03:04:05.000Z');
    expect(rows[0]).toMatchObject({ id: 'd1', title: 'Rome' });
  });
  it('accepts an empty list', () => {
    expect(parseDraftRows([])).toEqual([]);
  });
  it('throws on a non-array payload', () => {
    expect(() => parseDraftRows({ rows: [] })).toThrow();
    expect(() => parseDraftRows(null)).toThrow();
  });
  it('throws on a row missing id/title', () => {
    expect(() => parseDraftRows([{ title: 'x', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }])).toThrow();
  });
  it('throws on an invalid date rather than coercing', () => {
    expect(() => parseDraftRows([{ id: 'd1', title: 'x', created_at: 'not-a-date', updated_at: '2026-01-01T00:00:00Z' }])).toThrow();
  });
});
