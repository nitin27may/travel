import type { NextConfig } from 'next';

// NEXT_DIST_DIR is set only by scripts/build-fixture.mjs (the privacy test) so a fixture
// build never overwrites the real export.
const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default config;
