import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { walkFiles } from '../helpers';
import { builtOutDir } from '../helpers/built';
import { BEACON_ALLOWANCE_BYTES, CHROME_CAP_BYTES, CHROME_HEADROOM_BYTES, CHROME_TODAY_BYTES, chargedChrome, chromeOf } from '../../scripts/budget-report.mjs';
import type { Chrome } from '../../scripts/budget-report.mjs';

// Shell chrome cap (BUD-1, Q260): the header, the footer, the phone bottom bar and the beacon tag, as markup and as their share of the
// inline RSC payload, stay within today's bytes plus 1 KB on every page of the build. S13 (place-size.test.ts) no longer counts them,
// so this is the one gate on shell growth: one shell change per stack, each quoting `pnpm --dir web budget:report` before and after.

/** A minimal page as Next serves it: the shell markup, and the payload as one html-escaped push. */
function page({ footerText = 'About the data', beacon = false, main = 'Body', sharedInMain = false } = {}): string {
  const rows = [
    '1:I[1,["/_next/a.js"],"SiteHeader"]',
    '2:I[2,["/_next/a.js"],"BottomBar"]',
    '3:I[3,["/_next/a.js"],"UnitSwitch"]',
    '4:I[4,["/_next/a.js"],"PlaceShell"]',
    `0:["$","body",null,{"children":[["$","$L1",null,{}],["$","main",null,{"children":[["$","$L4",null,{"title":${JSON.stringify(main)}}]${sharedInMain ? ',["$","$L3",null,{}]' : ''}]}],` +
      `["$","footer",null,{"className":"site-footer","children":[${JSON.stringify(footerText)},["$","$L3",null,{}]]}],["$","$L2",null,{"account":"$undefined"}]` +
      (beacon ? ',["$","script",null,{"defer":true,"src":"https://static.cloudflareinsights.com/beacon.min.js","data-cf-beacon":"{\\"token\\":\\"t\\"}"}]' : '') +
      ']}]',
  ];
  const push = JSON.stringify(rows.join('\n') + '\n').replace(/</g, '\\u003c');
  return (
    '<!DOCTYPE html><html><body><header class="site-header"><nav><a href="/">Trip Plans</a></nav></header>' +
    `<main><p>${main}</p></main><footer class="site-footer"><p>${footerText}</p></footer><nav class="bottom-bar"><a href="/trips/">Trips</a></nav>` +
    (beacon ? '<script defer="" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="{&quot;token&quot;:&quot;t&quot;}"></script>' : '') +
    `<script>self.__next_f.push([1,${push}])</script></body></html>`
  );
}

describe('the chrome measure', () => {
  it('counts footer text once in the markup and once in the payload, and main content not at all', () => {
    const a = chromeOf(page());
    const longer = chromeOf(page({ footerText: 'About the data' + 'x'.repeat(70) }));
    expect(longer.markup - a.markup).toBe(70);
    expect(longer.payload - a.payload).toBe(70);
    expect(chromeOf(page({ main: 'Body'.repeat(100) }))).toEqual(a);
  });

  it('takes a shell client component module row as chrome, and a page component row as content', () => {
    const html = page();
    const c = chromeOf(html);
    const rows = ['1:I[1,["/_next/a.js"],"SiteHeader"]\n', '2:I[2,["/_next/a.js"],"BottomBar"]\n', '3:I[3,["/_next/a.js"],"UnitSwitch"]\n'];
    const subtrees = ['["$","$L1",null,{}]', '["$","footer",null,{"className":"site-footer","children":["About the data",["$","$L3",null,{}]]}]', '["$","$L2",null,{"account":"$undefined"}]'];
    expect(c.payload).toBe([...rows, ...subtrees].reduce((n, s) => n + JSON.stringify(s).length - 2, 0));
  });

  it('keeps a row that the shell shares with the page in content', () => {
    const own = chromeOf(page());
    const shared = chromeOf(page({ sharedInMain: true }));
    // the UnitSwitch module row is also referenced from main, so it leaves the chrome; the footer subtree itself stays
    expect(own.payload - shared.payload).toBe(JSON.stringify('3:I[3,["/_next/a.js"],"UnitSwitch"]\n').length - 2);
    expect(shared.markup).toBe(own.markup);
  });

  it('counts the beacon tag when it is there', () => {
    const off = chromeOf(page());
    const on = chromeOf(page({ beacon: true }));
    expect([off.beacon, on.beacon]).toEqual([false, true]);
    expect(on.parts.beacon).toBeGreaterThan(100);
    expect(on.total - off.total).toBeGreaterThan(on.parts.beacon);
    expect(chargedChrome(off)).toBe(off.total + BEACON_ALLOWANCE_BYTES);
    expect(chargedChrome(on)).toBe(on.total);
  });

  it('fails loudly when a shell part is missing, so a renamed shell never measures zero', () => {
    expect(() => chromeOf(page().replace('class="bottom-bar"', 'class="tab-bar"'))).toThrow(/bar element/);
    expect(() => chromeOf(page().replace('\\"className\\":\\"site-footer\\"', '\\"className\\":\\"foot\\"'))).toThrow(/footer subtree/);
    expect(() => chromeOf(page().replace('class="site-header"', 'class="top"'))).toThrow(/header element/);
    expect(() => chromeOf(page().replace('</footer>', '</footer><footer class="site-footer"><p>again</p></footer>'))).toThrow(/one footer element in the markup, found 2/);
    expect(() => chromeOf(page().replace('<script>self', '<script defer="" src="https://static.cloudflareinsights.com/beacon.min.js"></script><script>self'))).toThrow(/1 beacon tags in the markup, 0 in the payload/);
    expect(chromeOf('<!DOCTYPE html><html id="__next_error__"><head></head><body></body></html>').shell).toBe(false);
  });
});

function measured(dist?: string): { page: string; c: Chrome }[] {
  const out = builtOutDir(dist);
  return walkFiles(out)
    .filter((f) => f.endsWith('.html'))
    .map((f) => ({ page: path.relative(out, f), c: chromeOf(readFileSync(f, 'utf8')) }))
    .filter((p) => p.c.shell);
}

describe('shell chrome cap (BUD-1)', () => {
  it('holds the cap at today plus 1 KB, with the beacon charged inside it (Q260, MASTER-ORDER 4.5)', () => {
    // pinned: raising any of these loosens the gate, so it is a reviewed change to this test, not a constant edit
    expect(CHROME_TODAY_BYTES).toEqual({ public: 4004, signIn: 5669 });
    expect(BEACON_ALLOWANCE_BYTES).toBe(350);
    expect(CHROME_HEADROOM_BYTES).toBe(1024);
    expect(CHROME_CAP_BYTES).toEqual({ public: 5028, signIn: 6693 });
  });

  it('keeps every page of the build under the cap of its kind (public or sign-in on)', () => {
    const pages = measured();
    expect(pages.length).toBeGreaterThan(70);
    const kinds = new Set(pages.map((p) => p.c.signIn));
    expect(kinds.size, 'every page of one build has the same bar').toBe(1);
    const cap = CHROME_CAP_BYTES[pages[0]!.c.signIn ? 'signIn' : 'public'];
    const top = [...pages].sort((a, b) => chargedChrome(b.c) - chargedChrome(a.c))[0]!;
    console.log(`shell chrome: largest ${chargedChrome(top.c)} B of ${cap} B (${top.page}); headroom ${cap - chargedChrome(top.c)} B`);
    expect(chargedChrome(top.c), top.page).toBeLessThanOrEqual(cap);
  });

  it('measures the same shell on a place, a trip and the home page (the method, three page types)', () => {
    const pages = measured();
    const pick = (re: RegExp) => pages.find((p) => re.test(p.page.split(path.sep).join('/')))!.c;
    const place = pick(/^places\/[^/]+\/index\.html$/);
    const trip = pick(/^trips\/[^/]+\/index\.html$/);
    const home = pick(/^index\.html$/);
    // the tabs mark the current section (aria-current="page" in the header and the bar), which the home page has not
    expect(place.total).toBe(trip.total);
    expect(Math.abs(place.total - home.total)).toBeLessThanOrEqual(60);
  });

  it('keeps the beacon fixture build under the cap of its kind, with the tag inside the allowance at a production token length', () => {
    const on = measured('.fixture-beacon');
    const off = new Map(measured('.fixture-out').map((p) => [p.page, p.c]));
    expect(on.length).toBeGreaterThan(70);
    for (const { page: p, c } of on) {
      expect(c.beacon, p).toBe(true);
      expect(c.total, p).toBeLessThanOrEqual(CHROME_CAP_BYTES[c.signIn ? 'signIn' : 'public']);
      const without = off.get(p);
      // the fixture token is 17 characters, a Cloudflare token 32; the token sits in the markup and in the payload
      if (without) expect(c.total - without.total + 2 * (32 - 'beacon-test-token'.length), p).toBeLessThanOrEqual(BEACON_ALLOWANCE_BYTES);
    }
  });
});
