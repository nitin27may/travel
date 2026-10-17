#!/usr/bin/env node
// Read-only stdio MCP server (plan 5.2, 5.7). Registers every catalogue operation whose mcp.phase is 1 and whose kind is
// read; descriptions are the operation summaries and input schemas are the exported JSON Schema of the catalogue, so the
// tool list can never drift from data/schema/generated/ops.json. Writes arrive in Phase 2 on the Worker.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { OPS_BY_NAME, mcpTools, opSchemaToJson } from "../src/ops/catalogue.ts";
import { HANDLERS, ToolError } from "../src/mcp/handlers.ts";

const USAGE = `Usage: node core/bin/mcp.ts [--root <dir>]

Read-only stdio MCP server for the travel data. --root defaults to the repository that holds this file.
`;

const argv = process.argv.slice(2);
if (argv.includes("--help")) {
  process.stdout.write(USAGE);
  process.exit(0);
}
const rootAt = argv.indexOf("--root");
const root = rootAt >= 0 ? resolve(argv[rootAt + 1] ?? ".") : resolve(fileURLToPath(new URL("../..", import.meta.url)));

/** Phase 1 read tools, in catalogue (name) order */
const TOOLS = mcpTools().filter((t) => t.phase === 1 && t.op.kind === "read");

const server = new Server({ name: "travel", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({
    name: t.tool,
    description: t.op.summary,
    inputSchema: opSchemaToJson(t.op.input, "input") as { type: "object"; [k: string]: unknown },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.tool === req.params.name);
  if (!tool) return fail(`unknown tool "${req.params.name}". This server is read-only; the tools are: ${TOOLS.map((t) => t.tool).join(", ")}.`);
  const handler = HANDLERS[tool.op.name];
  if (!handler) return fail(`tool "${tool.tool}" has no handler yet.`);
  const parsed = OPS_BY_NAME.get(tool.op.name)!.input.safeParse(req.params.arguments ?? {});
  if (!parsed.success) {
    return fail(parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
  }
  try {
    const result = handler(parsed.data, { root });
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }], structuredContent: result as Record<string, unknown> };
  } catch (e) {
    if (e instanceof ToolError) return fail(e.message);
    return fail(`internal error in ${tool.tool}: ${(e as Error).message}`);
  }
});

function fail(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

await server.connect(new StdioServerTransport());
