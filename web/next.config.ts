import type { NextConfig } from 'next';
import { NEVER_SHIPPED_GLOBS, SERVER_RUNTIME_GLOBS, fromWebDir } from './lib/server/runtime-files';

// NEXT_DIST_DIR is set only by scripts/build-fixture.mjs (the privacy test) so a fixture
// build never overwrites the real build. Server mode (`next build` then `next start`): no `output: 'export'`; the JSON, sitemap and search routes stay
// `force-static` and prerender at build.
const config: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  // @travel/core is TypeScript source (the schemas the loaders validate against)
  transpilePackages: ['@travel/core'],
  // Server traces. The dataset is read from the repository root (`process.cwd()/..`, a runtime value), so the bundler cannot follow it:
  // every server function ships the runtime file list explicitly (lib/server/runtime-files.ts, the same list the catalogue revision
  // hashes), and the reads it could not bound carry `turbopackIgnore`, which keeps the whole project (web/out, web/public, test shots:
  // about 700 MB) out of the instrumentation trace that every function carries. Vercel's limit is 250 MB per function.
  outputFileTracingIncludes: { '*': SERVER_RUNTIME_GLOBS.map(fromWebDir) },
  // Never read by a server function: the static export, tests and their screenshots, the photo and share-image outputs (served as static
  // files), the Commons cache, fixture builds, and local-only private inputs (audit GB-A-14).
  outputFileTracingExcludes: {
    '*': ['out/**', 'tests/**', 'test-results/**', 'playwright-report/**', 'public/img/**', 'public/og/**', '.og-cache/**', '.fixture-*/**', ...NEVER_SHIPPED_GLOBS.map(fromWebDir)],
  },
  // /favourites/ redirects to the Favourites tab of Mine with a 308: app/favourites/page.tsx (FAV-1, briefs-bundle-A D7 and review P5)
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default config;
