// The add picker's near group reports `off` (not `ok` and empty) when it cannot ask, so the plan-model fallback runs on the static adapter.
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNearRows } from '@/components/trips/edit/add/useAdd';

const statusOf = (centre: { lat: number; lon: number } | null): string => {
  let out = '';
  const Probe = () => {
    out = useNearRows(centre).status;
    return null;
  };
  renderToStaticMarkup(<Probe />);
  return out;
};

describe('useNearRows status', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is off on the static adapter, where there is no API to ask', () => {
    vi.stubEnv('NEXT_PUBLIC_DATA_ADAPTER', 'static');
    expect(statusOf({ lat: 51, lon: -115 })).toBe('off');
  });

  it('is off when there is no point to search round', () => {
    vi.stubEnv('NEXT_PUBLIC_DATA_ADAPTER', 'api');
    expect(statusOf(null)).toBe('off');
  });

  it('is loading while the API read is on its way', () => {
    vi.stubEnv('NEXT_PUBLIC_DATA_ADAPTER', 'api');
    expect(statusOf({ lat: 51, lon: -115 })).toBe('loading');
  });
});
