import { StaleError, checkPath, sha256 } from "./index.ts";
import type { Store } from "./index.ts";

export class MemoryStore implements Store {
  private files = new Map<string, Uint8Array>();
  readonly refRoot: string;
  constructor(refRoot: string, initial: Record<string, string | Uint8Array> = {}) {
    this.refRoot = refRoot;
    for (const [p, v] of Object.entries(initial)) this.files.set(checkPath(p), typeof v === "string" ? new TextEncoder().encode(v) : v);
  }
  async read(path: string): Promise<Uint8Array | null> {
    return this.files.get(checkPath(path)) ?? null;
  }
  async write(path: string, bytes: Uint8Array, expectedRev?: string | null): Promise<void> {
    const p = checkPath(path);
    if (expectedRev !== undefined) {
      const cur = this.files.get(p);
      const rev = cur ? sha256(cur) : null;
      if (rev !== expectedRev) throw new StaleError(p, rev);
    }
    this.files.set(p, bytes);
  }
  async remove(path: string): Promise<void> {
    this.files.delete(checkPath(path));
  }
  async rev(path: string): Promise<string | null> {
    const b = this.files.get(checkPath(path));
    return b ? sha256(b) : null;
  }
  async list(prefix: string): Promise<string[]> {
    return [...this.files.keys()].filter((p) => p.startsWith(prefix)).sort();
  }
  /** test helper: the current text of a file */
  text(path: string): string | null {
    const b = this.files.get(path);
    return b ? new TextDecoder().decode(b) : null;
  }
  /** test helper: every path and its text */
  snapshot(): Record<string, string> {
    return Object.fromEntries([...this.files].sort(([a], [b]) => a.localeCompare(b)).map(([p, b]) => [p, new TextDecoder().decode(b)]));
  }
}
