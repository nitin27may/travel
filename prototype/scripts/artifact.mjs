// Turns the single-file build (dist-single/index.html) into page content for a claude.ai artifact:
// the artifact host supplies <!doctype>, <html>, <head> and <body>, so only their contents are kept.
import { readFileSync, writeFileSync } from "node:fs";
const html = readFileSync("dist-single/index.html", "utf8");
const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? "";
const body = html.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? "";
const keep = head
  .replace(/<meta charset[^>]*>/i, "")
  .replace(/<meta name="viewport"[^>]*>/i, "");
const out = `${keep.trim()}\n<style>html,body{height:100%;margin:0}</style>\n${body.trim()}\n`;
writeFileSync("dist-single/artifact.html", out);
console.log(`artifact.html ${(out.length / 1024).toFixed(0)} KB`);
