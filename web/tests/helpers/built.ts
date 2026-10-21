import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The one place that knows where a build keeps what it serves (API-0: the site runs as `next build` then `next start`, no static export).
 *
 * A server build keeps prerendered pages as `<distDir>/server/app/<route>.html` (a trailing-slash route is `places/x.html`, not
 * `places/x/index.html`), their RSC payloads as `.rsc` and `.segments/**`, route-handler output as `<file>.body`, client chunks in
 * `<distDir>/static`, and `public/` is served as it was at server start (renditions in `img/`, share images in `og/`).
 *
 * `builtOutDir()` returns a directory that has the shape of the old static export (`places/x/index.html`, `_next/static/...`, `sitemap.xml`,
 * `img/...`) assembled from exactly those served files, so every test that walks "what a visitor can fetch" keeps its path logic.
 * It holds no server code: not `server/chunks`, not `cache`, not source maps. The privacy scans therefore read what is served and not the
 * scrub module the server legitimately contains. A missing build THROWS (backlog 15.1): a test that cannot find its input must fail, not skip.
 */
export const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REAL_DIST = '.next';

const VIEW = 'export-view';
const SERVED = /\.(html|rsc|body|meta)$/;

/** The dist directory of the real build, or of a fixture build such as `.fixture-out`. */
export function distDir(dist: string = REAL_DIST): string {
  const dir = path.join(WEB, dist);
  if (!existsSync(path.join(dir, 'BUILD_ID'))) throw new Error(`no server build in ${dir}: run \`pnpm --dir web build\` (or leave SKIP_WEB_BUILD unset so the test setup builds it)`);
  return dir;
}

/** `<distDir>/server/app`: prerendered HTML, RSC payloads and route-handler bodies. */
export function builtServerApp(dist: string = REAL_DIST): string {
  return path.join(distDir(dist), 'server', 'app');
}

/** `<distDir>/static`: the client chunks, which pages reference as `/_next/static/...`. */
export function builtStaticDir(dist: string = REAL_DIST): string {
  return path.join(distDir(dist), 'static');
}

function* servedFiles(dir: string, rel = ''): Generator<string> {
  for (const name of readdirSync(path.join(dir, rel))) {
    const r = rel ? `${rel}/${name}` : name;
    const full = path.join(dir, r);
    if (statSync(full).isDirectory()) {
      if (name === 'page' || name === 'route' || name === 'chunks') continue; // server code, not served files
      yield* servedFiles(dir, r);
    } else if (SERVED.test(name) || /\.segments\//.test(r)) {
      if (!/\.js(\.map)?$/.test(name) && !name.endsWith('.nft.json')) yield r;
    }
  }
}

/**
 * Where a file of `server/app` lands in the export-shaped view, or null for a file that is not served.
 * - `x.html` -> `x/index.html` (`_not-found.html` -> `404.html`); `x.rsc` -> `x/index.txt`
 * - `x.segments/a/b.segment.rsc` -> `x/__next.a.b.txt` (the shape the old export gave the same payloads, so the scans keep their regexes)
 * - `f.body` -> `f` (route-handler output: sitemap.xml, the JSON routes)
 * - `f.meta` is dropped: response headers and cache keys (`"status": 200`), no page content, and it would trip the status scans
 * - `_global-error*` is the framework's last-resort boundary, never a page a visitor is sent to.
 */
export function viewPath(rel: string): string | null {
  if (rel.startsWith('_global-error')) return null;
  const route = (r: string) => (r === '_not-found' ? '404' : r);
  const seg = /^(.*)\.segments\/(.+)\.segment\.rsc$/.exec(rel);
  if (seg) return `${route(seg[1]!)}/__next.${seg[2]!.replace(/\//g, '.')}.txt`;
  if (rel.endsWith('.html')) {
    const base = route(rel.slice(0, -'.html'.length));
    return base === 'index' ? 'index.html' : base === '404' ? '404.html' : `${base}/index.html`;
  }
  if (rel.endsWith('.rsc')) {
    const base = route(rel.slice(0, -'.rsc'.length));
    return base === 'index' ? 'index.txt' : `${base}/index.txt`;
  }
  if (rel.endsWith('.body')) return rel.slice(0, -'.body'.length);
  if (rel.endsWith('.meta')) return null;
  return rel;
}

/** Builds the view of one dist directory into `dest` (public files are copied last and win nothing: names do not collide with routes). */
export function assembleInto(dest: string, dist: string = REAL_DIST): void {
  assemble(dist, dest);
}

function assemble(dist: string, dest: string): void {
  const app = builtServerApp(dist);
  for (const rel of servedFiles(app)) {
    const mapped = viewPath(rel);
    if (!mapped) continue;
    const target = path.join(dest, mapped);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(path.join(app, rel), target);
  }
  cpSync(builtStaticDir(dist), path.join(dest, '_next', 'static'), { recursive: true });
  // The real build serves web/public as it is at `next start`; a fixture build never ran the image or share-image steps, so it gets no extras.
  if (dist === REAL_DIST) {
    const pub = path.join(WEB, 'public');
    if (existsSync(pub)) cpSync(pub, dest, { recursive: true });
  }
  writeFileSync(path.join(dest, '.built-from'), `${dist}\n`);
}

/** Drops the cached views so the next `builtOutDir()` assembles them again (the test setup calls this after the build and the image steps). */
export function resetBuiltViews(dists: string[] = [REAL_DIST, '.fixture-out', '.fixture-beacon']): void {
  for (const d of dists) rmSync(path.join(WEB, d, VIEW), { recursive: true, force: true });
}

/**
 * The export-shaped directory for a build (default: the real one). Assembled once per build, atomically (written beside it and renamed),
 * so parallel vitest workers calling it together never see a half-copied tree.
 */
export function builtOutDir(dist: string = REAL_DIST): string {
  const view = path.join(distDir(dist), VIEW);
  if (existsSync(path.join(view, '.built-from'))) return view;
  const tmp = `${view}.${process.pid}.${Date.now()}`;
  rmSync(tmp, { recursive: true, force: true });
  assemble(dist, tmp);
  try {
    renameSync(tmp, view);
  } catch {
    rmSync(tmp, { recursive: true, force: true }); // another worker won the race
    if (!existsSync(path.join(view, '.built-from'))) throw new Error(`could not assemble ${view}`);
  }
  return view;
}

/** The prerendered HTML of a route (`/places`, `/places/x`, `/`). */
export function builtHtml(route: string, dist: string = REAL_DIST): string {
  const clean = route.replace(/^\/+|\/+$/g, '');
  return path.join(builtServerApp(dist), clean ? `${clean}.html` : 'index.html');
}

/** A client file by the URL a page references (`/_next/static/chunks/a.js` or `_next/static/...`). */
export function builtStatic(url: string, dist: string = REAL_DIST): string {
  return path.join(builtStaticDir(dist), url.split('?')[0].replace(/^\/?_next\/static\//, ''));
}
