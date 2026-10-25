import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ORIGIN_KEYS_PATH, SLUG_REGISTRY_PATH, parseRegistry } from '@travel/core/catalogue/slugs.ts';
import { REF_RE } from '@travel/core/schema/api/common.ts';
import { createJsonSource } from '@/lib/server/source';
import { buildPlaces, readOriginKeys } from '@/lib/public/places';
import { loadSources } from '@/lib/public/sources';
import { REPO } from './support';

// Owner ruling 23 Oct 2026 (audit GB-B-3, store.ts A24): no public output may tell which places come from the owner's wishlist. A page
// built from no capture record has the ref `place/<slug>`; its origin (`loc:<id>`, `proto:<id>`) stays in the private origin keys file.
const ORIGIN = /\b(?:loc|proto):/;

describe('place refs name no wishlist or prototype origin (A24)', () => {
  const pb = buildPlaces(loadSources());
  const origins = readOriginKeys(REPO).keys;

  it('every page ref is a capture ref or place/<slug>, distinct, and never an origin key', () => {
    const refs = [...pb.refBySlug.values()];
    expect(refs.length).toBe(355); // 359 before DATA-D4a folded five offers into their places
    expect(new Set(refs).size).toBe(refs.length);
    for (const [slug, ref] of pb.refBySlug) {
      expect(ref, slug).toMatch(REF_RE);
      expect(ref, slug).not.toMatch(ORIGIN);
    }
  });

  it('the 115 pages with no capture record (74 wishlist, 41 prototype) hold the ref their origin is pinned to, minted from their slug', () => {
    expect(pb.originRefs.size).toBe(115);
    const kinds = [...pb.originRefs.keys()].map((k) => k.split(':')[0]);
    expect(kinds.filter((k) => k === 'loc').length).toBe(74);
    expect(kinds.filter((k) => k === 'proto').length).toBe(41);
    for (const [origin, ref] of pb.originRefs) {
      expect(origins[origin], ref).toBe(ref);
      // no slug renamed yet, so each ref still equals `place/` and its slug
      expect(pb.refBySlug.get(ref.slice('place/'.length)), ref).toBe(ref);
    }
  });

  it('the registry, which may be published, holds no origin; the private file is the only place that does', () => {
    const registryText = readFileSync(path.join(REPO, SLUG_REGISTRY_PATH), 'utf8');
    expect(registryText).not.toMatch(ORIGIN);
    const reg = parseRegistry(registryText);
    for (const ref of Object.values(origins)) expect(reg.places.slugs[ref], ref).toBeDefined();
    expect(readFileSync(path.join(REPO, ORIGIN_KEYS_PATH), 'utf8')).toMatch(ORIGIN);
  });

  it('every API row and detail carries the dataset ref, and no API row, detail or export holds an origin key', () => {
    const src = createJsonSource();
    let text = '';
    for (const r of src.placeRows) {
      expect(r.ref, r.slug).toBe(pb.refBySlug.get(r.slug));
      text += JSON.stringify(r) + JSON.stringify(src.placeDetail(r.slug));
    }
    for (const t of src.tripRows) text += JSON.stringify(t) + JSON.stringify(src.tripDetail(t.slug));
    expect(text).not.toMatch(ORIGIN);
  });
});
