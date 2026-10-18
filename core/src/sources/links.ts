// The link checker. Sequential, at least 500 ms between requests to the same host, HEAD first and GET when HEAD fails or
// is refused. It identifies itself and never sends an email address. The network is injected so tests replay recordings.
import type { LinkStatus } from "../schema/sources.ts";
import type { LinkRecord } from "./build.ts";

export const LINK_USER_AGENT = "travel-source-check/1.0 (+https://nks-travel.pages.dev/about/)";
export const HOST_GAP_MS = 500;

export type FetchLike = (url: string, init: { method: "HEAD" | "GET"; headers: Record<string, string>; redirect: "follow"; signal: AbortSignal }) => Promise<{ status: number; url: string; body?: { cancel(): Promise<void> } | null }>;

export interface LinkCheckOpts {
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  today: string;
  timeoutMs?: number;
  log?: (line: string) => void;
}

/** 2xx ok (or redirect when the final URL differs); 401/403/429/999 mean the site refuses a script, not that the page is gone. */
export function classify(status: number, requested: string, final: string | null): LinkStatus {
  if (status >= 200 && status < 300) return final && final !== requested && final.replace(/\/+$/, "") !== requested.replace(/\/+$/, "") ? "redirect" : "ok";
  if ([401, 403, 429, 999].includes(status)) return "blocked";
  if (status >= 500) return "error";
  return "broken"; // 404, 410, other 4xx and 3xx that did not resolve
}

export class LinkChecker {
  readonly requests: { method: string; url: string }[] = [];
  private readonly last = new Map<string, number>();
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  private readonly o: LinkCheckOpts;

  constructor(o: LinkCheckOpts) {
    this.o = o;
    this.fetchImpl = o.fetch ?? ((url, init) => fetch(url, init));
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = o.now ?? Date.now;
  }

  private async pace(host: string): Promise<void> {
    const prev = this.last.get(host);
    if (prev !== undefined) {
      const wait = prev + HOST_GAP_MS - this.now();
      if (wait > 0) await this.sleep(wait);
    }
    this.last.set(host, this.now());
  }

  private async once(method: "HEAD" | "GET", url: string): Promise<{ status: number; final: string } | { error: string }> {
    await this.pace(new URL(url).host);
    this.requests.push({ method, url });
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.o.timeoutMs ?? 20_000);
    try {
      const res = await this.fetchImpl(url, { method, headers: { "User-Agent": LINK_USER_AGENT, Accept: "text/html,*/*;q=0.8" }, redirect: "follow", signal: ctl.signal });
      await res.body?.cancel().catch(() => undefined);
      return { status: res.status, final: res.url || url };
    } catch (e) {
      const c = (e as { cause?: { code?: string } }).cause;
      return { error: c?.code ?? (e as Error).name ?? "error" };
    } finally {
      clearTimeout(timer);
    }
  }

  /** HEAD, then GET when HEAD errors or answers 4xx/5xx (many servers refuse or mishandle HEAD). */
  async check(url: string): Promise<Omit<LinkRecord, "checked"> & { checked: string }> {
    let r = await this.once("HEAD", url);
    if ("error" in r || r.status >= 400) r = await this.once("GET", url);
    if ("error" in r) return { url, status: /ENOTFOUND|ECONNREFUSED|CERT|EAI_AGAIN/i.test(r.error) ? "broken" : "error", http: null, final: null, checked: this.o.today };
    return { url, status: classify(r.status, url, r.final), http: r.status, final: r.final === url ? null : r.final, checked: this.o.today };
  }
}
