// D4 evidence: `pnpm exec vitest run --config scripts/legs/vitest.stubs.config.mts` prints the straight-line stub table and rewrites the report.
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../../', import.meta.url));
export default {
  root: web,
  resolve: { alias: { '@': web } },
  test: { include: [fileURLToPath(new URL('./stubs.test.ts', import.meta.url))], testTimeout: 120000 },
};
