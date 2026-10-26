import { defineConfig, type TestProjectInlineConfiguration } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

// The four projects own the web unit test files. Which file sits in which project is data: tools/gate/map.json (suites web.unit,
// web.built, web.fixture, web.timing, their `tests` globs), read here so the gate and vitest cannot disagree. Positive globs are
// `include`, "!" globs are `exclude`. tools/gate/check_map.py (M6) lists the files each project resolves to and compares.
const map = JSON.parse(readFileSync(fileURLToPath(new URL('../tools/gate/map.json', import.meta.url)), 'utf8')) as {
  suites: Record<string, { tests?: string[] }>;
};
const toWeb = (g: string) => g.replace(/^web\//, '');
const owned = (suite: string) => {
  const tests = map.suites[suite]?.tests ?? [];
  return { include: tests.filter((g) => !g.startsWith('!')).map(toWeb), exclude: tests.filter((g) => g.startsWith('!')).map((g) => toWeb(g.slice(1))) };
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
