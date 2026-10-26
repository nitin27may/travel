// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLocal, readSession, removeLocal, removeSession, writeLocal, writeSession } from '@/lib/storage/safe';

function fakeWindow(blocked: boolean) {
  const data = new Map<string, string>();
  const store = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  const w = {} as Record<string, unknown>;
  for (const name of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(w, name, blocked ? { get: () => { throw new DOMException('denied', 'SecurityError'); } } : { value: store });
  }
  vi.stubGlobal('window', w);
}

afterEach(() => vi.unstubAllGlobals());

describe('safe storage (review NAV-2 C1)', () => {
  it('returns null or false when the property access itself throws', () => {
    fakeWindow(true);
    expect(readLocal('k')).toBeNull();
    expect(readSession('k')).toBeNull();
    expect(writeLocal('k', 'v')).toBe(false);
    expect(writeSession('k', 'v')).toBe(false);
    expect(removeLocal('k')).toBe(false);
    expect(removeSession('k')).toBe(false);
  });
  it('reads, writes and removes when storage works', () => {
    fakeWindow(false);
    expect(writeLocal('k', 'v')).toBe(true);
    expect(readLocal('k')).toBe('v');
    expect(removeLocal('k')).toBe(true);
    expect(readLocal('k')).toBeNull();
    expect(writeSession('s', '1')).toBe(true);
    expect(readSession('s')).toBe('1');
    removeSession('s');
    expect(readSession('s')).toBeNull();
  });
});
