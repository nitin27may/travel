// A plain object, so this file needs no node_modules of its own. Root is web/ so the adapter's imports resolve.
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../../web/', import.meta.url));
export default {
  root: web,
  resolve: { alias: { '@': web } },
  test: { include: [fileURLToPath(new URL('./dump-scope.test.ts', import.meta.url))], testTimeout: 60000 },
};
