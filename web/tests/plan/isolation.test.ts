import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { walkFiles } from '../helpers';

// The trip builder's fence (trip-builder.md 15.1 ISO-2, ISO-3, ISO-6, ISO-10; reviewer greps G1 to G5 of 15.4) as assertions, so the
// gate fails a breach without a reviewer. The builder lives only in its own paths; the rest of the product imports it only at the
// extension points of 15.2; its device keys all start `travel.plans.` and are named in one file; it writes no other envelope or
// table; its client code loads no bulk file and fetches nothing itself; its UI holds no literal colour and no single-trip constant.
// G6 (untouched paths in a TB branch) and G7 (budgets) are diff and build checks: the reviewer runs them (15.4).

const ROOT = path.resolve(__dirname, '../../..');
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');
const SOURCE = /\.(ts|tsx|mts|cts|js|mjs|cjs|css)$/;
const SKIP = /\/(node_modules|\.next|out|test-results|playwright-report|\.og-cache|data-snapshots|public|\.turbo)\//;

/** The builder's own paths (ISO-2), plus its API routes (ISO-1, TB-API). */
const BUILDER_WEB_CLIENT = ['web/app/plan', 'web/components/plan', 'web/lib/plan'];
const BUILDER_PATHS = [...BUILDER_WEB_CLIENT, 'web/app/api/v1/plan', 'core/src/plan', 'core/src/schema/plan-draft.ts', 'core/src/schema/api/plan.ts'];
const inside = (r: string, roots: readonly string[]) => roots.some((p) => r === p || r.startsWith(`${p}/`));

/**
 * The only other files that may import builder code: the extension points X2 (data.ts) and X6 (MineShell) of 15.2, and X3's one export
 * line in the API index. A new entry needs an extension point in the spec first.
 *
 * X-EM1 (edit-my-trip.md EM1 and the EM-C change-log line, "EM-1 and EM-2 need new extension points"; reviewer note for EM-S): the
 * account plan routes' server module parses the whole `plan-draft/1` on every write (R5) and maps device copies with the plan mapper,
 * so it imports core/src/schema/plan-draft.ts and core/src/plan/doc.ts. It is server-only, writes only `plan_draft` (the one table
 * EM2 chose), and holds no builder UI; the route files under web/app/api/account/plans/ import it and nothing of the builder.
 *
 * X-EM2 (edit-my-trip.md EM-2): the signed-in Mine sync engine, web/lib/mine/sync.ts, applies and rebases the document's operations on
 * the device (core/src/plan/ops.ts and sync.ts) and maps a device copy with core/src/plan/doc.ts. It is one lazy chunk, loaded by Mine
 * only with the `accountTrips` flag on and a person signed in; everything else in web/lib/mine/ and web/components/mine/ reaches it only
 * through that dynamic import and its types, and holds none of the document's rules.
 *
 * X-API (TB-API; trip-builder 15.1 ISO-1, ISO-5): the builder's server service, web/lib/server/planService.ts, runs the engine
 * (core/src/plan/engine.ts, candidates.ts, driveTable.ts) over the public catalogue store and the leg service; its routes are
 * web/app/api/v1/plan/** (builder paths). X2 (the DataClient section) spans data.ts and its two adapter files, contract.ts (types) and
 * api.ts (the three fetch calls; static.ts needs no import: it answers null). None of them imports builder UI.
 */
const EXTENSION_IMPORTERS = [
  'web/app/mine/MineShell.tsx',
  'web/lib/client/data.ts',
  'web/lib/client/contract.ts',
  'web/lib/client/api.ts',
  'core/src/schema/api/index.ts',
  'web/lib/server/plans.ts',
  'web/lib/server/planService.ts',
  'web/lib/mine/sync.ts',
];

/**
 * Folder extension points (Step 2, gap-analysis D12; STEP2-C1): every file under `root` may import the builder files in `targets`,
 * and no other builder file.
 *
 * X-S2 (edit-mode-spec; README gotcha 2): edit mode on the trip details page, web/lib/trip-edit/**, applies the document's operations,
 * syncs, maps copies, reads the plan model adapter and the warning levels, so it imports core/src/plan/ops.ts, sync.ts, doc.ts,
 * pageModel.ts (STEP2-M), warnings.ts and core/src/schema/plan-draft.ts. It is a lazy chunk loaded only on /t/<id>/; the public
 * /trips/<slug>/ page never loads it (EA12, held by the budget report). Nothing of the builder's UI or API is reachable from it.
 *
 * X10 (FLOW TF9, re-pointed by Step 2 ruling R2): the details page's Settings sheet, web/components/trips/edit/settings/**, mounts the
 * builder's stage components lazily, so it imports web/components/plan/stages/** and nothing else of the builder.
 */
export const EXTENSION_ROOTS: readonly { id: string; root: string; targets: readonly string[] }[] = [
  {
    id: 'X-S2',
    root: 'web/lib/trip-edit',
    targets: ['core/src/plan/ops', 'core/src/plan/sync', 'core/src/plan/doc', 'core/src/plan/pageModel', 'core/src/plan/warnings', 'core/src/schema/plan-draft'],
  },
  { id: 'X10', root: 'web/components/trips/edit/settings', targets: ['web/components/plan/stages'] },
];

/** The builder files a file imports (repo paths without the extension). */
export const builderTargets = (fromRel: string, text: string): string[] =>
  [...text.matchAll(SPECIFIER)].flatMap((m) => {
    const t = targetOf(fromRel, m[1]!);
    return t !== null && inside(t, BUILDER_TARGETS) ? [t] : [];
  });

/** True when a file may import builder code: inside the builder, a named extension file, or an extension folder for every target. */
export function allowedImporter(fromRel: string, text: string): boolean {
  if (inside(fromRel, BUILDER_PATHS) || EXTENSION_IMPORTERS.includes(fromRel)) return true;
  const point = EXTENSION_ROOTS.find((x) => inside(fromRel, [x.root]));
  const targets = builderTargets(fromRel, text);
  if (!targets.length) return true;
  return point !== undefined && targets.every((t) => inside(t, point.targets));
}

function files(roots: readonly string[]): { rel: string; text: string }[] {
  const out: { rel: string; text: string }[] = [];
  for (const r of roots) {
    const abs = path.join(ROOT, r);
    let list: string[];
    try {
      list = statSync(abs).isDirectory() ? walkFiles(abs) : [abs];
    } catch {
      continue; // a builder folder that does not exist yet
    }
    for (const f of list) if (SOURCE.test(f) && !SKIP.test(f)) out.push({ rel: rel(f), text: readFileSync(f, 'utf8') });
  }
  return out;
}

const PRODUCT = files(['web/app', 'web/components', 'web/lib', 'web/scripts', 'core/src', 'core/bin']);
const BUILDER = PRODUCT.filter((s) => inside(s.rel, BUILDER_PATHS));
const BUILDER_CLIENT = PRODUCT.filter((s) => inside(s.rel, BUILDER_WEB_CLIENT));

/** G1: every module specifier a file names (`from '...'`, `import('...')`, `require('...')`, `export ... from '...'`). */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;
/** G1: the repo path a specifier names: `@/` is web/, `@travel/core/` is core/src/, a relative one is resolved; a package is null. */
export function targetOf(fromRel: string, spec: string): string | null {
  let p: string;
  if (spec.startsWith('@/')) p = `web/${spec.slice(2)}`;
  else if (spec.startsWith('@travel/core/')) p = `core/src/${spec.slice('@travel/core/'.length)}`;
  else if (spec.startsWith('.')) p = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  else return null;
  return p.replace(/\.(?:ts|tsx|mts|js|mjs)$/, '');
}
const BUILDER_TARGETS = BUILDER_PATHS.map((p) => p.replace(/\.ts$/, ''));
/** G1: true when a file imports builder code. */
export const importsBuilder = (fromRel: string, text: string): boolean =>
  [...text.matchAll(SPECIFIER)].some((m) => {
    const t = targetOf(fromRel, m[1]!);
    return t !== null && inside(t, BUILDER_TARGETS);
  });
/** G2: a builder device key. */
export const PLAN_KEY = /travel\.plans\./;
/** ISO-3: any device key literal; inside the builder each must be a `travel.plans.` key. */
export const DEVICE_KEY = /['"`]travel\.[A-Za-z]/g;
/** G3: another feature's envelope, key or table. */
export const OTHER_ENVELOPE = /COPIES_KEY|FAV_KEY|TRIPUI_KEY|writeParty|plan_draft|trip-custom\/1/;
/** G4: a bulk or graph file, or a fetch of its own (P8, P9: data reaches components only through lib/client/data.ts). */
export const BULK_OR_FETCH = /data\/(?:capture|catalogue\/graph)|\bfetch\s*\(/;
/** G5: a literal colour (ISO-8: colour only from themes.css tokens). */
export const LITERAL_COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
/** G5, F9: a single-trip constant. */
export const TRIP_CONSTANT = /[Rr]ockies|[Dd]olomit/;

describe('the trip builder stays inside its fence (15.4 G1 to G5)', () => {
  it('scans the product and finds the builder contract files', () => {
    expect(PRODUCT.length).toBeGreaterThan(300);
    expect(BUILDER.map((s) => s.rel)).toEqual(expect.arrayContaining(['core/src/schema/plan-draft.ts', 'core/src/schema/api/plan.ts']));
  });

  it('the patterns catch what they must and spare the rest', () => {
    const imp = (from: string, line: string) => importsBuilder(from, line);
    expect(imp('web/app/mine/X.tsx', "import Tray from '@/components/plan/Tray';")).toBe(true);
    expect(imp('web/app/x.ts', "const k = await import('@/lib/plan/keys');")).toBe(true);
    expect(imp('web/lib/server/x.ts', "import { PlanService } from '@travel/core/plan/service.ts';")).toBe(true);
    expect(imp('web/lib/x.ts', "import { planDraft } from '@travel/core/schema/plan-draft.ts';")).toBe(true);
    expect(imp('core/src/schema/api/index.ts', 'export * from "./plan.ts";')).toBe(true);
    expect(imp('core/src/catalogue/x.ts', 'import { planBuild } from "../schema/api/plan.ts";')).toBe(true);
    expect(imp('core/src/ops/registry.ts', 'import { PLAN_OPS } from "./plan.ts";')).toBe(false);
    expect(imp('core/src/seed/index.ts', 'export * from "./plan.ts";')).toBe(false);
    expect(imp('web/app/x.tsx', "import Card from '@/components/places/Card';")).toBe(false);
    expect(imp('web/app/x.tsx', "import { a } from '@/lib/planning/x';")).toBe(false);
    expect(imp('web/app/x.tsx', "const href = '/plan/';")).toBe(false);
    expect(OTHER_ENVELOPE.test("import { COPIES_KEY } from '@travel/core/schema/copies.ts'")).toBe(true);
    expect(BULK_OR_FETCH.test("await fetch('/api/v1/plan/build')")).toBe(true);
    expect(BULK_OR_FETCH.test("import g from '../../data/catalogue/graph/index.json'")).toBe(true);
    // built from pieces so web/tests/no-hex.test.ts and the colour ratchet do not read this file as using a colour
    for (const c of ['color: #' + 'fff;', 'rgb' + 'a(0, 0, 0, 0.4)', 'hs' + 'l(200 50% 50%)']) expect(LITERAL_COLOUR.test(c), c).toBe(true);
    expect(LITERAL_COLOUR.test('color: var(--ink-1);')).toBe(false);
    expect(TRIP_CONSTANT.test("const base = 'Dolomites'")).toBe(true);
  });

  it('G1: only the builder and the extension points import builder code', () => {
    const hits = PRODUCT.filter((s) => !allowedImporter(s.rel, s.text)).map((s) => s.rel);
    expect(hits).toEqual([]);
  });

  it('X-S2 and X10: the edit-mode folders import only their named builder files', () => {
    const ok = (from: string, line: string) => allowedImporter(from, line);
    expect(ok('web/lib/trip-edit/store.ts', "import { applyOp } from '@travel/core/plan/ops.ts';")).toBe(true);
    expect(ok('web/lib/trip-edit/a/b.ts', "import { planDraft } from '@travel/core/schema/plan-draft.ts';")).toBe(true);
    expect(ok('web/lib/trip-edit/levels.ts', "import { warnLevel } from '@travel/core/plan/warnings.ts';")).toBe(true);
    expect(ok('web/lib/trip-edit/model.ts', "const m = await import('@travel/core/plan/pageModel.ts');")).toBe(true);
    expect(ok('web/lib/trip-edit/x.ts', "import Tray from '@/components/plan/Tray';")).toBe(false);
    expect(ok('web/lib/trip-edit/x.ts', "import { planBuild } from '@travel/core/schema/api/plan.ts';")).toBe(false);
    expect(ok('web/lib/trip-edit/x.ts', "import { k } from '@/lib/plan/keys';")).toBe(false);
    expect(ok('web/components/trips/edit/settings/Where.tsx', "import Where from '@/components/plan/stages/Where';")).toBe(true);
    expect(ok('web/components/trips/edit/settings/Where.tsx', "import { applyOp } from '@travel/core/plan/ops.ts';")).toBe(false);
    expect(ok('web/components/trips/edit/Bar.tsx', "import Where from '@/components/plan/stages/Where';")).toBe(false);
    expect(ok('web/components/trips/timeline/Entry.tsx', "import { applyOp } from '@travel/core/plan/ops.ts';")).toBe(false);
    expect(ok('web/app/trips/[slug]/page.tsx', "import { applyOp } from '@travel/core/plan/ops.ts';")).toBe(false);
    expect(ok('web/lib/trip-edit-x/a.ts', "import { applyOp } from '@travel/core/plan/ops.ts';")).toBe(false);
  });

  it('G2: builder device keys are named in web/lib/plan/keys.ts only', () => {
    const hits = PRODUCT.filter((s) => s.rel.startsWith('web/') && s.rel !== 'web/lib/plan/keys.ts' && PLAN_KEY.test(s.text)).map((s) => s.rel);
    expect(hits).toEqual([]);
  });

  it('ISO-3: every device key the builder names starts travel.plans.', () => {
    const hits = BUILDER.flatMap((s) => [...s.text.matchAll(DEVICE_KEY)].filter((m) => !s.text.startsWith('travel.plans.', m.index! + 1)).map(() => s.rel));
    expect(hits).toEqual([]);
  });

  it('G3: the builder writes no other envelope or table', () => {
    expect(BUILDER.filter((s) => OTHER_ENVELOPE.test(s.text)).map((s) => s.rel)).toEqual([]);
  });

  it('G4: builder client code loads no bulk or graph file and fetches nothing itself', () => {
    expect(BUILDER_CLIENT.filter((s) => BULK_OR_FETCH.test(s.text)).map((s) => s.rel)).toEqual([]);
  });

  it('G5: builder UI holds no literal colour; no builder file holds a single-trip constant', () => {
    expect(BUILDER_CLIENT.filter((s) => LITERAL_COLOUR.test(s.text)).map((s) => s.rel)).toEqual([]);
    expect(BUILDER.filter((s) => TRIP_CONSTANT.test(s.text)).map((s) => s.rel)).toEqual([]);
  });
});
