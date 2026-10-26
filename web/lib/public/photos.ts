import { photoUrl } from '@/lib/server/images';
import type { Photo } from './types';

export interface CreditEntry {
  author: string | null;
  licence: string | null;
  licenceUrl: string | null;
  sourceUrl: string;
}
export type Credits = Record<string, CreditEntry>;

export const PHOTO_WIDTHS = [480, 960, 1600] as const;

const sourceUrl = (file: string, width: number): string => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=${width}`;

/** The same-origin rendition for a Commons file at about `width` px, or null when the build made none (the photo is then left out, never hot-linked). */
export function commonsUrl(file: string, width: number): string | null {
  return photoUrl(sourceUrl(file, width));
}
export function commonsPage(file: string): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`;
}

/** srcset for 480, 960 and 1600 px renditions; empty when the photo has none. */
export function photoSrcSet(photo: Pick<Photo, 'file'>): string {
  return PHOTO_WIDTHS.flatMap((w) => {
    const u = commonsUrl(photo.file, w);
    return u ? [`${u} ${w}w`] : [];
  }).join(', ');
}

export function licenceUrlFor(licence: string): string | null {
  const m = /^CC (BY(?:-SA)?|0)\s*([\d.]+)?$/i.exec(licence.trim());
  if (!m) return null;
  const kind = m[1].toUpperCase();
  if (kind === '0') return 'https://creativecommons.org/publicdomain/zero/1.0/';
  return m[2] ? `https://creativecommons.org/licenses/${kind.toLowerCase()}/${m[2]}/` : null;
}

/** "https://commons.wikimedia.org/wiki/Special:FilePath/Foo%20bar.jpg?width=900" -> "Foo bar.jpg" */
export function fileFromUrl(url: string | null | undefined): string | null {
  const m = /Special:FilePath\/([^?#]+)/.exec(url ?? '');
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).replace(/_/g, ' ');
  } catch {
    return null;
  }
}

/**
 * A credit names the author and the licence, and nothing else (2.5, 2.41). Commons authors are free text, and some are a whole sentence
 * ("This Photo was taken by Wolfgang Moroder", "The original uploader was Datch78 at English Wikipedia."): keep the name, drop the
 * description around it, the links and the markup. A string with no name left is no author.
 */
export function cleanAuthor(raw: string | null | undefined): string {
  let a = String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const lead = /^(?:this (?:photo|image|picture|media)(?: or media)? (?:was )?(?:taken|created)(?: or created)? by|(?:the )?original uploader was|(?:photo(?:graph)?|image|picture|taken|created) by|flickr user:?|author:?)\s*/i;
  a = a.replace(/\s+via wikimedia commons\.?$/i, '');
  const before = a;
  a = a.replace(lead, '');
  a = a
    .replace(/\s+at (?:english |en\.)?wikipedia\.?$/i, '')
    .replace(/,\s*PD (?:photo|image)\.?$/i, '')
    .replace(/[\s.,;:]+$/, '')
    .trim();
  return a || before.replace(/[\s.,;:]+$/, '').trim();
}

/**
 * A photo, or null when it has no author or no licence (no credit, no photo) or no rendition (no photo, no credit). The kind glyph replaces it.
 * Inline credit (gallery.json) wins over the fetched credits file.
 */
export function makePhoto(
  file: string,
  credits: Credits,
  opts: { caption?: string; author?: string | null; licence?: string | null; group?: string | null; width?: number } = {},
): Photo | null {
  const c = credits[file];
  const author = cleanAuthor(opts.author || c?.author);
  const licence = (opts.licence || c?.licence || '').trim();
  if (!author || !licence) return null;
  const width = opts.width ?? 960;
  const url = commonsUrl(file, width);
  if (!url) return null; // no rendition: no photo, and its credit goes with it
  return {
    file,
    url,
    width,
    caption: opts.caption ?? '',
    author,
    licence,
    licenceUrl: c?.licenceUrl ?? licenceUrlFor(licence),
    sourceUrl: c?.sourceUrl ?? commonsPage(file),
    group: opts.group ?? null,
  };
}
