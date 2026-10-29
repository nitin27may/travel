// The one exception to the migration ledger's point pin (DG2F, owner decision delegated 28 Oct 2026; research/README.md 12).
//
// `data/capture/migration-ledger.json` pins the point every ref held in data/relevance/inputs/points.json before the capture migration,
// and core/test/capture/migration.test.ts fails when one changes (unless a payoff place took it). Some of those pins are not facts: they
// are derivations, `trailhead "X" at <ref>`, which put a trail at its destination's centre (the middle of a lake, the foot of a falls).
// A derived pin may be replaced by the record's OWN researched OpenStreetMap point, and by nothing else:
//   - the pinned value must still be the derived one on disk when the exception is taken (its `point_source` says `trailhead ... at`);
//   - the replacement must be a row of data/capture/points.json for the same ref, not approximate, coord_src osm, with an OSM element;
//   - each replacement is logged in the ledger's `replaced` list with its reason and date, like the gap budget's `raised`.
// Only points: no suitability or relevance leaf is ever excepted. `capture.ts ledger-point` is the only writer.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LEDGER_PATH, type Ledger, type PointReplacement } from "./migrate.ts";
import { CAPTURE_POINTS_PATH } from "./placementBlock.ts";
import { readJson } from "./records.ts";

export const INPUT_POINTS_PATH = "data/relevance/inputs/points.json";
/** A derived trailhead: the point of another record, standing in for the trail's start. */
export const DERIVED_TRAILHEAD = /^trailhead ".+" at \S+$/;
const OSM_ELEMENT = /^(node|way|relation)\/\d+$/;

interface InputRow { lat: number; lon: number; coord_src?: string; point_source?: string }
interface CaptureRow { lat: number; lon: number; coord_src?: string; approx?: boolean; point_src?: { provider?: string; element?: string } }

const inputRows = (root: string): Record<string, InputRow> => readJson<{ points: Record<string, InputRow> }>(join(root, INPUT_POINTS_PATH))?.points ?? {};
const captureRows = (root: string): Record<string, CaptureRow> => readJson<{ points: Record<string, CaptureRow> }>(join(root, CAPTURE_POINTS_PATH))?.points ?? {};
const same = (a: [number, number], lat: number, lon: number): boolean => a[0] === lat && a[1] === lon;
/** The inputs file keeps five decimals (about a metre), the capture row six: equal to within that rounding. */
const near = (a: [number, number], lat: number, lon: number): boolean => Math.abs(a[0] - lat) <= 6e-6 && Math.abs(a[1] - lon) <= 6e-6;

/** The record's own OSM point in data/capture/points.json, or why it does not qualify. */
function ownOsm(row: CaptureRow | undefined): { now: [number, number]; element: string } | string {
  if (!row) return "no row in data/capture/points.json";
  if (row.approx) return "the capture row is approximate";
  const el = row.point_src?.element ?? "";
  if (row.coord_src !== "osm" || row.point_src?.provider !== "OpenStreetMap" || !OSM_ELEMENT.test(el)) return "the capture row is not an OpenStreetMap element";
  return { now: [row.lat, row.lon], element: el };
}

/** The ledger entry that replaces the pinned point of `ref`, or the reason the exception does not apply. */
export function planPointReplacement(root: string, ledger: Ledger, ref: string, reason: string, today: string): PointReplacement | string {
  const was = ledger.points[ref];
  if (!was) return `${ref} is not pinned in the ledger`;
  if (ledger.replaced?.some((r) => r.ref === ref)) return `${ref} is replaced already`;
  if (reason.trim().length < 12) return "a replacement needs a written reason (--reason)";
  const input = inputRows(root)[ref];
  if (!input || !same(was, input.lat, input.lon)) return `${ref}: the inputs point is no longer the pinned one; take the exception before relevance.ts points --build`;
  const derived = input.point_source ?? "";
  if (!DERIVED_TRAILHEAD.test(derived)) return `${ref}: the pinned point is not a derived trailhead (${derived || "no point_source"}); only a derivation may be replaced`;
  const own = ownOsm(captureRows(root)[ref]);
  if (typeof own === "string") return `${ref}: ${own}`;
  return { ref, was, derived, now: own.now, element: own.element, on: today, reason: reason.trim() };
}

/** Why a logged replacement no longer holds on disk (the inputs point or the capture row moved), or null. */
export function replacementProblem(root: string, ledger: Ledger, r: PointReplacement): string | null {
  const was = ledger.points[r.ref];
  if (!was || !same(was, r.was[0], r.was[1])) return `${r.ref}: the logged pin is not the ledger's`;
  if (!DERIVED_TRAILHEAD.test(r.derived)) return `${r.ref}: the replaced pin was not a derived trailhead`;
  const own = ownOsm(captureRows(root)[r.ref]);
  if (typeof own === "string") return `${r.ref}: ${own}`;
  if (own.element !== r.element || !same(r.now, own.now[0], own.now[1])) return `${r.ref}: the capture row is not the logged ${r.element}`;
  const input = inputRows(root)[r.ref];
  if (!input || !near(r.now, input.lat, input.lon)) return `${r.ref}: the inputs point is not the logged replacement (run relevance.ts points --build)`;
  return null;
}

const NOTE =
  " Exception (DG2F, 28 Oct 2026): a pinned point that was a derived trailhead (`trailhead \"X\" at <ref>`) may be replaced by the record's own researched OpenStreetMap point in data/capture/points.json; each one is logged in `replaced` by `capture.ts ledger-point` (never by hand) and checked by core/test/capture/migration.test.ts. Points only.";

/** `capture.ts ledger-point --ref <ref> --reason "<why>" [--write]`, or `--check` (every logged replacement still holds). */
export function ledgerPointCommand(argv: string[], root: string, out: (s: string) => void, err: (s: string) => void): number {
  const file = join(root, LEDGER_PATH);
  const ledger = JSON.parse(readFileSync(file, "utf8")) as Ledger;
  if (argv.includes("--check")) {
    const bad = (ledger.replaced ?? []).map((r) => replacementProblem(root, ledger, r)).filter((x): x is string => x !== null);
    for (const b of bad) err(`PROBLEM ${b}`);
    out(`${(ledger.replaced ?? []).length} replaced point(s), ${bad.length} problem(s)`);
    return bad.length ? 1 : 0;
  }
  const at = (n: string): string | null => (argv.indexOf(n) >= 0 ? (argv[argv.indexOf(n) + 1] ?? null) : null);
  const refs = argv.flatMap((a, i) => (a === "--ref" && argv[i + 1] ? [argv[i + 1]!] : []));
  const reason = at("--reason") ?? "";
  const today = at("--today") ?? new Date().toISOString().slice(0, 10);
  if (!refs.length) {
    err('usage: capture.ts ledger-point --ref <ref> [--ref <ref> ...] --reason "<why>" [--write] | --check');
    return 2;
  }
  const add: PointReplacement[] = [];
  for (const ref of refs) {
    const r = planPointReplacement(root, { ...ledger, replaced: [...(ledger.replaced ?? []), ...add] }, ref, reason, today);
    if (typeof r === "string") {
      err(`REFUSED ${r}`);
      return 1;
    }
    add.push(r);
    out(`${ref}: ${r.derived} [${r.was.join(", ")}] -> OSM ${r.element} [${r.now.join(", ")}]`);
  }
  if (!argv.includes("--write")) {
    out(`dry run: ${add.length} replacement(s); add --write`);
    return 0;
  }
  const next: Ledger = { ...ledger, note: ledger.note.includes("Exception (DG2F") ? ledger.note : ledger.note + NOTE, replaced: [...(ledger.replaced ?? []), ...add] };
  writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  out(`wrote ${LEDGER_PATH}: ${add.length} replacement(s) logged`);
  return 0;
}
