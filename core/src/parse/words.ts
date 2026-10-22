// Word helpers shared by the vocabulary build (Node) and the parser (browser). No imports, so Node can load this file as it is.

/** The singular of a plural English word: `lakes` -> `lake`, `activities` -> `activity`, `beaches` -> `beach`. Words that do not look plural stay. */
export function singular(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(ch|sh|x|ss|z)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/** The singular of a phrase: only its last word is inflected (`hot springs` -> `hot spring`). */
export function singularPhrase(p: string): string {
  const i = p.lastIndexOf(' ');
  return i === -1 ? singular(p) : `${p.slice(0, i + 1)}${singular(p.slice(i + 1))}`;
}

/** The longest phrase the parser looks for, in words. The vocabulary check refuses a longer one. */
export const MAX_WORDS = 5;
