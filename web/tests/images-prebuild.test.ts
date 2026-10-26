import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { keyOf, legacyKey, sourceUrlOf } from '../scripts/commons-cache.mjs';
import { makePhoto } from '@/lib/public/photos';
import { resetRenditionsForTest } from '@/lib/server/images';

// IMG-1b: renditions and share images are made BEFORE `next build`, from the cache, offline; pages map photos while they render; a verify
// step fails the build on a Commons URL, an empty scan or an og:image with no file. Nothing here touches the network.
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = path.join(mkdtempSync(path.join(tmpdir(), 'guard-')), 'guard.mjs');
writeFileSync(GUARD, `globalThis.fetch = async (u) => { throw new Error('GUARD: fetch attempted ' + (u?.url ?? u)); };\n`);
const tmp = (p: string) => mkdtempSync(path.join(tmpdir(), `${p}-`));

function run(script: string, args: string[], env: Record<string, string>) {
  return spawnSync(process.execPath, [path.join(WEB, 'scripts', script), ...args], {
    cwd: WEB,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: `--import ${GUARD}`, COMMONS_FETCH_GUARD: '1', ...env },
  });
}

describe('the cache key', () => {
  const pairs = [
    ['Athabasca_Glacier_from_the_valley_floor,_Jasper_National_Park,_Alberta,_Canada.jpg', 'Mount_Andromeda_from_the_Athabasca_Glacier,_Jasper_National_Park,_Alberta,_Canada.jpg'],
    ['Mer_de_Glace_from_Montenvers,_Chamonix,_Haute-Savoie.jpg', 'Panorama_of_Mer_de_Glace_from_Montenvers,_Chamonix,_Haute-Savoie.jpg'],
  ];
  it.each(pairs)('the old key collided and the new one does not: %s / %s', (a, b) => {
    expect(legacyKey(sourceUrlOf(a))).toBe(legacyKey(sourceUrlOf(b)));
    expect(keyOf(sourceUrlOf(a))).not.toBe(keyOf(sourceUrlOf(b)));
  });
  it('ignores the width in the URL', () => {
    expect(keyOf(sourceUrlOf('A b.jpg').replace('width=960', 'width=320'))).toBe(keyOf(sourceUrlOf('A_b.jpg')));
  });
});

describe('a photo with no rendition', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetRenditionsForTest();
  });
  const credits = { 'A.jpg': { author: 'Ann', licence: 'CC BY 4.0', licenceUrl: null, sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg' } };
  it('is dropped with its credit, never a Commons URL', () => {
    vi.stubEnv('IMAGES_SOURCE_URLS', '');
    const dir = tmp('map');
    mkdirSync(path.join(dir, '.generated'));
    writeFileSync(path.join(dir, '.generated', 'image-map.json'), JSON.stringify({ 'B.jpg': 'abc1234567' }));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    resetRenditionsForTest();
    expect(makePhoto('A.jpg', credits)).toBeNull();
    expect(makePhoto('B.jpg', { 'B.jpg': credits['A.jpg'] })?.url).toBe('/img/abc1234567-960.webp');
  });
  it('keeps the source URL only while the photo list is collected', () => {
    vi.stubEnv('IMAGES_SOURCE_URLS', '1');
    expect(makePhoto('A.jpg', credits)?.url).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/A\.jpg\?width=960$/);
  });
});

describe('images.mjs --prebuild', () => {
  it('with fetch stubbed to throw, completes offline from the cache and leaves out what the cache lacks', async () => {
    const cache = tmp('cache'), pub = tmp('public'), gen = tmp('gen');
    const first = run('images.mjs', ['--prebuild'], { COMMONS_CACHE: cache, IMG_PUBLIC_DIR: pub, IMG_GENERATED_DIR: gen });
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout + first.stderr).not.toMatch(/GUARD/);
    const names = JSON.parse(readFileSync(path.join(gen, 'prebuild-photos.json'), 'utf8')) as string[];
    expect(names.length).toBeGreaterThan(100);
    expect(JSON.parse(readFileSync(path.join(gen, 'image-map.json'), 'utf8'))).toEqual({});
    expect(first.stderr).toMatch(/not in the cache/);
    // one photo in the cache: it gets its three renditions and a map entry
    const sharp = (await import('sharp')).default;
    writeFileSync(path.join(cache, keyOf(sourceUrlOf(names[0]!))), await sharp({ create: { width: 40, height: 20, channels: 3, background: { r: 68, g: 102, b: 136 } } }).jpeg().toBuffer());
    const second = run('images.mjs', ['--prebuild'], { COMMONS_CACHE: cache, IMG_PUBLIC_DIR: pub, IMG_GENERATED_DIR: gen });
    expect(second.status, second.stderr).toBe(0);
    const map = JSON.parse(readFileSync(path.join(gen, 'image-map.json'), 'utf8')) as Record<string, string>;
    expect(Object.keys(map)).toEqual([names[0]]);
    for (const w of [320, 640, 960]) expect(existsSync(path.join(pub, 'img', `${map[names[0]!]}-${w}.webp`))).toBe(true);
  }, 120000);
});

describe('images.mjs --verify', () => {
  function build(files: Record<string, string>, opts: { map?: boolean; og?: string[] } = {}) {
    const dist = tmp('dist'), pub = tmp('public'), gen = tmp('gen');
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dist, rel)), { recursive: true });
      writeFileSync(path.join(dist, rel), text);
    }
    if (opts.map !== false) writeFileSync(path.join(gen, 'image-map.json'), '{}');
    for (const o of opts.og ?? []) {
      mkdirSync(path.dirname(path.join(pub, o)), { recursive: true });
      writeFileSync(path.join(pub, o), 'x');
    }
    return { NEXT_DIST_DIR: dist, IMG_PUBLIC_DIR: pub, IMG_GENERATED_DIR: gen };
  }
  const page = '<meta property="og:image" content="https://nks-travel.pages.dev/og/trips/a.jpg"/><img src="/img/abc-320.webp"/>';

  it('passes a clean build in either layout', () => {
    const r = run('images.mjs', ['--verify'], build({ 'server/app/a.html': page, 'server/route-cache/APP_PAGE/h/b.body': page }, { og: ['og/trips/a.jpg'] }));
    expect(r.status, r.stderr).toBe(0);
  });
  it('fails on a Commons URL planted in a route-cache file', () => {
    const r = run('images.mjs', ['--verify'], build({ 'server/route-cache/APP_PAGE/h/b.rsc': 'x https://commons.wikimedia.org/wiki/Special:FilePath/A.jpg?width=640 y' }));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Commons image URL/);
  });
  it('fails on an upload.wikimedia.org URL', () => {
    const r = run('images.mjs', ['--verify'], build({ 'server/app/a.html': '<img src="https://upload.wikimedia.org/x.jpg"/>' }));
    expect(r.status).toBe(1);
  });
  it('fails on an empty scan', () => {
    const r = run('images.mjs', ['--verify'], build({}));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/scanned 0/);
  });
  it('fails on an og:image with no file', () => {
    const r = run('images.mjs', ['--verify'], build({ 'server/app/a.html': page }));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/og:image/);
  });
  it('fails when the image map is missing', () => {
    const r = run('images.mjs', ['--verify'], build({ 'server/app/a.html': page }, { map: false, og: ['og/trips/a.jpg'] }));
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/image-map\.json/);
  });
});

describe('images.mjs --rekey', () => {
  it('a dry run renames nothing; a real run renames the single files, drops the collided file and lists what to fetch', () => {
    const [a, b] = ['Athabasca_Glacier_from_the_valley_floor,_Jasper_National_Park,_Alberta,_Canada.jpg', 'Mount_Andromeda_from_the_Athabasca_Glacier,_Jasper_National_Park,_Alberta,_Canada.jpg'];
    const solo = 'Solo.jpg', gone = 'Not_cached.jpg';
    const cache = tmp('cache'), gen = tmp('gen');
    writeFileSync(path.join(gen, 'prebuild-photos.json'), JSON.stringify([a, b, solo, gone]));
    writeFileSync(path.join(cache, legacyKey(sourceUrlOf(a))), 'one');
    writeFileSync(path.join(cache, legacyKey(sourceUrlOf(solo))), 'solo');
    const env = { COMMONS_CACHE: cache, IMG_GENERATED_DIR: gen };
    const dry = run('images.mjs', ['--rekey', '--dry-run'], env);
    expect(dry.status, dry.stderr).toBe(0);
    expect(existsSync(path.join(cache, legacyKey(sourceUrlOf(solo))))).toBe(true);
    expect(existsSync(path.join(cache, keyOf(sourceUrlOf(solo))))).toBe(false);
    const real = run('images.mjs', ['--rekey'], env);
    expect(real.stdout).toContain('1 file(s) renamed, 1 collided file(s) dropped, 3 photo(s) to fetch');
    expect(readFileSync(path.join(cache, keyOf(sourceUrlOf(solo))), 'utf8')).toBe('solo');
    expect(existsSync(path.join(cache, legacyKey(sourceUrlOf(a))))).toBe(false);
    for (const n of [a, b, gone]) expect(real.stdout).toContain(n);
  });
});

describe('the build line', () => {
  it('runs the same steps in web/package.json, the e2e setup and the built-test setup', () => {
    const line = (JSON.parse(readFileSync(path.join(WEB, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts.build!;
    expect(line).toBe('node scripts/images.mjs --prebuild && node scripts/og.mjs --prebuild && next build && node scripts/images.mjs --verify');
    const steps = (src: string) =>
      [...src.matchAll(/\[next, 'build'\]|scripts', '(images|og)\.mjs'\), '--(prebuild|verify)'/g)].map((m) => (m[0].startsWith('[next') ? 'next' : `${m[1]} --${m[2]}`));
    const expected = ['images --prebuild', 'og --prebuild', 'next', 'images --verify'];
    expect(steps(readFileSync(path.join(WEB, 'tests/e2e/global-setup.ts'), 'utf8'))).toEqual(expected);
    expect(steps(readFileSync(path.join(WEB, 'tests/global-setup-shared.ts'), 'utf8'))).toEqual(expected);
  });
});
