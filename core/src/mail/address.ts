// The address normaliser (EML-M; email spec 5.2, feedback spec 5.2 and 12). Two forms, kept apart on purpose:
//
//   canonicalAddress  trim and lower-case only. What the auth proxy forwards to Neon (Neon refuses an address with surrounding spaces,
//                     EML-0 S4, and lower-cases on its side) and what the recipient guard compares. The person's mailbox is unchanged.
//   addressKey        canonical, then `+tag` stripped for every domain, dots stripped from the local part for gmail.com and
//                     googlemail.com, and googlemail.com mapped to gmail.com. Used ONLY as the input of a hash (quota keys, intake
//                     suppression), so one mailbox written several ways shares one bucket. Never sent anywhere, never stored.
//
// Both return null for anything that is not plausibly one address, so a caller can refuse it before any network call.

/** RFC 5321's limit on a forward path: an address longer than this cannot be delivered. */
export const ADDRESS_MAX = 254;

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/** Trimmed and lower-cased, or null when the value is not a single plausible address. */
export function canonicalAddress(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (value.length < 3 || value.length > ADDRESS_MAX) return null;
  // One @, something on both sides, no whitespace, no control characters, no list separators: a header-injection or a list of
  // addresses never reaches a provider.
  if (/[\s\u0000-\u001f\u007f,;<>"]/.test(value)) return null;
  const at = value.lastIndexOf("@");
  if (at <= 0 || at !== value.indexOf("@") || at === value.length - 1) return null;
  const domain = value.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return null;
  return value;
}

/** The mailbox identity used as hash input: `+tag` and Gmail dots removed. Null when the value is not a plausible address. */
export function addressKey(raw: unknown): string | null {
  const canonical = canonicalAddress(raw);
  if (!canonical) return null;
  const at = canonical.lastIndexOf("@");
  let local = canonical.slice(0, at);
  let domain = canonical.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  if (!local) return null;
  return `${local}@${domain}`;
}

/** True when two values name the same canonical address (the recipient guard's comparison). */
export function sameAddress(a: unknown, b: unknown): boolean {
  const x = canonicalAddress(a);
  return x !== null && x === canonicalAddress(b);
}
