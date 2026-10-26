import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CopyItem } from '@travel/core/schema/copies.ts';

const resolveRefs = vi.fn();
vi.mock('@/lib/client/data', () => ({ resolveRefs }));

const item = (slug: string) => ({ slug }) as CopyItem;

beforeEach(() => {
  vi.stubGlobal('window', {});
  resolveRefs.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('resolveListing', () => {
  it('asks once for each distinct trip handle and marks withdrawn and unknown as no longer listed', async () => {
    const { resolveListing } = await import('@/lib/mine/listing');
    resolveRefs.mockResolvedValue([
      { asked: 'trip:a', state: 'current', name: 'Alpha' },
      { asked: 'trip:b', state: 'withdrawn', name: null },
      { asked: 'trip:c', state: 'unknown', name: null },
      { asked: 'trip:d', state: 'moved', name: 'Delta' },
    ]);
    const m = await resolveListing([item('a'), item('b'), item('c'), item('d'), item('a')]);
    expect(resolveRefs).toHaveBeenCalledWith(['trip:a', 'trip:b', 'trip:c', 'trip:d']);
    expect(m!.get('a')).toEqual({ state: 'listed', title: 'Alpha' });
    expect(m!.get('b')).toEqual({ state: 'unlisted' });
    expect(m!.get('c')).toEqual({ state: 'unlisted' });
    expect(m!.get('d')).toEqual({ state: 'listed', title: 'Delta' });
  });
  it('marks nothing when the adapter cannot answer or the request fails', async () => {
    const { resolveListing } = await import('@/lib/mine/listing');
    resolveRefs.mockResolvedValue(null);
    expect(await resolveListing([item('a')])).toBeNull();
    resolveRefs.mockRejectedValue(new Error('down'));
    expect(await resolveListing([item('a')])).toBeNull();
  });
});
