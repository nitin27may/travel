// Turns the single-file build (dist-single/index.html) into page content for a claude.ai artifact:
// the artifact host supplies <!doctype>, <html>, <head> and <body>, so only their contents are kept.
import { readFileSync, writeFileSync } from "node:fs";
const html = readFileSync("dist-single/index.html", "utf8");
// the bundled JavaScript itself contains strings like "</head>", so cut at the real tags: the last
// "</head>" that is followed by "<body>", and the last "</body>"
const split = [...html.matchAll(/<\/head>\s*<body>/gi)].pop();
if (!split) throw new Error("no </head><body> boundary");
const head = html.slice(html.indexOf("<head>") + 6, split.index);
const body = html.slice(split.index + split[0].length, html.lastIndexOf("</body>"));
const keep = head
  .replace(/<meta charset[^>]*>/i, "")
  .replace(/<meta name="viewport"[^>]*>/i, "");
const out = `${keep.trim()}\n<style>html,body{height:100%;margin:0}</style>\n${body.trim()}\n`;
writeFileSync("dist-single/artifact.html", out);
console.log(`artifact.html ${(out.length / 1024).toFixed(0)} KB`);
