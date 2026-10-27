import { defineConfig, type TestProjectInlineConfiguration } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

// The four projects own the web unit test files. Which file sits in which project is data: tools/gate/map.json (suites web.unit,
// web.built, web.fixture, web.timing, their `tests` globs), read here so the gate and vitest cannot disagree. Positive globs are
// `include`, "!" globs are `exclude`. tools/gate/check_map.py (M6) lists the files each project resolves to and compares (without
// GATE_RUNNER, so it sees the whole project).
// On a CI runner (GATE_RUNNER=ci, WF-3) a suite's `ci_exclude` files are left out too: the checks that need the photo cache or the real
// home point. They are listed as pending on the Mac by the CI summary; the reason of each is in the map. A CLI `--exclude` would not do:
// vitest does not apply it to a project's own configuration.
const map = JSON.parse(readFileSync(fileURLToPath(new URL('../tools/gate/map.json', import.meta.url)), 'utf8')) as {
  suites: Record<string, { tests?: string[]; ci_exclude?: Record<string, string> }>;
};
const onCi = process.env.GATE_RUNNER === 'ci';
const toWeb = (g: string) => g.replace(/^web\//, '');
const owned = (suite: string) => {
  const tests = map.suites[suite]?.tests ?? [];
  const ciOut = onCi ? Object.keys(map.suites[suite]?.ci_exclude ?? {}).map(toWeb) : [];
  return { include: tests.filter((g) => !g.startsWith('!')).map(toWeb), exclude: [...tests.filter((g) => g.startsWith('!')).map((g) => toWeb(g.slice(1))), ...ciOut] };
};
const exclude = ['tests/e2e/**', 'node_modules/**'];

// the household home point comes from the environment; without it the core setup injects a decoy (core/src/config/home.ts)
const setupFiles = ['../core/test/setup/home-point.ts'];

const project = (name: string, suite: string, extra: Record<string, unknown> = {}): TestProjectInlineConfiguration => {
  const { include, exclude: out } = owned(suite);
  return { extends: true, test: { name, include, exclude: [...exclude, ...out], setupFiles, ...extra } };
};

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)), 'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)) } },
  test: {
    testTimeout: 30000,
    hookTimeout: 300000,
    // the page loaders keep Commons source URLs in unit tests (the build and the API map them to renditions: lib/server/images.ts)
    env: { IMAGES_SOURCE_URLS: '1' },
    projects: [
      // no global setup: a focused run starts at once
      project('unit', 'web.unit'),
      // read the real build (web/.next)
      project('built', 'web.built', { globalSetup: ['tests/global-setup-built.ts'] }),
      // read the fixture apps (and the real build)
      project('fixture', 'web.fixture', { globalSetup: ['tests/global-setup-fixture.ts'] }),
      // wall-clock thresholds: one worker, files one at a time, and after the other projects in a full run (groupOrder)
      project('timing', 'web.timing', { globalSetup: ['tests/global-setup-timing.ts'], fileParallelism: false, maxWorkers: 1, sequence: { groupOrder: 1 } }),
    ],
  },
});
