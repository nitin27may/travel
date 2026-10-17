// The generated files of the catalog: data/catalog/coverage.json and data/catalog/backlog.json. Both are deterministic for
// a given date; they are written only when the bytes change.
import { toBytes, toText } from "../store/index.ts";
import type { Store } from "../store/index.ts";
import { BACKLOG_PATH, COVERAGE_PATH, loadCatalog, loadDeps, loadLocationDoc, loadLocations, loadTrips, readJson } from "./common.ts";
import type { Row } from "./common.ts";
import { buildBacklog } from "./backlog.ts";
import { computeCoverage, coverageText } from "./coverage.ts";
import { serializeBacklog } from "./ops.ts";

async function inputs(store: Store, today: string) {
  const [data, deps, locations, doc, trips] = await Promise.all([loadCatalog(store), loadDeps(store), loadLocations(store), loadLocationDoc(store), loadTrips(store)]);
  return { data, deps, today, locations: { ...locations, regions: doc.regions ?? [], countries: doc.countries ?? [] }, placeRows: (doc.places ?? []) as Row[], trips };
}

export async function coverageFor(store: Store, today: string) {
  const { trips: _t, ...inp } = await inputs(store, today);
  return computeCoverage(inp);
}

async function writeIfChanged(store: Store, path: string, text: string): Promise<boolean> {
  const old = await store.read(path);
  if (old && toText(old) === text) return false;
  await store.write(path, toBytes(text), old ? await store.rev(path) : null);
  return true;
}

export async function writeCoverage(store: Store, today: string): Promise<boolean> {
  return writeIfChanged(store, COVERAGE_PATH, coverageText(await coverageFor(store, today)));
}

export async function backlogFor(store: Store, today: string): Promise<Row[]> {
  const inp = await inputs(store, today);
  const existing = ((await readJson(store, BACKLOG_PATH))?.backlog ?? []) as Row[];
  return buildBacklog({ ...inp, existing });
}

export async function writeBacklog(store: Store, today: string): Promise<{ rows: number; changed: boolean }> {
  const rows = await backlogFor(store, today);
  return { rows: rows.length, changed: await writeIfChanged(store, BACKLOG_PATH, serializeBacklog({ backlog: rows })) };
}
