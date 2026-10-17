// Acceptance criterion 2: the same five operations through the CLI and through the local API give byte-identical files.
import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { ACTOR, FIX, ROOT, SLUG, baseDoc } from "./util.ts";

const CORE = fileURLToPath(new URL("../..", import.meta.url));
const OPS = join(CORE, "bin/ops.ts");
const SERVE = join(CORE, "bin/serve.ts");
const ENV = { ...process.env, TRAVEL_NOW: "2026-10-17T15:00:00Z", TRAVEL_TODAY: "2026-10-17" };
const tmp: string[] = [];
const children: ChildProcess[] = [];
/** kill a spawned server by PID, once; a process that is already gone is fine */
function stop(c: ChildProcess): void {
  if (!c.pid) return;
  try {
    process.kill(c.pid);
  } catch {
    /* already exited */
  }
}
afterAll(() => {
  children.forEach(stop);
  tmp.forEach((d) => rmSync(d, { recursive: true, force: true }));
});

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "p4a-paths-"));
  tmp.push(root);
  cpSync(ROOT, root, { recursive: true });
  mkdirSync(join(root, `data/trips/${SLUG}`), { recursive: true });
  cpSync(join(FIX, "trips", SLUG, "trip.json"), join(root, `data/trips/${SLUG}/trip.json`));
  return root;
}

function files(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(dir, p)] = readFileSync(p, "utf8");
    }
  };
  walk(join(dir, "data"));
  return out;
}

const item = (over: Record<string, unknown>) => ({
  id: "d05-i01", day: 5, track: null, seq: 1, start: "09:00", window_start: null, window_end: null, tz: null, duration_min: 60, type: "sight", optional: false, pinned: false,
  title: "Mirador", place_id: null, trail_id: null, activity_id: null, eatery_id: null, custom_item_id: null, base_id: null, booking_id: null, lat: null, lon: null,
  address: null, leg_id: null, leg_mode: null, leg_km: null, leg_minutes: null, leg_basis: null, leg_notes: "", cost_amount: null, cost_currency: null, cost_per: null,
  open_from: null, open_to: null, closed_weekdays: [], needs_daylight: false, plan_b_item_id: null, override: null, notes: "", links: [], ...over,
});
const SEQUENCE: [string, Record<string, unknown>][] = [
  ["item.add", { slug: SLUG, row: item({}) }],
  ["item.add", { slug: SLUG, row: item({ id: "d05-i02", seq: 2, start: "11:00", title: "Lunch", type: "meal" }) }],
  ["item.move", { slug: SLUG, id: "d05-i01", seq: 2 }],
  ["day.update", { slug: SLUG, n: 5, patch: { title: "Rest and views" } }],
  ["trip_booking.set_status", { slug: SLUG, id: "bk-piratour", status: "held" }],
  ["question.add", { slug: SLUG, row: { id: "q-mirador", text: "Is the Mirador open?", status: "open", answer: null, asked: "2026-10-17" } }],
].map(([n, i]) => [n as string, { actor: ACTOR, ...(i as object) }]) as [string, Record<string, unknown>][];

const freePort = (): Promise<number> =>
  new Promise((ok, bad) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => ok(port));
    });
    s.on("error", bad);
  });

describe("CLI and local API give identical files", () => {
  it("runs the same sequence through both and compares every file under data/", async () => {
    const a = makeRoot();
    const b = makeRoot();
    expect(SEQUENCE.length).toBeGreaterThanOrEqual(5);

    for (const [name, input] of SEQUENCE) {
      const r = spawnSync("node", [OPS, name, "--input", "-", "--root", a, "--json"], { input: JSON.stringify(input), env: ENV, encoding: "utf8" });
      expect(r.status, `${name}: ${r.stdout}${r.stderr}`).toBe(0);
      expect(JSON.parse(r.stdout).ok).toBe(true);
    }

    const port = await freePort();
    const server = spawn("node", [SERVE, "--port", String(port), "--root", b], { env: ENV, stdio: ["ignore", "pipe", "pipe"] });
    children.push(server);
    await new Promise<void>((ok, bad) => {
      const t = setTimeout(() => bad(new Error("the server did not start")), 15000);
      server.stdout!.on("data", (d: Buffer) => {
        if (String(d).includes("listening on")) {
          clearTimeout(t);
          ok();
        }
      });
      server.on("exit", (c) => bad(new Error(`the server exited with ${c}`)));
    });
    try {
      const health = (await (await fetch(`http://127.0.0.1:${port}/api/v1/health`)).json()) as any;
      expect(health.ok).toBe(true);
      for (const [name, input] of SEQUENCE) {
        const res = await fetch(`http://127.0.0.1:${port}/api/v1/ops/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
        const body = (await res.json()) as any;
        expect(res.status, `${name}: ${JSON.stringify(body)}`).toBe(200);
      }
      const got = (await (await fetch(`http://127.0.0.1:${port}/api/v1/trips/${SLUG}?resolve=1`)).json()) as any;
      expect(got.result.trip.resolved.start).toBe("2027-02-26");
    } finally {
      stop(server);
    }

    const fa = files(a);
    const fb = files(b);
    expect(Object.keys(fb)).toEqual(Object.keys(fa));
    for (const k of Object.keys(fa)) expect(fb[k], `${k} is byte-identical`).toBe(fa[k]);
    expect(fa[`data/trips/${SLUG}/trip.json`]).toContain('"op":"question.add"');
    expect(baseDoc().changelog).toHaveLength(1);
  }, 60000);

  it("the CLI exits 1 on a failed operation and prints the code", () => {
    const root = makeRoot();
    const r = spawnSync("node", [OPS, "trip.update", "--input", "-", "--root", root], { input: JSON.stringify({ slug: SLUG, trip: { subtitle: "x" } }), env: ENV, encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("E_ACTOR");
  });

  it("--list prints the catalogue", () => {
    const r = spawnSync("node", [OPS, "--list"], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("item.add");
    expect(r.stdout.split("\n").filter(Boolean).length).toBeGreaterThan(80);
  });

  it("the server refuses a foreign Origin and a foreign Host, and answers 404 and 400 precisely", async () => {
    const root = makeRoot();
    const port = await freePort();
    const server = spawn("node", [SERVE, "--port", String(port), "--root", root], { env: ENV, stdio: ["ignore", "pipe", "pipe"] });
    children.push(server);
    await new Promise<void>((ok) => server.stdout!.on("data", (d: Buffer) => String(d).includes("listening on") && ok()));
    try {
      const base = `http://127.0.0.1:${port}`;
      const evil = await fetch(`${base}/api/v1/health`, { headers: { origin: "https://evil.example" } });
      expect(evil.status).toBe(403);
      const local = await fetch(`${base}/api/v1/health`, { headers: { origin: "http://localhost:3000" } });
      expect(local.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
      const pre = await fetch(`${base}/api/v1/ops/item.add`, { method: "OPTIONS", headers: { origin: "http://localhost:3000" } });
      expect(pre.status).toBe(204);
      expect((await fetch(`${base}/api/v1/nothing`)).status).toBe(404);
      const noActor = await fetch(`${base}/api/v1/ops/trip.update`, { method: "POST", body: JSON.stringify({ slug: SLUG, trip: {} }) });
      expect(noActor.status).toBe(400);
      expect(((await noActor.json()) as any).code).toBe("E_ACTOR");
      const badJson = await fetch(`${base}/api/v1/ops/trip.update`, { method: "POST", body: "{nope" });
      expect(badJson.status).toBe(400);
      const stale = await fetch(`${base}/api/v1/ops/trip.update`, { method: "POST", body: JSON.stringify({ actor: ACTOR, slug: SLUG, trip: { subtitle: "x" }, expected_rev: "0".repeat(64) }) });
      expect(stale.status).toBe(409);
    } finally {
      stop(server);
    }
  }, 30000);
});
