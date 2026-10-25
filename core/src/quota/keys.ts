// Quota keys (EML-Q; email spec 5.2 and 5.6). An address or an IP never reaches the database: the key is an HMAC-SHA256 under the
// server secret AUTH_QUOTA_SECRET, mixed with the UTC day, cut to 32 hex characters. The day in the input means a key cannot be linked
// across days, and rows are purged 48 h after their window ends. The address is first folded with `addressKey` (+tag and Gmail dots), so
// one mailbox written several ways shares one bucket.
import { createHmac } from "node:crypto";
import { addressKey } from "../mail/address.ts";

/** The UTC day number (days since 1970-01-01) that holds `at`. */
export function utcDay(at: Date): number {
  return Math.floor(at.getTime() / 86_400_000);
}

function hmac(secret: string, scope: string, day: number, value: string): string {
  return createHmac("sha256", secret).update(`${scope}\u0000${day}\u0000${value}`).digest("hex").slice(0, 32);
}

/** Refuses a missing or short secret: a guessable secret would make the hashes reversible for a known address. */
export function assertSecret(secret: string | undefined): asserts secret is string {
  if (!secret || secret.length < 16) throw new Error("AUTH_QUOTA_SECRET is not set (or shorter than 16 characters)");
}

/** The key for an address, or null when it is not a plausible address. */
export function addressHash(secret: string, address: string, at: Date): string | null {
  assertSecret(secret);
  const key = addressKey(address);
  return key ? hmac(secret, "addr", utcDay(at), key) : null;
}

/** The key for a client IP (`unknown` when the platform gave none: one shared, strict bucket). */
export function ipHash(secret: string, ip: string, at: Date): string {
  assertSecret(secret);
  return hmac(secret, "ip", utcDay(at), ip.trim().toLowerCase() || "unknown");
}
