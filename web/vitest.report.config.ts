import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/** For `pnpm tag-conflicts`: the same aliases as vitest.config.ts, without the global build setup the report does not need. */
export default defineConfig({ resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } }, test: { include: ['tests/data/tag-conflicts.test.ts'], testTimeout: 60000 } });
