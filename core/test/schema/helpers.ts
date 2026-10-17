import type { Table } from "../../src/schema/meta.ts";

export interface ColInfo { name: string; type: string; nullable: boolean }

export function columnsOf(t: Table): ColInfo[] {
  return Object.entries(t.shape).map(([name, schema]) => {
    const m = schema.meta() as Record<string, unknown> | undefined;
    return { name, type: String(m?.["x-type"]), nullable: schema.safeParse(null).success };
  });
}
