import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ExportData } from '@/components/actions/ExportData';
import { placeExportFor, tripExportFor } from '@/lib/export/build.server';
import { placeSlugs, tripSlugs } from '@/lib/public';
import { readText } from '../helpers';
import { builtOutDir } from '../helpers/built';

// These tests pin the StaticAdapter (the files the build wrote); the API default has its own tests in tests/api.
vi.stubEnv('NEXT_PUBLIC_DATA_ADAPTER', 'static');

// Principle P8 (backlog 2.25): an export is the page's own data, never a file at a predictable address.

const OUT = builtOutDir();
const jsonOf = (html: string) => {
  const m = /<script type="application\/json" data-export-data="([^"]+)">([\s\S]*?)<\/script>/.exec(html);
  return m ? { key: m[1], data: JSON.parse(m[2].replace(/\\u003c/g, '<')) as { slug: string; type: string } } : null;
};

describe('ExportData', () => {
  it('writes the item as a JSON script that cannot close its own tag', () => {
    const data = { ...placeExportFor(placeSlugs()[0])!, title: 'A </script><b>x</b> place' };
    const html = renderToStaticMarkup(ExportData({ data }));
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(jsonOf(html)?.data.slug).toBe(data.slug);
  });
  it('writes nothing for an item with no export', () => {
    expect(renderToStaticMarkup(ExportData({ data: null }))).toBe('');
  });
});

describe('loadExport reads the page, not the network', () => {
  const page = (scripts: { key: string; text: string }[]) => ({
    querySelectorAll: () => scripts.map((s) => ({ getAttribute: () => s.key, textContent: s.text })),
  });
  it('resolves the export the page carries and never calls fetch', async () => {
    const trip = tripExportFor(tripSlugs()[0])!;
    vi.stubGlobal('document', page([{ key: `trip:${trip.slug}`, text: JSON.stringify(trip) }]));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { loadExport } = await import('@/lib/client/data');
    await expect(loadExport('trip', trip.slug)).resolves.toMatchObject({ type: 'trip', slug: trip.slug });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('rejects for an item the page does not carry, so one page cannot export another item', async () => {
    vi.stubGlobal('document', page([{ key: 'trip:a', text: '{}' }]));
    const { loadExport } = await import('@/lib/client/data');
    await expect(loadExport('trip', 'b')).rejects.toThrow(/No export data/);
    await expect(loadExport('place', 'a')).rejects.toThrow(/No export data/);
    vi.unstubAllGlobals();
  });
});

describe('the built pages', () => {
  it('every place page carries its own export and no other', () => {
    for (const slug of placeSlugs()) {
      const html = readText(path.join(OUT, 'places', slug, 'index.html'));
      expect(html.match(/data-export-data=/g), slug).toHaveLength(1);
      expect(jsonOf(html)?.key, slug).toBe(`place:${slug}`);
    }
  });
  it('every trip page carries its own export once, even with two action bars', () => {
    for (const slug of tripSlugs()) {
      const html = readText(path.join(OUT, 'trips', slug, 'index.html'));
      expect(html.match(/data-export-data=/g), slug).toHaveLength(1);
      expect(jsonOf(html)?.key, slug).toBe(`trip:${slug}`);
    }
  });
  it('the list pages carry no export data', () => {
    for (const p of ['places', 'trips']) expect(readText(path.join(OUT, p, 'index.html'))).not.toContain('data-export-data');
  });
});
