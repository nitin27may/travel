import type { NextConfig } from 'next';

// NEXT_DIST_DIR is set only by scripts/build-fixture.mjs (the privacy test) so a fixture
// build never overwrites the real build. Server mode (`next build` then `next start`): no `output: 'export'`; the JSON, sitemap and search routes stay
// `force-static` and prerender at build.
const config: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  // @travel/core is TypeScript source (the schemas the loaders validate against)
  transpilePackages: ['@travel/core'],
  // The server trace of a route follows every path its code builds at runtime (`path.join(root, ...)`), which pulled in the static export
  // (`out/`, absent from a server build) and the test tree. Neither is read by a route (audit GB-A-14).
  outputFileTracingExcludes: { '*': ['out/**', 'tests/**'] },
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default config;
