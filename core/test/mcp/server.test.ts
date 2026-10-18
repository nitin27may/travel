import { spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const MCP = join(REPO, "core/bin/mcp.ts");
const FIX = join(REPO, "core/test/fixtures");
const ROOT = join(FIX, "root");

const PHASE1_TOOLS = [
  "describe_operation", "get_coverage", "get_entity_schema", "get_place", "get_trail", "get_trip", "list_backlog",
  "list_due_bookings", "list_entity_types", "list_operations", "query_rows", "search", "search_along_route", "suggest_breaks",
  "validate_trip",
];

let client: Client;
const tmp: string[] = [];
const text = (r: any): string => r.content[0].text;
const json = (r: any): any => JSON.parse(text(r));
const call = (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args }) as Promise<any>;

beforeAll(async () => {
  client = new Client({ name: "test", version: "0" });
  await client.connect(new StdioClientTransport({ command: "node", args: [MCP, "--root", ROOT], env: { TRAVEL_TODAY: "2026-10-17" } }));
});
afterAll(async () => {
  await client.close();
  tmp.forEach((d) => rmSync(d, { recursive: true, force: true }));
});

describe("tool list", () => {
  it("registers the Phase 1 read tools and validate_trip, and nothing that writes (snapshot)", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(PHASE1_TOOLS);
  });

  it("uses each operation's summary as the description", async () => {
    const ops = JSON.parse(readFileSync(join(REPO, "data/schema/generated/ops.json"), "utf8")).operations as any[];
    const { tools } = await client.listTools();
    for (const t of tools) {
      const op = ops.find((o) => o.mcp?.tool === t.name);
      expect(t.description, t.name).toBe(op.summary);
    }
  });

  it("serves input schemas byte-equal to the ones in ops.json", async () => {
    // raw JSON-RPC over stdio so no client library can reorder keys
    const ops = JSON.parse(readFileSync(join(REPO, "data/schema/generated/ops.json"), "utf8")).operations as any[];
    const child = spawn("node", [MCP, "--root", ROOT], { stdio: ["pipe", "pipe", "inherit"] });
    const lines: string[] = [];
    let buf = "";
    child.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        lines.push(buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    });
    const send = (o: unknown) => child.stdin.write(JSON.stringify(o) + "\n");
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "raw", version: "0" } } });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    for (let n = 0; n < 100 && lines.length < 2; n++) await new Promise((r) => setTimeout(r, 50));
    child.kill();
    const list = JSON.parse(lines[1]!).result.tools as any[];
    expect(list.map((t) => t.name).sort()).toEqual(PHASE1_TOOLS);
    for (const t of list) {
      const op = ops.find((o) => o.mcp?.tool === t.name);
      expect(JSON.stringify(t.inputSchema), t.name).toBe(JSON.stringify(op.input));
    }
  });
});

describe("tools against the fixture root", () => {
  it("get_place returns the place with its chain, tags and sources", async () => {
    const r = json(await call("get_place", { id: "CA/ON/niagara/niagara-falls" }));
    expect(r.place.name).toBe("Niagara Falls");
    expect(r.area.name).toBe("Niagara");
    expect(r.country.name).toBe("Canada");
    expect(r.tags).toEqual(["waterfall"]);
    expect(r.sources).toHaveLength(1);
  });

  it("get_place on an unknown id is a readable tool error", async () => {
    const r = await call("get_place", { id: "CA/ON/niagara/nowhere" });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('no place "CA/ON/niagara/nowhere"');
  });

  it("validate_trip on a broken fixture returns its error code", async () => {
    const candidate = JSON.parse(readFileSync(join(FIX, "broken/E_FK.json"), "utf8"));
    const r = json(await call("validate_trip", { candidate }));
    expect(r.ok).toBe(false);
    expect(r.errors.map((e: any) => e.code)).toContain("E_FK");
  });

  it("validate_trip on a valid candidate returns warnings but ok", async () => {
    const candidate = JSON.parse(readFileSync(join(FIX, "warn/W_PACE.json"), "utf8"));
    const r = json(await call("validate_trip", { candidate }));
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w: any) => w.code)).toEqual(["W_PACE"]);
  });

  it("validate_trip needs exactly one of slug and candidate", async () => {
    expect((await call("validate_trip", {})).isError).toBe(true);
    expect((await call("validate_trip", { slug: "nope" })).isError).toBe(true);
  });

  it("validate_trip checks a stored trip by slug", async () => {
    const root = mkdtempSync(join(tmpdir(), "p2b-mcp-"));
    tmp.push(root);
    cpSync(join(ROOT, "data"), join(root, "data"), { recursive: true });
    cpSync(join(ROOT, "research"), join(root, "research"), { recursive: true });
    mkdirSync(join(root, "data/trips/x"), { recursive: true });
    cpSync(join(FIX, "broken/E_FK.json"), join(root, "data/trips/x/trip.json"));
    const c2 = new Client({ name: "t2", version: "0" });
    await c2.connect(new StdioClientTransport({ command: "node", args: [MCP, "--root", root] }));
    const r = JSON.parse(((await c2.callTool({ name: "validate_trip", arguments: { slug: "x" } })) as any).content[0].text);
    expect(r.errors.map((e: any) => e.code)).toContain("E_FK");
    const trip = JSON.parse(((await c2.callTool({ name: "get_trip", arguments: { slug: "x" } })) as any).content[0].text);
    expect(typeof trip.trip.id).toBe("string");
    await c2.close();
  });

  it("get_trip with resolve true returns dates, ages, book-by dates and sun (P4a)", async () => {
    const root = mkdtempSync(join(tmpdir(), "p4a-mcp-"));
    tmp.push(root);
    cpSync(join(ROOT, "data"), join(root, "data"), { recursive: true });
    cpSync(join(ROOT, "research"), join(root, "research"), { recursive: true });
    mkdirSync(join(root, "data/trips/patagonia-fixture"), { recursive: true });
    cpSync(join(FIX, "trips/patagonia-fixture/trip.json"), join(root, "data/trips/patagonia-fixture/trip.json"));
    const c2 = new Client({ name: "t3", version: "0" });
    await c2.connect(new StdioClientTransport({ command: "node", args: [MCP, "--root", root], env: { TRAVEL_TODAY: "2026-10-17" } }));
    const r = JSON.parse(((await c2.callTool({ name: "get_trip", arguments: { slug: "patagonia-fixture", resolve: true } })) as any).content[0].text);
    expect(r.trip.resolved.days[7]).toMatchObject({ n: 8, date: "2027-03-05", weekday: "Friday" });
    expect(r.trip.resolved.bookings.find((b: any) => b.id === "bk-piratour").book_by_date).toBe("2027-01-15");
    const plain = JSON.parse(((await c2.callTool({ name: "get_trip", arguments: { slug: "patagonia-fixture" } })) as any).content[0].text);
    expect(plain.trip.resolved).toBeUndefined();
    const missing = (await c2.callTool({ name: "get_trip", arguments: { slug: "nope", resolve: true } })) as any;
    expect(missing.isError).toBe(true);
    await c2.close();
  });

  it("get_trail finds a trail and reports geometry null when there is none", async () => {
    const r = json(await call("get_trail", { id: "AR/santa-cruz/el-chalten/laguna-de-los-tres", geometry: true }));
    expect(r.trail.km).toBe(21.5);
    expect(r.geometry).toBeNull();
  });

  it("query_rows filters, sorts, projects and pages", async () => {
    const r = json(await call("query_rows", { type: "catalog.trails", filter: { all: [{ field: "km", op: "between", value: [10, 25] }] }, sort: [{ field: "km", dir: "desc" }], fields: ["id", "km"], limit: 1 }));
    expect(r.rows).toEqual([{ id: "AR/santa-cruz/el-chalten/laguna-de-los-tres", km: 21.5 }]);
    expect(r.total).toBe(2);
    expect(r.next_cursor).toBe("1");
    const next = json(await call("query_rows", { type: "catalog.trails", filter: { all: [{ field: "km", op: "between", value: [10, 25] }] }, sort: [{ field: "km", dir: "desc" }], fields: ["id"], limit: 1, cursor: r.next_cursor }));
    expect(next.rows[0].id).toBe("AR/santa-cruz/el-chalten/laguna-capri-mirador-fitz-roy");
    const places = json(await call("query_rows", { type: "locations.places", filter: { any: [{ field: "kind", op: "is", value: "waterfall" }, { field: "kind", op: "is", value: "city" }] }, fields: ["name"] }));
    expect(places.rows.map((p: any) => p.name).sort()).toEqual(["Niagara Falls", "Ushuaia"]);
  });

  it("query_rows rejects an unknown type or operator", async () => {
    expect((await call("query_rows", { type: "nope.nope" })).isError).toBe(true);
    const r = await call("query_rows", { type: "catalog.trails", filter: { field: "km", op: "roughly", value: 1 } });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain("unknown operator");
  });

  it("search matches names across entities", async () => {
    const r = json(await call("search", { q: "laguna" }));
    expect(r.groups.map((g: any) => g.type)).toContain("trail");
    expect(r.groups.find((g: any) => g.type === "trail").hits).toHaveLength(2);
    expect(json(await call("search", { q: "laguna", types: ["place"] })).groups).toEqual([]);
  });

  it("describes operations and lists them", async () => {
    const ops = json(await call("list_operations")).operations;
    expect(ops.length).toBeGreaterThan(80);
    const d = json(await call("describe_operation", { name: "item.add" })).operation;
    expect(d.kind).toBe("write");
    expect(d.input.required).toContain("actor");
    expect((await call("describe_operation", { name: "nope" })).isError).toBe(true);
  });

  it("returns entity types with counts and one schema from schema.json", async () => {
    const types = json(await call("list_entity_types")).types;
    expect(types.find((t: any) => t.id === "locations.places").rows).toBe(3);
    expect(types.find((t: any) => t.id === "catalog.trails").rows).toBe(4);
    const s = json(await call("get_entity_schema", { type: "trip.items" })).schema;
    expect(s["x-table"]).toBe("items");
    expect((await call("get_entity_schema", { type: "trip.nothing" })).isError).toBe(true);
  });

  it("returns empty lists until the data exists", async () => {
    expect(json(await call("list_due_bookings", {})).bookings).toEqual([]);
    expect(json(await call("get_coverage")).coverage).toEqual([]);
    expect(json(await call("list_backlog")).backlog).toEqual([]);
  });

  it("names the phase that will implement suggest_breaks and search_along_route", async () => {
    expect(text(await call("suggest_breaks", { slug: "x", route_id: "r1" }))).toContain("P8");
    expect(text(await call("search_along_route", { slug: "x", route_id: "r1", corridor_km: 5 }))).toContain("P8");
  });

  it("is read-only: a write tool is unknown, and bad arguments are named", async () => {
    const r = await call("add_item", {});
    expect(r.isError).toBe(true);
    expect(text(r)).toContain("read-only");
    const bad = await call("get_place", {});
    expect(bad.isError).toBe(true);
    expect(text(bad)).toContain("id");
  });
});

describe("repository wiring", () => {
  it(".mcp.json registers the stdio server", () => {
    expect(JSON.parse(readFileSync(join(REPO, ".mcp.json"), "utf8"))).toEqual({ mcpServers: { travel: { command: "node", args: ["core/bin/mcp.ts"] } } });
  });

  it("defaults --root to the repository that holds the server file", async () => {
    const c = new Client({ name: "t3", version: "0" });
    await c.connect(new StdioClientTransport({ command: "node", args: [MCP], cwd: dirname(REPO) }));
    const types = JSON.parse(((await c.callTool({ name: "list_entity_types", arguments: {} })) as any).content[0].text).types;
    // the real store's count, so a new capture never breaks this test
    const places = JSON.parse(readFileSync(join(REPO, "data/locations/locations.json"), "utf8")).places.length;
    expect(types.find((t: any) => t.id === "locations.places").rows).toBe(places);
    await c.close();
  });
});
