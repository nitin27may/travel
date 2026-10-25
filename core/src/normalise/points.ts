// Points: capture-points/1 to /2 (spec 4.2 "Points", RIS-C contract). The free-text `point_source` of a row is parsed into the
// structured `point_src` ({provider, element, url, read, quote, legacy}) and a RowMeta block (run id, review state, basis).
//
// What the parser takes from the text, and what it does not:
//   - "agent checked, needs a person's check" is the review state, not provenance: meta.review_state "agent_checked", text dropped
//     (spec 2.1, "Agent checked ..." row).
//   - "read YYYY-MM-DD (lane X)": the read date and the run id. A row that names no read date gets the run's `readDefault` and the
//     work tag `read-date-imputed`, so the guess is visible and can be searched for.
//   - the first URL, and the element (`node/123`, `way/9`, `relation/4`, `Q42`) only when the text OPENS with it ("OSM node 123 ...",
//     "Wikidata Q42 ..."): a string that mentions several elements ("mean of five bridges ...") names none as THE element.
//   - the rest of the text is the `quote` when it fits in 300 characters. Nothing is ever dropped silently: when the rest does not
//     fit, or the row is pinned by the migration ledger (gotcha 9: "Points with a pinned point_source keep the string in
//     point_src.legacy until a supersede replaces them"), the whole original string is kept in `legacy`.
//
// Rows are converted all or none per file (a /2 file needs point_src on every row), and a file with a row that fails the privacy or
// meta checks is left on /1 and reported.
import { privacyHits } from "../privacy/detect.ts";
import { metaFindings } from "../validate/rowMeta.ts";
import { PROPERTY_BY_KEY } from "../schema/capture/properties.ts";
import { Sink, isObj, seg, type Obj } from "./common.ts";

const CHECKED = /;?\s*agent checked, needs a person's check/gi;
const READ_LANE = /;?\s*read (\d{4}-\d{2}-\d{2})(?:\s*\(lane ([A-Za-z0-9][A-Za-z0-9._-]{0,78})\))?/g;
const LANE_ONLY = /\s*\(lane ([A-Za-z0-9][A-Za-z0-9._-]{0,78})\)/g;
const URL_RE = /https?:\/\/[^\s)'";]+/;
const OPENING_ELEMENT = /^(?:OSM\s+)?(node|way|relation)\s+(\d+)\b|^Wikidata\s+(Q[1-9]\d*)\b/;

/** Provider names by host, for the few official sources the points cite; any other host falls back to the text before the URL. */
const HOSTS: Readonly<Record<string, string>> = {
  "albertaparks.ca": "Alberta Parks",
  "parks.canada.ca": "Parks Canada",
  "nps.gov": "National Park Service",
  "snaefellsjokull.is": "Snaefellsjokull National Park",
  "vatnajokulsthjodgardur.is": "Vatnajokull National Park",
};

export interface PointSrcOut {
  provider: string;
  element?: string;
  url?: string;
  read: string;
  quote?: string;
  legacy?: string;
}

export interface ParsedPoint {
  point_src: PointSrcOut;
  meta: Obj;
  /** true when the read date was not in the text */
  imputed: boolean;
}

/** The detector reason that also fires on a business street address; every other reason is a hard refusal. */
const SOFT = "a household planning note";
const BASIS_OF_COORD: Readonly<Record<string, string>> = { osm: "community", wikidata: "community", official: "official_info", manual: "our_inference" };

function providerOf(coordSrc: string, text: string, url: string | undefined): string {
  if (coordSrc === "osm") return "OpenStreetMap";
  if (coordSrc === "wikidata") return "Wikidata";
  if (coordSrc === "manual") return "Manual entry";
  let host = "";
  if (url) {
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }
    const known = Object.entries(HOSTS).find(([h]) => host === h || host.endsWith(`.${h}`));
    if (known) return known[1];
  }
  const before = (url ? text.slice(0, text.indexOf(url)) : text).replace(/\s+/g, " ").trim();
  const words = before.split(" ").filter(Boolean);
  let name = "";
  for (const w of words) {
    if (`${name} ${w}`.trim().length > 80) break;
    name = `${name} ${w}`.trim();
  }
  return name || host || "Official source";
}

/**
 * Parses one `point_source` (undefined or empty when the v1 row had none). Pure: no file reads.
 * `pinned` is true for a ref the migration ledger pins; `run` names the run when the text names none.
 */
export function parsePointSource(text: string | undefined, coordSrc: string, opts: { pinned: boolean; readDefault: string; run: string }): ParsedPoint {
  const original = (text ?? "").trim();
  let t = original;
  const review = CHECKED.test(t);
  CHECKED.lastIndex = 0;
  t = t.replace(CHECKED, "");
  const reads: string[] = [];
  let lane: string | undefined;
  t = t.replace(READ_LANE, (_m, d: string, l?: string) => {
    reads.push(d);
    if (l && !lane) lane = l;
    return "";
  });
  t = t.replace(LANE_ONLY, (_m, l: string) => {
    lane ??= l;
    return "";
  });
  t = t.replace(/\s+/g, " ").replace(/^[;,\s]+|[;,\s]+$/g, "");
  const urlMatch = URL_RE.exec(t);
  const url = urlMatch ? urlMatch[0].replace(/[.,]+$/, "") : undefined;
  const el = OPENING_ELEMENT.exec(t);
  const element = el ? (el[3] ? el[3] : `${el[1]}/${el[2]}`) : undefined;
  const read = reads.length ? reads.reduce((a, b) => (a > b ? a : b)) : opts.readDefault;
  const imputed = reads.length === 0;
  const fits = t.length > 0 && t.length <= 300;
  const src: PointSrcOut = { provider: providerOf(coordSrc, t, url), ...(element ? { element } : {}), ...(url ? { url } : {}), read, ...(fits ? { quote: t } : {}) };
  // nothing is dropped: a pinned row, or text that does not fit the quote, keeps its whole original string
  if (original && (opts.pinned || (t.length > 300))) src.legacy = original;
  const meta: Obj = { schema_version: 1, run_id: lane ?? opts.run };
  if (review) meta.review_state = "agent_checked";
  const basis = BASIS_OF_COORD[coordSrc];
  if (basis) meta.basis = basis;
  if (imputed) meta.work_tags = ["read-date-imputed"];
  return { point_src: src, meta, imputed };
}

/** Row key order of capture-points/2 (core/src/schema/capture/points.ts capPointV2). */
const V2_ORDER = ["lat", "lon", "coord_src", "point_src", "point_role", "approx", "approx_note", "conflicts", "meta"];

/** The ledger-pinned refs: `points` of data/capture/migration-ledger.json (the relevance inputs' coordinates before the migration). */
export function pinnedPointRefs(ledger: unknown): Set<string> {
  return new Set(isObj(ledger) && isObj(ledger.points) ? Object.keys(ledger.points) : []);
}

/**
 * capture-points/1 to /2 in place on `doc`. Returns true when converted. A refusal (privacy, meta contract) leaves the document
 * untouched and reports E_NORM_REFUSED once for the file.
 */
export function normalisePoints(doc: Obj, sink: Sink, pinned: ReadonlySet<string>): boolean {
  if (doc.schema !== "capture-points/1" || !isObj(doc.points)) return false;
  const rows = doc.points as Obj;
  const out: Obj = {};
  const done: { ref: string; imputed: boolean; legacy: boolean }[] = [];
  const propertyKeys = new Set(PROPERTY_BY_KEY.keys());
  for (const [ref, row] of Object.entries(rows)) {
    if (!isObj(row)) {
      sink.find("E_NORM_REFUSED", "error", `/points/${seg(ref)}`, "a points row is not an object; the file stays on capture-points/1");
      return false;
    }
    const parsed = parsePointSource(typeof row.point_source === "string" ? row.point_source : undefined, String(row.coord_src ?? ""), { pinned: pinned.has(ref), readDefault: sink.readDefault, run: sink.run });
    const built: Obj = { ...row, point_src: parsed.point_src, meta: parsed.meta };
    delete built.point_source;
    const next: Obj = {};
    for (const k of V2_ORDER) if (k in built) next[k] = built[k];
    for (const k of Object.keys(built)) if (!(k in next)) next[k] = built[k];
    const path = `/points/${seg(ref)}`;
    const bad = metaFindings(parsed.meta, `${path}/meta`, { table: "entity", propertyKeys }).filter((f) => !f.warning);
    // refuse on a private-list key or any other hard hit (it is never carried into the new shape), and on a soft hit the conversion
    // would ADD; a planning-note hit already in the source text (a business street address) stays a warning (checks.ts)
    const { meta: _m, ...visible } = next;
    const after = privacyHits(visible, 10);
    const hits = after.some((h) => h.why !== SOFT) || after.length > privacyHits(row, 10).length ? [1] : [];
    if (bad.length > 0 || hits.length > 0) {
      sink.find("E_NORM_REFUSED", "error", path, `the converted row would fail ${bad.map((b) => b.code).concat(hits.length ? ["the privacy detector"] : []).join(", ")}; the file stays on capture-points/1`);
      return false;
    }
    out[ref] = next;
    done.push({ ref, imputed: parsed.imputed, legacy: parsed.point_src.legacy !== undefined });
  }
  doc.schema = "capture-points/2";
  doc.points = out;
  sink.change("points_schema", "/schema", "capture-points/1 to capture-points/2");
  for (const d of done) sink.change("point_src", `/points/${seg(d.ref)}`, `${d.imputed ? "read date imputed" : "read date from the text"}${d.legacy ? "; legacy string kept" : ""}`);
  return true;
}
