#!/usr/bin/env node
// The local API server (plan 4.7, 5.2): the same operations as the CLI over HTTP, for the board's "save" in Phase 1.
// Localhost only: it binds 127.0.0.1, checks the Host header, and allows CORS from http://localhost:* alone.
//   POST /api/v1/ops/<name>          JSON input, result JSON
//   GET  /api/v1/trips/<slug>?resolve=1[&edition=<id>]
//   GET  /api/v1/health
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PythonPlaceBackend } from "../src/ops/placeBackend.ts";
import { runOp } from "../src/ops/run.ts";
import type { RunResult } from "../src/ops/run.ts";
import { FileStore } from "../src/store/index.ts";

const USAGE = `Usage: node core/bin/serve.ts [--port 4319] [--root <dir>]

Serves the operations over HTTP on 127.0.0.1. --root defaults to the repository that holds this file.
`;

const argv = process.argv.slice(2);
if (argv.includes("--help")) {
  process.stdout.write(USAGE);
  process.exit(0);
}
const flag = (name: string): string | undefined => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
};
const port = Number(flag("--port") ?? 4319);
const root = flag("--root") ? resolve(flag("--root")!) : resolve(fileURLToPath(new URL("../..", import.meta.url)));
const store = new FileStore(root);
const backend = new PythonPlaceBackend(root);
const MAX_BODY = 5 * 1024 * 1024;

const STATUS: Record<string, number> = { E_STALE: 409, E_UNKNOWN_OP: 404, E_NOT_FOUND: 404, E_UNIMPLEMENTED: 501, E_SCHEMA: 400, E_ACTOR: 400, E_EXISTS: 409, E_PK_DUP: 409 };
const statusOf = (r: RunResult): number => (r.ok ? 200 : (STATUS[r.code] ?? 422));

// one operation at a time: each reads, validates and writes whole files
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
};

const LOCAL_ORIGIN = /^http:\/\/localhost(:\d+)?$/;
const LOCAL_HOST = /^(127\.0\.0\.1|localhost)(:\d+)?$/;

function send(res: ServerResponse, status: number, body: unknown, origin: string | undefined): void {
  const headers: Record<string, string> = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  if (origin && LOCAL_ORIGIN.test(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["vary"] = "Origin";
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok, bad) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        bad(new Error("request body over 5 MB"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => ok(Buffer.concat(chunks).toString("utf8")));
    req.on("error", bad);
  });
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  try {
    if (!LOCAL_HOST.test(req.headers.host ?? "")) return send(res, 403, { ok: false, code: "E_HOST", message: "this server answers on 127.0.0.1 or localhost only" }, undefined);
    if (origin && !LOCAL_ORIGIN.test(origin)) return send(res, 403, { ok: false, code: "E_ORIGIN", message: "cross-origin requests are allowed from http://localhost only" }, undefined);
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "600",
      });
      return void res.end();
    }
    if (req.method === "GET" && url.pathname === "/api/v1/health") return send(res, 200, { ok: true, root }, origin);
    const trip = req.method === "GET" ? /^\/api\/v1\/trips\/([a-z0-9-]+)$/.exec(url.pathname) : null;
    if (trip) {
      const input = { slug: trip[1], resolve: ["1", "true"].includes(url.searchParams.get("resolve") ?? ""), ...(url.searchParams.get("edition") ? { edition: url.searchParams.get("edition") } : {}) };
      const r = await serial(() => runOp(store, "trip.get", input, { backend }));
      return send(res, statusOf(r), r, origin);
    }
    const op = req.method === "POST" ? /^\/api\/v1\/ops\/([a-z_]+(?:\.[a-z_]+)+)$/.exec(url.pathname) : null;
    if (op) {
      let input: unknown;
      try {
        input = JSON.parse((await readBody(req)) || "{}");
      } catch (e) {
        return send(res, 400, { ok: false, code: "E_SCHEMA", message: `the body is not valid JSON: ${(e as Error).message}` }, origin);
      }
      const r = await serial(() => runOp(store, op[1]!, input, { backend }));
      return send(res, statusOf(r), r, origin);
    }
    return send(res, 404, { ok: false, code: "E_NOT_FOUND", message: `no route ${req.method} ${url.pathname}. Routes: POST /api/v1/ops/<name>, GET /api/v1/trips/<slug>, GET /api/v1/health.` }, origin);
  } catch (e) {
    return send(res, 500, { ok: false, code: "E_INTERNAL", message: (e as Error).message }, origin);
  }
});

server.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  process.stdout.write(`listening on http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : port} (root ${root})\n`);
});
