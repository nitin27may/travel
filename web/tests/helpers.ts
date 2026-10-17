import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const WEB = path.resolve(__dirname, '..');
export const FIXTURE_ROOT = path.join(WEB, 'tests', 'fixtures', 'root');

export function walkFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

export const TEXT_FILE = /\.(html|txt|json|xml|js|css|map|svg|webmanifest)$/;

export function readText(file: string): string {
  return readFileSync(file, 'utf8');
}

/** Every key at any depth of a parsed JSON value. */
export function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      allKeys(v, out);
    }
  }
  return out;
}
