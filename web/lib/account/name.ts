// The display-name rules (docs/v2/features/account-profile-and-travellers.md 4.2), shared by the server action and the field so the two
// cannot disagree. Pure: no server-only import, safe in a client bundle.

export const NAME_MAX = 60;

/** Letters and marks of any script, digits, spaces and the simple punctuation ' - . , (no addresses, links or markup). */
const ALLOWED = /^[\p{L}\p{M}\p{N} '.,-]+$/u;

export type NameCheck = { ok: true; name: string } | { ok: false; reason: 'empty' | 'too_long' | 'chars' };

/** Trim, NFC-normalise and collapse runs of spaces, then 1 to 60 characters from the allow-list. */
export function checkName(raw: unknown): NameCheck {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };
  // Bound the work before normalising: nothing legitimate is anywhere near this long.
  if (raw.length > NAME_MAX * 8) return { ok: false, reason: 'too_long' };
  const name = raw.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (!name) return { ok: false, reason: 'empty' };
  if ([...name].length > NAME_MAX) return { ok: false, reason: 'too_long' };
  if (!ALLOWED.test(name)) return { ok: false, reason: 'chars' };
  return { ok: true, name };
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
