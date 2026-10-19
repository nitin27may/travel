/**
 * Photo URLs (backlog 2.38). A photo is either a Commons Special:FilePath URL (the source, and what the page holds while a
 * build has no local copy) or a same-origin rendition `/img/<key>-<w>.webp` (what `scripts/images.mjs` rewrites the export
 * to after fetching, resizing and caching it). Pages ask for three widths only, so the rewrite is one to one and the
 * server HTML and the client render agree whichever form the data carries.
 */
export const IMAGE_WIDTHS = [320, 640, 960] as const;

const COMMONS = /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//;
const LOCAL = /^\/img\/([a-z0-9]+)-\d+\.webp$/;

/** The smallest rendition that is at least `width` wide, at most 960. */
export function imageBucket(width: number): (typeof IMAGE_WIDTHS)[number] {
  return IMAGE_WIDTHS.find((w) => w >= width) ?? 960;
}

function atWidth(url: string, w: number): string | null {
  if (COMMONS.test(url)) {
    const base = url.replace(/[?&]width=\d+/, '');
    return `${base}${base.includes('?') ? '&' : '?'}width=${w}`;
  }
  const local = LOCAL.exec(url);
  return local ? `/img/${local[1]}-${w}.webp` : null;
}

/** One rendition for a box about `width` px wide. Other hosts are used as given. */
export function sizedImage(url: string, width: number): string {
  return atWidth(url, imageBucket(width)) ?? url;
}

/** `srcset` over 320, 640 and 960, or undefined for a URL that has no renditions. */
export function imageSrcSet(url: string): string | undefined {
  if (atWidth(url, 320) === null) return undefined;
  return IMAGE_WIDTHS.map((w) => `${atWidth(url, w)} ${w}w`).join(', ');
}
