import { createHash } from "node:crypto";

/** Query parameters that only track a visit; they never change the page. */
const TRACKING = /^(utm_.*|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|_ga|_gl|yclid|ref_src|srsltid|gbraid|wbraid)$/i;

export function isWebUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw.trim());
}

/**
 * The form two sources share when they are the same page: lowercase scheme and host, no fragment, no userinfo, no default
 * port, no tracking parameters, remaining parameters sorted, no trailing slash (the bare host has none either).
 * A value that is not an http(s) URL is a path to a file in this repository: it is trimmed and loses a leading "./".
 */
export function normaliseUrl(raw: string): string {
  const t = raw.trim();
  if (!isWebUrl(t)) return t.replace(/^\.\//, "");
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return t;
  }
  const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k));
  params.sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0));
  const query = params.length ? "?" + params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&") : "";
  let path = u.pathname;
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (path === "/") path = "";
  return `${u.protocol}//${u.host}${path}${query}`;
}

/** Stable id of a source: a hash of the normalised URL, so the same page keeps its id across rebuilds. */
export function sourceId(normalised: string): string {
  return "s-" + createHash("sha1").update(normalised).digest("hex").slice(0, 10);
}
