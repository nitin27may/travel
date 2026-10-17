import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { StaleError, StoreError, checkPath, checkRefPath, sha256 } from "./index.ts";
import type { Store } from "./index.ts";

export class FileStore implements Store {
  readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
  }
  get refRoot(): string {
    return this.root;
  }
  private abs(path: string): string {
    const rel = checkPath(path);
    const full = resolve(this.root, rel);
    if (full !== this.root && !full.startsWith(this.root + sep)) throw new StoreError(`"${path}" resolves outside the root`);
    return full;
  }
  async read(path: string): Promise<Uint8Array | null> {
    const f = this.abs(path);
    if (!existsSync(f) || !statSync(f).isFile()) return null;
    return new Uint8Array(readFileSync(f));
  }
  async write(path: string, bytes: Uint8Array, expectedRev?: string | null): Promise<void> {
    const f = this.abs(path);
    if (expectedRev !== undefined) {
      const cur = await this.rev(path);
      if (cur !== expectedRev) throw new StaleError(path, cur);
    }
    mkdirSync(dirname(f), { recursive: true });
    // temp file in the same folder, then rename: a reader sees the old or the new file, never half of one
    const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmp, bytes);
    renameSync(tmp, f);
  }
  async remove(path: string): Promise<void> {
    rmSync(this.abs(path), { force: true });
  }
  async rev(path: string): Promise<string | null> {
    const b = await this.read(path);
    return b ? sha256(b) : null;
  }
  async readRef(path: string): Promise<Uint8Array | null> {
    const f = resolve(this.root, checkRefPath(path));
    return existsSync(f) && statSync(f).isFile() ? new Uint8Array(readFileSync(f)) : null;
  }
  async list(prefix: string): Promise<string[]> {
    const out: string[] = [];
    const walk = (dir: string, rel: string): void => {
      if (!existsSync(dir)) return;
      for (const name of readdirSync(dir).sort()) {
        const p = `${rel}/${name}`;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, p);
        else if (!name.endsWith(".tmp") && p.startsWith(prefix)) out.push(p);
      }
    };
    const top = prefix.split("/")[0] ?? "";
    if (top !== "data") throw new StoreError(`the store only lists paths under data/, got "${prefix}"`);
    walk(join(this.root, "data"), "data");
    return out;
  }
}
