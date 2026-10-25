// A format-preserving JSON rewriter (RIS-N). The repository's data files are not all `JSON.stringify(x, null, 2)`: Python wrote
// `6.0`, some files keep short objects on one line, tracks keep `[lon, lat]` pairs inline. Re-serialising a file would change
// every such byte, so `--write` could never be a small diff and a second run could never be a no-op by inspection.
//
// `patchText(text, before, after)` takes the original text, the parsed original and the parsed result of a transform, and returns
// the new text in which every untouched value keeps its original bytes. Only an object or array whose members changed is
// recomposed (its own members re-joined with the separator the file already uses); a changed scalar is replaced in place.
// New members are rendered in the style of their container (multi-line or inline) with the file's indent unit.
//
// Safety net: the result is parsed and must equal `after` (key order aside), or the call throws. A transform bug can therefore
// never write a file that disagrees with what the transform meant.

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

interface Member { key: string; keyStart: number; valueStart: number; end: number; node: Node }
interface Node {
  kind: "object" | "array" | "scalar";
  start: number;
  end: number;
  members: Member[];
  items: Node[];
}

class Cursor {
  i = 0;
  readonly s: string;
  constructor(s: string) {
    this.s = s;
  }
  ws(): void {
    while (this.i < this.s.length && " \t\r\n".includes(this.s[this.i]!)) this.i++;
  }
}

function parseNode(c: Cursor): Node {
  c.ws();
  const start = c.i;
  const ch = c.s[c.i];
  if (ch === "{") {
    c.i++;
    const members: Member[] = [];
    c.ws();
    if (c.s[c.i] === "}") {
      c.i++;
      return { kind: "object", start, end: c.i, members, items: [] };
    }
    for (;;) {
      c.ws();
      const keyStart = c.i;
      const key = parseString(c);
      c.ws();
      if (c.s[c.i] !== ":") throw new Error(`JSON: expected ":" at ${c.i}`);
      c.i++;
      c.ws();
      const valueStart = c.i;
      const node = parseNode(c);
      members.push({ key, keyStart, valueStart, end: node.end, node });
      c.ws();
      if (c.s[c.i] === ",") {
        c.i++;
        continue;
      }
      if (c.s[c.i] === "}") {
        c.i++;
        return { kind: "object", start, end: c.i, members, items: [] };
      }
      throw new Error(`JSON: expected "," or "}" at ${c.i}`);
    }
  }
  if (ch === "[") {
    c.i++;
    const items: Node[] = [];
    c.ws();
    if (c.s[c.i] === "]") {
      c.i++;
      return { kind: "array", start, end: c.i, members: [], items };
    }
    for (;;) {
      items.push(parseNode(c));
      c.ws();
      if (c.s[c.i] === ",") {
        c.i++;
        continue;
      }
      if (c.s[c.i] === "]") {
        c.i++;
        return { kind: "array", start, end: c.i, members: [], items };
      }
      throw new Error(`JSON: expected "," or "]" at ${c.i}`);
    }
  }
  if (ch === '"') {
    parseString(c);
    return { kind: "scalar", start, end: c.i, members: [], items: [] };
  }
  while (c.i < c.s.length && !",]} \t\r\n".includes(c.s[c.i]!)) c.i++;
  if (c.i === start) throw new Error(`JSON: unexpected end at ${c.i}`);
  return { kind: "scalar", start, end: c.i, members: [], items: [] };
}

function parseString(c: Cursor): string {
  if (c.s[c.i] !== '"') throw new Error(`JSON: expected a string at ${c.i}`);
  const from = c.i;
  c.i++;
  while (c.i < c.s.length && c.s[c.i] !== '"') c.i += c.s[c.i] === "\\" ? 2 : 1;
  c.i++;
  return JSON.parse(c.s.slice(from, c.i)) as string;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((x, i) => deepEqual(x, bb[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  return ak.length === Object.keys(bo).length && ak.every((k) => k in bo && deepEqual(ao[k], bo[k]));
}

const isObj = (x: unknown): x is { [k: string]: Json } => typeof x === "object" && x !== null && !Array.isArray(x);

/** The indent unit of the file: the width of the first indented line (2 when there is none). */
function indentUnit(text: string): string {
  const m = /\n( +)\S/.exec(text);
  return m ? " ".repeat(m[1]!.length) : "  ";
}

/** Renders a new value at `indent` (the indent of the line it starts on) in a multi-line or inline container. */
function render(value: unknown, multi: boolean, indent: string, unit: string): string {
  if (!multi || typeof value !== "object" || value === null) return JSON.stringify(value);
  const body = JSON.stringify(value, null, unit.length);
  return body.split("\n").map((l, i) => (i === 0 ? l : indent + l)).join("\n");
}

interface Ctx { text: string; unit: string }

/** The new text of the span of `node`, given its old value `a` and new value `b`. */
function patchNode(ctx: Ctx, node: Node, a: unknown, b: unknown, indent: string): string {
  const { text, unit } = ctx;
  if (deepEqual(a, b)) return text.slice(node.start, node.end);
  if (node.kind === "object" && isObj(a) && isObj(b) && node.members.length > 0) return patchObject(ctx, node, a, b, indent);
  if (node.kind === "array" && Array.isArray(a) && Array.isArray(b) && node.items.length > 0) return patchArray(ctx, node, a, b, indent);
  // a replaced value (scalar, empty container, changed type) keeps the style of the span it replaces
  return render(b, text.slice(node.start, node.end).includes("\n"), indent, unit);
}

/** How a container separates members: the gap between the first two (or the style implied by its opening). */
function separator(ctx: Ctx, node: Node, gaps: string[], indent: string): { sep: string; multi: boolean; inner: string } {
  const { text, unit } = ctx;
  const first = node.kind === "object" ? node.members[0]!.keyStart : node.items[0]!.start;
  const opening = text.slice(node.start + 1, first);
  const multi = opening.includes("\n");
  const inner = multi ? opening.slice(opening.lastIndexOf("\n") + 1) : indent + unit;
  const sep = gaps.length > 0 ? gaps[0]! : multi ? `,\n${inner}` : ", ";
  return { sep, multi, inner };
}

function patchObject(ctx: Ctx, node: Node, a: { [k: string]: Json }, b: { [k: string]: Json }, indent: string): string {
  const { text, unit } = ctx;
  const ms = node.members;
  const gaps = ms.slice(0, -1).map((m, i) => text.slice(m.end, ms[i + 1]!.keyStart));
  const { sep, multi, inner } = separator(ctx, node, gaps, indent);
  const byKey = new Map(ms.map((m) => [m.key, m]));
  const newKeys = Object.keys(b);
  const sameShape = newKeys.length === ms.length && newKeys.every((k, i) => ms[i]!.key === k);
  const parts = newKeys.map((k) => {
    const m = byKey.get(k);
    if (!m) return `${JSON.stringify(k)}: ${render(b[k], multi, inner, unit)}`;
    return text.slice(m.keyStart, m.valueStart) + patchNode(ctx, m.node, a[k], b[k], inner);
  });
  const prefix = text.slice(node.start, ms[0]!.keyStart);
  const suffix = text.slice(ms[ms.length - 1]!.end, node.end);
  if (newKeys.length === 0) return "{}";
  let out = prefix;
  parts.forEach((p, i) => {
    out += p;
    if (i < parts.length - 1) out += sameShape ? gaps[i]! : sep;
  });
  return out + suffix;
}

function patchArray(ctx: Ctx, node: Node, a: Json[], b: Json[], indent: string): string {
  const { text, unit } = ctx;
  const items = node.items;
  const gaps = items.slice(0, -1).map((n, i) => text.slice(n.end, items[i + 1]!.start));
  const { sep, multi, inner } = separator(ctx, node, gaps, indent);
  const sameLength = b.length === items.length;
  const parts = b.map((v, i) => (i < items.length ? patchNode(ctx, items[i]!, a[i], v, inner) : render(v, multi, inner, unit)));
  if (b.length === 0) return "[]";
  const prefix = text.slice(node.start, items[0]!.start);
  const suffix = text.slice(items[items.length - 1]!.end, node.end);
  let out = prefix;
  parts.forEach((p, i) => {
    out += p;
    if (i < parts.length - 1) out += sameLength || i < gaps.length ? gaps[i] ?? sep : sep;
  });
  return out + suffix;
}

/**
 * The text of the file after the change from `before` (the parse of `text`) to `after`, every untouched byte kept. Throws when
 * the result does not parse to `after`.
 */
export function patchText(text: string, before: unknown, after: unknown): string {
  if (deepEqual(before, after)) return text;
  const c = new Cursor(text);
  const root = parseNode(c);
  const ctx: Ctx = { text, unit: indentUnit(text) };
  const out = text.slice(0, root.start) + patchNode(ctx, root, before, after, "") + text.slice(root.end);
  let back: unknown;
  try {
    back = JSON.parse(out);
  } catch (e) {
    throw new Error(`patchText produced invalid JSON: ${(e as Error).message}`);
  }
  if (!deepEqual(back, after)) throw new Error("patchText produced a file that differs from the intended document");
  return out;
}

/** A file already in the canonical shape, `JSON.stringify(x, null, 2) + "\n"`. */
export const isCanonical = (text: string): boolean => {
  try {
    return text === JSON.stringify(JSON.parse(text), null, 2) + "\n";
  } catch {
    return false;
  }
};
