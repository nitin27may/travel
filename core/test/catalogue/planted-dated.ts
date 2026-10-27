// A StubStore with one record under a dated legacy folder (public-ref-aliases 4): `route/larch-basin` becomes
// `legacy/stub-rockies-sept-2029/hikes/larch-basin` everywhere it appears (row, detail, sections, registry keys), and the registry pins
// the folder alias. The contract kit runs on `publicStore` over it (target `stub-public`), so K7 and every shape case see public refs.
import { publicStore } from "../../src/catalogue/public-store.ts";
import { StubStore, stubData, type StubData } from "../../src/catalogue/stub/index.ts";
import type { ContractTarget } from "./contract/index.ts";

export const PLANTED_DATED = "stub-rockies-sept-2029";
export const PLANTED_ALIAS = "stub-rockies-2029";
export const PLANTED_TABLE: Readonly<Record<string, string>> = Object.freeze({ [PLANTED_DATED]: PLANTED_ALIAS });
const FROM = "route/larch-basin";
const TO = `legacy/${PLANTED_DATED}/hikes/larch-basin`;

/** A JSON value with every string and key equal to FROM, or starting `FROM#`, renamed. */
function rename(x: unknown): unknown {
  const r = (s: string) => (s === FROM || s.startsWith(`${FROM}#`) ? TO + s.slice(FROM.length) : s);
  if (typeof x === "string") return r(x);
  if (Array.isArray(x)) return x.map(rename);
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x).map(([k, v]) => [r(k), rename(v)]));
  return x;
}

export function plantedDatedData(): StubData {
  const d = rename(stubData()) as StubData;
  d.registry.trips.folderAliases = { ...PLANTED_TABLE };
  return d;
}

export const plantedDatedStub = (): StubStore => new StubStore({ data: plantedDatedData() });

/** The inner StubStore of a wrapped store, so K4's row-read count still reads the real store. */
const inners = new WeakMap<object, StubStore>();
function wrap(inner: StubStore) {
  const w = publicStore(inner, PLANTED_TABLE);
  inners.set(w, inner);
  return w;
}

/**
 * The stub target of contract.test.ts (`base`), its store wrapped by publicStore over the planted data; with no base, the facts K7 reads
 * (public-store.test.ts).
 */
export function publicTarget(base?: ContractTarget): ContractTarget {
  const common = {
    name: "stub-public",
    make: () => wrap(plantedDatedStub()),
    registry: () => plantedDatedData().registry,
    rowReads: (s: object) => inners.get(s)?.rowReads ?? Number.NaN,
  };
  if (!base) return { ...common, facts: STANDALONE_FACTS };
  return {
    ...base,
    ...common,
    makeChanged: () => {
      const d = plantedDatedData();
      d.places[0]!.row.name = `${d.places[0]!.row.name} (renamed)`;
      return wrap(new StubStore({ data: d }));
    },
    // planted towns, outlines, pins and hidden keys: the base stub's own planting, through the wrapper (no dated ref there)
    ...(base.plant ? { plant: async (p) => wrap((await base.plant!(p)) as StubStore) } : {}),
  };
}

const STANDALONE_FACTS: ContractTarget["facts"] = {
  placeSlug: "glacier-lake",
  tripSlug: "stub-rockies-loop",
  approxSlugs: ["black-sand-arch"],
  region: { cc: "CA", canonical: "alberta", aliases: ["CA-AB", "AB", "Alberta", "Alta"] },
  near: { token: "place:glacier-lake", unknown: "place:no-such-place-anywhere" },
  town: { id: "ca-ab-canmore", layer: true },
  exportPlace: "glacier-lake",
  registryIds: new Set(),
  featureId: "ne-range-1",
  pinCountry: "ca",
};
