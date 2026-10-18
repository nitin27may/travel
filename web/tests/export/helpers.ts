// Small strict parsers for the generated files, so the tests check structure and not just substrings.

export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

/** Well-formedness: matching tags, quoted attributes, no raw `&` or `<` in text. Throws on the first error. */
export function parseXml(src: string): XmlNode {
  const root: XmlNode = { name: '#root', attrs: {}, children: [], text: '' };
  const stack: XmlNode[] = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(src))) {
    if (m.index !== last) throw new Error(`Unparseable XML at ${last}: ${src.slice(last, last + 40)}`);
    last = re.lastIndex;
    const top = stack[stack.length - 1];
    if (m[1]) {
      if (top.name !== m[1]) throw new Error(`Closing </${m[1]}> but <${top.name}> is open`);
      stack.pop();
    } else if (m[2]) {
      const attrs: Record<string, string> = {};
      for (const a of m[3].matchAll(/([\w:.-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
      const node: XmlNode = { name: m[2], attrs, children: [], text: '' };
      top.children.push(node);
      if (!m[4]) stack.push(node);
    } else if (m[5] !== undefined) {
      if (/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(m[5])) throw new Error(`Bare & in text: ${m[5].slice(0, 40)}`);
      top.text += m[5];
    }
  }
  if (last !== src.length) throw new Error(`Trailing XML at ${last}`);
  if (stack.length !== 1) throw new Error(`Unclosed <${stack[stack.length - 1].name}>`);
  return root.children[0];
}

export const kids = (n: XmlNode, name: string): XmlNode[] => n.children.filter((c) => c.name === name);

export interface IcsEvent {
  props: { name: string; params: Record<string, string>; value: string }[];
  get(name: string): string | undefined;
  param(name: string, p: string): string | undefined;
}

/** RFC 5545 reader: unfolds, checks CRLF, line length, BEGIN/END nesting; returns the VEVENTs. */
export function parseIcs(src: string): { events: IcsEvent[]; calendar: Map<string, string> } {
  if (!src.endsWith('\r\n')) throw new Error('ICS must end with CRLF');
  if (/[^\r]\n/.test(src)) throw new Error('ICS has a bare LF');
  const raw = src.split('\r\n').slice(0, -1);
  for (const l of raw) if (new TextEncoder().encode(l).length > 75) throw new Error(`Line over 75 octets: ${l.slice(0, 30)}`);
  const lines: string[] = [];
  for (const l of raw) {
    if (l.startsWith(' ')) lines[lines.length - 1] += l.slice(1);
    else lines.push(l);
  }
  const events: IcsEvent[] = [];
  const calendar = new Map<string, string>();
  const stack: string[] = [];
  let cur: IcsEvent | null = null;
  for (const l of lines) {
    const idx = l.indexOf(':');
    if (idx < 0) throw new Error(`Not a content line: ${l}`);
    const [name, ...ps] = l.slice(0, idx).split(';');
    const value = l.slice(idx + 1);
    const params: Record<string, string> = {};
    for (const p of ps) {
      const [k, v] = p.split('=');
      params[k.toUpperCase()] = v;
    }
    const key = name.toUpperCase();
    if (key === 'BEGIN') {
      stack.push(value);
      if (value === 'VEVENT') {
        cur = { props: [], get: (n) => cur?.props.find((p) => p.name === n)?.value, param: (n, p) => cur?.props.find((x) => x.name === n)?.params[p] };
        const ev = cur;
        ev.get = (n) => ev.props.find((p) => p.name === n)?.value;
        ev.param = (n, p) => ev.props.find((x) => x.name === n)?.params[p];
        events.push(ev);
      }
    } else if (key === 'END') {
      if (stack.pop() !== value) throw new Error(`END:${value} does not match`);
      if (value === 'VEVENT') cur = null;
    } else if (cur) cur.props.push({ name: key, params, value });
    else if (stack.length === 1) calendar.set(key, value);
  }
  if (stack.length) throw new Error('Unclosed component');
  return { events, calendar };
}
