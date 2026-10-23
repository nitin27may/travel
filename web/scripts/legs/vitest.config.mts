// Root is web/ so the adapter's imports resolve. Only the pairs dump runs here.
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../../', import.meta.url));
export default {
  root: web,
  resolve: { alias: { '@': web } },
  test: { include: [fileURLToPath(new URL('./dump.test.ts', import.meta.url))], testTimeout: 120000 },
};
