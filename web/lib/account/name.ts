// The display-name rules (docs/v2/features/account-profile-and-travellers.md 4.2), shared by the server action and the field so the two
// cannot disagree. Pure: no server-only import, safe in a client bundle.

export const NAME_MAX = 60;

/** Letters and marks of any script, digits, spaces and the simple punctuation ' - . , (no addresses, links or markup). */
const ALLOWED = /^[\p{L}\p{M}\p{N} '.,-]+$/u;

/** Most combining marks on one base character: Indic and Persian names need up to three; more is a "Zalgo" stack (review ACCT-PSEC S5). */
export const NAME_MAX_MARKS = 4;
const MARK_STACK = new RegExp(`\\p{M}{${NAME_MAX_MARKS + 1},}`, 'u');
const MARK_RUN = new RegExp(`(\\p{M}{${NAME_MAX_MARKS}})\\p{M}+`, 'gu');

/**
 * Zero-width non-joiner (U+200C) and joiner (U+200D) where a script needs them: between two letters or marks (Persian "mi\u200Ckhaham",
 * Devanagari and Malayalam conjuncts), and a joiner after a mark at the end of a word (a Malayalam chillu written with ZWJ). Anywhere
 * else they are invisible padding: `checkName` refuses them and `displayName` drops them.
 */
const LETTER_OR_MARK = /^[\p{L}\p{M}]$/u;
const MARK = /^\p{M}$/u;
function joinerFits(s: string, at: number): boolean {
  const before = [...s.slice(Math.max(0, at - 2), at)].pop() ?? '';
  const after = [...s.slice(at + 1, at + 3)][0] ?? '';
  if (!LETTER_OR_MARK.test(before)) return false;
  return LETTER_OR_MARK.test(after) || (s[at] === '\u200D' && MARK.test(before) && (after === '' || /^\s$/u.test(after)));
}
/** Every format, surrogate and private-use character, joiners included (each joiner is then judged by `joinerFits`). */
const INVISIBLE = /[\p{Cf}\p{Cs}\p{Co}]/gu;
const isJoiner = (ch: string): boolean => ch === '\u200C' || ch === '\u200D';

export type NameCheck = { ok: true; name: string } | { ok: false; reason: 'empty' | 'too_long' | 'chars' };

/** Trim, NFC-normalise and collapse runs of spaces, then 1 to 60 characters from the allow-list. */
export function checkName(raw: unknown): NameCheck {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };
  // Bound the work before normalising: nothing legitimate is anywhere near this long.
  if (raw.length > NAME_MAX * 8) return { ok: false, reason: 'too_long' };
  const name = raw.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (!name) return { ok: false, reason: 'empty' };
  if ([...name].length > NAME_MAX) return { ok: false, reason: 'too_long' };
  let stray = false;
  const bare = name.replace(INVISIBLE, (ch: string, at: number) => {
    if (!isJoiner(ch) || !joinerFits(name, at)) stray = true;
    return '';
  });
  if (stray || !ALLOWED.test(bare) || MARK_STACK.test(name)) return { ok: false, reason: 'chars' };
  return { ok: true, name };
}

/**
 * The name as it is rendered (spec 4.3; review ACCT-PSEC S5): a name can reach the session without `checkName` (Google supplies one,
 * and a person can call Neon's `update-user` with their own cookie), so every place that shows it reads it through here. NFC; control
 * characters become spaces; format, surrogate and private-use characters go, except the joiners `checkName` allows; mark stacks are cut
 * to `NAME_MAX_MARKS`; spaces collapse; the result is cut to 60 code points. Pure and small: the header's menu chunk carries it.
 */
export function displayName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // Bound the work like checkName; a lone surrogate the cut leaves is dropped with the other invisibles.
  const s = raw.slice(0, NAME_MAX * 8).normalize('NFC').replace(/\p{Cc}/gu, ' ');
  const kept = s.replace(INVISIBLE, (ch: string, at: number) => (isJoiner(ch) && joinerFits(s, at) ? ch : ''));
  const capped = kept.replace(MARK_RUN, '$1');
  return [...capped.replace(/\s+/gu, ' ').trim()].slice(0, NAME_MAX).join('').trim();
}

/**
 * The header's one-letter avatar: the first user-perceived character (a grapheme, so an astral letter or a letter with its marks is
 * never split into half a surrogate pair, review ACCT-PSEC S5), upper-cased. Falls back to code points where `Intl.Segmenter` is missing.
 */
export function initialOf(name: unknown, email?: string | null): string {
  const text = (displayName(name) || (typeof email === 'string' ? email.trim() : '') || '?').trim() || '?';
  let first: string | undefined;
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)[Symbol.iterator]().next();
    first = seg.done ? undefined : seg.value.segment;
  } catch {
    first = undefined;
  }
  return (first ?? [...text][0] ?? '?').toLocaleUpperCase();
}

/** AP-21: the strings of a refused name. */
export const NAME_COPY = {
  tooLong: `Keep it under ${NAME_MAX} characters.`,
  chars: 'Use letters, numbers, spaces and simple punctuation.',
  rate: 'Too many changes. Try again in a few minutes.',
  empty: 'Enter a name.',
} as const;

export function nameError(reason: 'empty' | 'too_long' | 'chars'): string {
  return reason === 'too_long' ? NAME_COPY.tooLong : reason === 'chars' ? NAME_COPY.chars : NAME_COPY.empty;
}
