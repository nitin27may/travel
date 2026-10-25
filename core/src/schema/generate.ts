import { ddlText } from "./ddl.ts";
import { opsJsonText } from "../ops/catalogue.ts";
import { buildSchemaJson } from "./export.ts";
import { rowMetaJsonText } from "./rowMeta.ts";

export interface Generated {
  file: string;
  text: string;
}

/** The files under data/schema/generated/, regenerated in memory. */
export function generate(): Generated[] {
  const schema = buildSchemaJson();
  return [
    { file: "schema.json", text: JSON.stringify(schema, null, 2) + "\n" },
    { file: "schema.sql", text: ddlText(schema) },
    { file: "ops.json", text: opsJsonText() },
    { file: "row-meta.json", text: rowMetaJsonText() },
  ];
}
