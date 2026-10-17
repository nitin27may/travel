import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Stage .site/ (app plus every legacy route) so the specs test what publish would deploy. */
export default function setup() {
  if (process.env.PW_REUSE_SITE === '1') return;
  execFileSync('python3', [path.join(root, 'tools', 'publish.py'), '--dry-run'], { cwd: root, stdio: 'pipe', env: { ...process.env, HUB_TODAY: '2026-10-17' } });
}
