// Quota keys (EML-Q; email spec 5.2 and 5.6). An address or an IP never reaches the database: the key is an HMAC-SHA256 under the
// server secret AUTH_QUOTA_SECRET, mixed with the UTC day, cut to 32 hex characters. The day in the input means a key cannot be linked
// across days, and rows are purged 48 h after their window ends. The address is first folded with `addressKey` (+tag and Gmail dots), so
// one mailbox written several ways shares one bucket.
//
// IPs are keyed per network, not per host address (review GSI-S S3): an IPv6 address counts as its /64, which one host or one home
// connection gets whole (2^64 addresses), so rotating addresses inside it cannot dodge a per-IP or address-and-IP bucket. An
// IPv4-mapped IPv6 address (`::ffff:a.b.c.d`) counts as the IPv4 address it carries. IPv4 stays per address.
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { addressKey } from "../mail/address.ts";

/** The leading 16-bit groups of an IPv6 address that name its network: four groups, the /64 a host or subscriber line gets whole. */
const IPV6_NETWORK_GROUPS = 4;

/** The eight 16-bit groups of an IPv6 address (`::` expanded, an IPv4 tail folded in), or null when it is not one. */
function ipv6Groups(ip: string): number[] | null {
  let s = ip;
  const tail = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (tail) {
    const b = tail.slice(2, 6).map(Number);
    if (b.some((n) => n > 255)) return null;
    s = `${tail[1]}${((b[0] << 8) | b[1]).toString(16)}:${((b[2] << 8) | b[3]).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const parse = (h: string) => (h === "" ? [] : h.split(":").map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : Number.NaN)));
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  if ([...head, ...rest].some(Number.isNaN)) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const fill = 8 - head.length - rest.length;
  return fill < 1 ? null : [...head, ...new Array<number>(fill).fill(0), ...rest];
}

/**
 * The network a client IP is keyed on (S3): an IPv4 address as is, an IPv6 address as its /64 (`2001:db8:0:1::/64`), an IPv4-mapped
 * one as its IPv4 address, and `unknown` for anything else (one shared, strict bucket). Every IP key below goes through this.
 */
export function ipNetwork(ip: string): string {
  const raw = ip.trim().toLowerCase().replace(/%.*$/, "");
  const family = isIP(raw);
  if (family === 4) return raw;
  if (family !== 6) return "unknown";
  const g = ipv6Groups(raw);
  if (!g) return "unknown";
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join(".");
  return `${g.slice(0, IPV6_NETWORK_GROUPS).map((x) => x.toString(16)).join(":")}::/64`;
}

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

/**
 * The key for an address and a client IP together (review EML-S SF3: the tight per-address limit on checks applies per network, so a
 * guesser elsewhere cannot keep the owner of the address locked out). The IP counts as its network (`ipNetwork`, S3). Null when the
 * address is not plausible.
 */
export function addressIpHash(secret: string, address: string, ip: string, at: Date): string | null {
  assertSecret(secret);
  const key = addressKey(address);
  return key ? hmac(secret, "addr_ip", utcDay(at), `${key}\u0000${ipNetwork(ip)}`) : null;
}

/** The key for a client IP's network (`ipNetwork`; `unknown` when the platform gave none: one shared, strict bucket). */
export function ipHash(secret: string, ip: string, at: Date): string {
  assertSecret(secret);
  return hmac(secret, "ip", utcDay(at), ipNetwork(ip));
}

/**
 * The key for a signed-in user (the per-user write buckets, `plans:write`; edit-my-trip 4.1). The id is the verified session's id,
 * never a request body; like an address it never reaches the database raw, and the day in the input unlinks it across days.
 */
export function userHash(secret: string, userId: string, at: Date): string {
  assertSecret(secret);
  if (typeof userId !== "string" || userId.length === 0) throw new Error("userHash needs a user id");
  return hmac(secret, "user", utcDay(at), userId);
}
