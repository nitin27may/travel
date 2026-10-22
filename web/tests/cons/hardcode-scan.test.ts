import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..', '..');

describe('hard-coding ratchet (tools/cons/hardcode_scan.py)', () => {
  it('passes against tools/cons/baseline.json (no new colour, slug, host, UA, threshold or undocumented env name)', () => {
    const r = spawnSync('python3', [path.join(ROOT, 'tools', 'cons', 'hardcode_scan.py'), '--check'], { cwd: ROOT, encoding: 'utf8' });
    expect(r.stderr + r.stdout).toContain('hardcode scan OK');
    expect(r.status).toBe(0);
  });
});
