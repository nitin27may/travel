import { describe, expect, it } from 'vitest';
import { JOIN_HELD_BACK } from '@/lib/public/places';
import { realData } from './support';

// META-1 (collision E1): a page whose capture record has its own point in a sidecar shows it, through the one `joinPoint` in places.ts.
// 121 pages had no point at the META-0 baseline (21 Oct, 81 of them trails); the join finds 27 of them one; 4 are held back (JOIN_HELD_BACK).
const d = realData();
const places = d.internals.places;
const pointOf = (slug: string) => places.find((p) => p.slug === slug)?.point ?? null;

const DEFERRED = ['sarrail-ridge', 'col-des-montets', 'thingvellir', 'toe-of-athabasca-glacier'];
const GAINED = [
  'bald-hills', 'delicate-arch-trail', 'devils-garden', 'fenland-loop', 'hickman-bridge', 'interlakes-trail-upper-and-lower-lake',
  'lago-federa-walk', 'lake-annette-loop', 'mary-schaffer-loop', 'mesa-arch', 'moose-lake-loop', 'paint-pots-walk', 'parker-ridge',
  'plain-of-six-glaciers-to-teahouse-and-abbot-pass-viewpoint', 'ptarmigan-cirque', 'rawson-lake', 'riverside-walk', 'rockwall-lookout-rockwall-fen',
  'scout-lookout-angels-landing-chains-view', 'solitaire-lake-trail', 'sunshine-meadows-to-citadel-pass',
  'upheaval-dome', 'wilcox-pass',
];

describe('the point join (places.ts joinPoint)', () => {
  it('gives the 23 pages their own sidecar point, with its source and licence', () => {
    for (const slug of GAINED) expect(pointOf(slug), slug).not.toBeNull();
    expect(pointOf('delicate-arch-trail')).toMatchObject({ pointSource: 'wikidata:Q2300616', sourceLicence: 'CC0' });
    expect(pointOf('rawson-lake')).toMatchObject({ pointSource: 'osm_node:269822212', sourceLicence: 'ODbL' });
    expect(pointOf('lago-federa-walk')).toMatchObject({ pointSource: 'osm_relation:3170182', sourceLicence: 'ODbL' });
  });
  it('counts: 30 of 436 pages have no point (35 before DG-02 gave five trails their own OSM trailhead; 436 since PA-R-CA added 5 park store places with points; 431 pages since AREA-2 added 76 store places, every one with a point; was 121 at META-0, 98 before DATA-D1, 58 before DATA-D1b, 38 before DATA-D4a folded five offers into places), 20 of them trails (25 before DG-02, 81 at META-0, 58 before DATA-D1, 45 before DATA-D1b)', () => {
    expect(places.length).toBe(436);
    expect(places.filter((p) => !p.point).length).toBe(30);
    expect(places.filter((p) => !p.point && p.kind === 'trail').length).toBe(20);
  });
  it('holds back four records (three for the size gate, the Toe car park row), by capture ref, and nothing else', () => {
    expect(JOIN_HELD_BACK.size).toBe(DEFERRED.length);
    for (const slug of DEFERRED) expect(pointOf(slug), slug).toBeNull();
  });
  it('never takes a derived trailhead or an approximate row as the record\'s own point', () => {
    // sidecar rows "trailhead ... at <ref>" are the place the trail starts from, not the trail's own coordinate
    for (const slug of ['emerald-lakeshore', 'lake-louise-lakeshore', 'iceline-trail', 'moraine-lakeshore']) expect(pointOf(slug), slug).toBeNull();
    // the Braies walk's track is not confirmed: its first vertex is an approximate row and gives no pin
    expect(pointOf('lago-di-braies-walk')).toBeNull();
  });
  it('is a pure fill: a page that had a point keeps exactly that point', () => {
    expect(pointOf('adolf-munkel-weg')).toMatchObject({ pointSource: 'osm_node:9812786780' });
  });
});
