/**
 * The heavy, pure part of opening an area (spec 8.3): turning a TopoJSON into shapes with boxes, slugs and centres, counting our
 * places into them, and writing the GeoJSON MapLibre draws. It runs in a Web Worker (`geo.worker.ts`) so no long task lands on the
 * main thread after the first paint, and inline in tests and where Workers are missing. No map, no DOM, no fetch.
 */
import { bbox, centroid, forRender, inFeature, tally, topoFeatures, type Feat, type FeatColl, type Topology } from './geometry';
import type { CountryFacts } from './types';

export const slugify = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Turns a decoded admin topology into sorted features with a bbox, centroid and URL slug each. */
export function adminFeatures(topo: Topology): FeatColl {
  const fc = topoFeatures(topo, topo.objects[Object.keys(topo.objects)[0]]);
  fc.features = fc.features.filter((f) => f.geometry);
  fc.features.forEach((f) => {
    f.properties.name = (f.properties.name as string) || (f.properties.shapeName as string) || '?';
    f._bbox = bbox(f);
    f._c = centroid(f);
    f.properties.slug = slugify(String(f.properties.name));
  });
  fc.features.sort((a, b) => String(a.properties.name).localeCompare(String(b.properties.name)));
  fc.features.forEach((f, i) => { f.id = i; });
  return fc;
}

export interface PlacePoint { id: string; lon: number; lat: number }
export interface AdminJob {
  topo: Topology;
  /** Our places, counted into the shapes (`properties.n`). */
  pins: PlacePoint[];
  /** Keep only the shapes whose centre is inside this one: geoBoundaries districts do not always nest in Natural Earth states. */
  within?: Feat | null;
}
export interface AdminResult {
  /** The shapes with their boxes and counts, for hit tests on the main thread. */
  fc: FeatColl;
  /** The GeoJSON text MapLibre draws (antimeridian-safe), handed to it as a URL so the main thread never parses it. */
  render: string;
}

export function buildAdmin(job: AdminJob): AdminResult {
  let fc = adminFeatures(job.topo);
  const within = job.within;
  if (within) {
    fc = { type: 'FeatureCollection', features: fc.features.filter((d) => d._c && inFeature(within, d._c)).map((d, k) => ({ ...d, id: k, properties: { ...d.properties } })) };
  }
  tally(fc, job.pins);
  return { fc, render: JSON.stringify(forRender(fc)) };
}

export interface CountriesJob { topo: Topology; facts: Record<string, CountryFacts> }
export interface CountriesResult {
  /** Shapes without geometry (the main thread needs their boxes, centres and properties, not their points). */
  fc: FeatColl;
  render: string;
}

export function buildCountriesShapes(job: CountriesJob): CountriesResult {
  const fc = topoFeatures(job.topo, job.topo.objects.countries);
  fc.features.forEach((f) => {
    f.id = Number(f.id);
    f.properties.ccn3 = String(f.id).padStart(3, '0');
    f._bbox = bbox(f);
    f._c = centroid(f);
  });
  const render = JSON.stringify(forRender(fc));
  return { fc: { type: 'FeatureCollection', features: fc.features.map((f) => ({ ...f, geometry: null })) }, render };
}

/** The NE lake polygons as the GeoJSON text MapLibre draws; names and Wikidata ids ride along in the properties. */
export function buildLakes(topo: Topology): string {
  const fc = topoFeatures(topo, topo.objects[Object.keys(topo.objects)[0]]);
  fc.features = fc.features.filter((f) => f.geometry && f.properties.name);
  fc.features.forEach((f, i) => { f.id = i; });
  return JSON.stringify(forRender(fc));
}
