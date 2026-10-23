import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renditionOf, resetRenditionsForTest } from '@/lib/server/images';

// audit GB-A-14: a missing or empty .generated/image-map.json used to drop every photo without a word.
const url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Anything.jpg?width=640';

describe('the image map', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetRenditionsForTest();
  });

  it('logs once, naming the file, when the map is missing', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'no-map-'));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    resetRenditionsForTest();
    expect(renditionOf(url)).toBeNull();
    expect(renditionOf(url)).toBeNull();
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0]![0])).toContain(path.join(dir, '.generated', 'image-map.json'));
  });
});
