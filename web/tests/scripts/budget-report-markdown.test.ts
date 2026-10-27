// `budget:report --markdown` (WF-3): the job summary of check.yml. The text is for a human reading a GitHub run, so it must be a fenced
// block, and it must say when the place-size lines cannot be compared (a CI build has no photo cache; Q-W5).
import { describe, expect, it } from 'vitest';
import { markdown } from '../../scripts/budget-report.mjs';

const LINES = ['budget report: .next (public build, 40 pages)', '  heaviest page 120.0 KB (index); headroom 1024 B'];

describe('budget report as markdown', () => {
  it('wraps the lines in one fenced block under a heading', () => {
    const md = markdown(LINES, { photoCache: true });
    expect(md.split('\n').slice(0, 3)).toEqual(['### Budget report (.next)', '', '```text']);
    expect(md).toContain(LINES[1]);
    expect(md.match(/```/g)).toHaveLength(2);
    expect(md).not.toMatch(/photo cache/);
  });

  it('says so when there is no photo cache, so a place-size figure is not read as the Mac baseline', () => {
    const md = markdown(LINES, { photoCache: false });
    expect(md).toMatch(/No photo cache/);
    expect(md).toMatch(/place-size budget is a Mac check/);
  });
});
