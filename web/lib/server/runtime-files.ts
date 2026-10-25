// The files a server function reads from disk at request time, from the repository root, in one place. Two readers:
// - lib/server/inputs.ts hashes the revision set (REVISION_TREES, REVISION_FILES, the legacy folder files) into the catalogue revision;
// - next.config.ts ships SERVER_RUNTIME_GLOBS in every server function (`outputFileTracingIncludes`). The bundler cannot follow these
//   reads (the root is `process.cwd()/..`, a runtime value), so without the list a deployed function would start without its dataset.
// No imports: next.config.ts loads this file before the app is compiled.

/** Directories the revision walks in full (store.ts A30, D-E4). `data/schema/generated` is skipped there, but still shipped. */
export const REVISION_TREES = ['data', 'web/data-snapshots', 'web/public/globe/data', 'web/public/globe/line', 'legacy/globe/assets/data'] as const;

/** Single files in the revision. */
export const REVISION_FILES = ['legacy/MANIFEST.json', 'web/public/search/vocab.json', 'web/.generated/image-map.json', 'web/.generated/legacy-trips.json'] as const;

/** Per trip folder: its data files and its gallery file (the page's photos). The revision lists these by walking `legacy/`. */
export const LEGACY_FOLDER_GLOBS = ['legacy/*/data/*.json', 'legacy/*/gallery/gallery.json'] as const;

/** Read at request time but not part of the revision: the globe's admin-1 shapes (lib/public/globe.ts, the public dataset builder). */
export const RUNTIME_ONLY_TREES = ['web/public/globe/admin'] as const;

/** Never shipped, even inside an included tree: local-only private inputs (`*.local.json`, git-ignored, e.g. the household origin). */
export const NEVER_SHIPPED_GLOBS = ['data/**/*.local.json'] as const;

/** Every file a server function may read, as repository-relative globs. */
export const SERVER_RUNTIME_GLOBS: readonly string[] = [
  ...[...REVISION_TREES, ...RUNTIME_ONLY_TREES].map((t) => `${t}/**/*`),
  ...REVISION_FILES,
  ...LEGACY_FOLDER_GLOBS,
];

/** A repository-relative glob as Next wants it: relative to the app directory (`web/`). */
export const fromWebDir = (repoGlob: string): string => (repoGlob.startsWith('web/') ? repoGlob.slice(4) : `../${repoGlob}`);
