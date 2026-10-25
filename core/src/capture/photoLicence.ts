// The photo licence allowlist (research/method/lanes/media.md section 6; DATA.md D5b; owner decision DD-3, 25 Oct 2026: keep it strict).
// A stored photo carries one of: CC BY, CC BY-SA (any version, an optional jurisdiction port such as "2.5 ca"), CC0, or public domain
// (a US government work, the Public Domain Mark, a PD-* template). Everything else is refused: NC and ND files (we resize and crop, and
// NC would tie every photo to a site that never earns), all rights reserved, and the Unsplash and Pexels licences (not Creative Commons;
// they forbid building a similar collection). Widening it is an owner decision first, then this one list.

const VERSION = String.raw`(?: \d\.\d)?(?: [A-Za-z]{2,3})?`;
export const PHOTO_LICENCE_RE = new RegExp(
  String.raw`^(?:CC BY${VERSION}|CC BY-SA${VERSION}|CC0(?: 1\.0)?|Public domain(?: [^,;]*)?|PDM(?: 1\.0)?|PD-[A-Za-z0-9-]+)$`,
  "i",
);

/** Licences the allowlist names, for messages and docs. */
export const PHOTO_LICENCE_ALLOWED = ["CC BY", "CC BY-SA", "CC0", "public domain"] as const;

export const photoLicenceOk = (licence: string): boolean => PHOTO_LICENCE_RE.test(licence.trim());
