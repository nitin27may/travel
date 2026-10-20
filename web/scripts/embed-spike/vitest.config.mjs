// Runs dump.spike.mjs inside vitest so the TypeScript public adapter (and its '@' alias) loads. Not part of the web test suite.
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../../', import.meta.url));
const config = {
  root: web,
  resolve: { alias: { '@': web } },
  test: { include: ['scripts/embed-spike/dump.spike.mjs'], testTimeout: 120000 },
};

export default config;
