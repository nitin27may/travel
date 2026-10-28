import type { NextConfig } from 'next';
import { NEVER_SHIPPED_GLOBS, SERVER_RUNTIME_GLOBS, fromWebDir } from './lib/server/runtime-files';

// NEXT_DIST_DIR is set only by scripts/build-fixture.mjs (the privacy test) so a fixture
// build never overwrites the real build. Server mode (`next build` then `next start`): no `output: 'export'`; the JSON, sitemap and search routes stay
// `force-static` and prerender at build.
const config: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  // STEP2-T1F: an unset NEXT_PUBLIC_TRIP_EDIT is not inlined by Next, so the flag stayed a runtime read and the code behind it shipped.
  // Defaulting it to '0' makes `process.env.NEXT_PUBLIC_TRIP_EDIT === '1'` a build-time constant: off, the public pages hold none of it.
  env: { NEXT_PUBLIC_TRIP_EDIT: process.env.NEXT_PUBLIC_TRIP_EDIT ?? '0' },
  // The route /t/<id>/ is the file app/t/[id]/page.edit.tsx, a page only when the flag is on. Off, the route is not in the build at all
  // (404 as before T1) and its modules take no part in the client module graph: a bundler lengthens the module ids as the module count
  // grows, which cost every page's start JS 20 to 100 B, and a dynamic import behind the flag is still built.
  pageExtensions: ['tsx', 'ts', 'jsx', 'js', ...(process.env.NEXT_PUBLIC_TRIP_EDIT === '1' ? ['edit.tsx'] : [])],
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
  // A person's own trip at /t/<id>/ is private (review STEP2-ES ES-011, edit-mode-spec EA13): no index and no referrer beyond this origin,
  // as headers, not only the page's robots meta. `Cache-Control: private, no-store` comes from the page's `force-dynamic` (Next overwrites
  // a Cache-Control set here for pages); tests/trip-edit/headers.test.ts pins both. Only with the flag on: off, /t/ is not in the build.
  async headers() {
    if (process.env.NEXT_PUBLIC_TRIP_EDIT !== '1') return [];
    return [
      {
        source: '/t/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
  // /favourites/ redirects to the Favourites tab of Mine with a 308: app/favourites/page.tsx (FAV-1, briefs-bundle-A D7 and review P5)
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default config;
