// Runs the slug snapshot dump inside web/ (core cannot import web/: the dataset builder lives there). A plain object, so this folder
// needs no node_modules of its own; the pattern of tools/suitability-scope. Called by `node core/bin/slugs.ts`:
//   pnpm --dir web exec vitest run -c ../core/test/catalogue/dump/vitest.config.mts
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../../../../web/', import.meta.url));
export default {
  root: web,
  resolve: { alias: { '@': web } },
  test: { include: [fileURLToPath(new URL('./slug-snapshot.dump.mjs', import.meta.url))], testTimeout: 120000 },
};
