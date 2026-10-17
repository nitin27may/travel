// The real PlaceBackend: reads the locations store directly (read-only) and delegates every write to
// tools/locations.py, which stays the only code that writes data/locations/ (plan 5.2, pitfall 3).
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadLocations } from "../mcp/data.ts";
import type { PlaceBackend } from "./types.ts";

const SCRIPT = fileURLToPath(new URL("../../../tools/locations.py", import.meta.url));

export class PythonPlaceBackend implements PlaceBackend {
  private readonly root: string;
  constructor(root: string) {
    this.root = root;
  }

  async get(id: string) {
    const p = (loadLocations(this.root).places ?? []).find((x: Record<string, any>) => x.id === id);
    return p ? { id: p.id as string, name: p.name as string, status: p.status as string, trip: (p.trip ?? null) as string | null } : null;
  }

  async edit(id: string, change: { status?: string; trip?: string | null }): Promise<void> {
    const args = [SCRIPT, "edit", id];
    if (change.status !== undefined) args.push("--status", change.status);
    if (change.trip === null) args.push("--no-trip");
    else if (change.trip !== undefined) args.push("--trip", change.trip);
    await new Promise<void>((resolve, reject) => {
      const child = spawn("python3", args, { env: { ...process.env, LOCATIONS_ROOT: this.root }, stdio: ["ignore", "pipe", "pipe"] });
      let err = "";
      child.stderr.on("data", (d) => (err += d));
      child.stdout.on("data", () => undefined);
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`locations.py edit ${id} failed (${code}): ${err.trim()}`))));
    });
  }
}
