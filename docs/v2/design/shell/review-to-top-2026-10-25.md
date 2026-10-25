# Design review: S28, the phone back-to-top button (25 Oct 2026)

Reviewer: `travel-design-reviewer`, model Opus 5.5 (`claude-opus-5-5`). Review only: no app code changed. Branch `public/TOTOP`, commit 34debf6, worktree `/Users/nks/workspace/travel-wt/v2-TOTOP`.

**Verdict: ship after fixes.** The button is the right control, in the right place, at the right size, and the lazy load keeps the server HTML and the start JS where they were. Contrast passes in both themes. The `S28` behaviour rules are mostly sound. But three things are wrong on a real phone:
- it floats over the open trip map sheet, so a tap meant for the map throws the page behind it to the top;
- the "keyboard is up" test also fires when someone pinch-zooms, so the people who most need a shortcut lose it;
- after a keyboard press it leaves a 2 px focus line across the page.

Each fix is a few lines. Counts: **3 must, 7 should, 6 polish.**

## 0. What this is based on

- **Spec**: [S28-back-to-top.md](../../ux/screens/S28-back-to-top.md).
- **Code**: `git show 34debf6` (`ToTop.tsx`, `lib/to-top.ts`, `BottomBar.tsx`, `app.css` lines 82 to 98, the two tests). Read against `themes.css` (generated), `ui.css` (toast, sheets), `styles/timeline.css` (trip map sheet) and `layout.tsx` (skip link, `main#main`, viewport meta).
- **Authority**: [principles.md](../foundation/principles.md) P1 to P9, [components.md](../foundation/components.md) 1.4 (bottom bar) and 5.3 (toast), [tokens.md](../foundation/tokens.md), [keep-from-live-site.md](../keep-from-live-site.md), [trip-scope-scenarios.md](../trip-scope-scenarios.md), [product-direction-2026-10-18.md](../product-direction-2026-10-18.md) (no green, no purple, public site first).
- **The builder's shots**: all ten files read (trip, place, places, search and search-open, light and dark, 390 x 844 at 2x) in the session scratchpad `totop-shots/`.
- **My renders**: a production build of this branch served by `next start` on a spare port, with Chromium from `web/node_modules` and the Metal GPU flags. Each shot is 2x, with a touch and mobile context. Dark mode was set through the site's own "Switch to dark theme" control. The shots are in the scratchpad `totop-shots/review/` and are not committed. Pages: a place page (tap, keyboard Enter, page end), the trip page (page end, map sheet open), the Places list (page end, map view), widths 568, 600, 639, 640, 667 and 844, page zoom at 260 and 195 CSS px, pinch zoom 1.5x, and a toast. No Playwright e2e was run.
- **Measured**: `vitest run tests/budget.test.ts tests/shell/to-top.test.ts` (both pass), plus a one-off count of start-JS bytes per page, taken from a temporary test file that I deleted afterwards. The vitest global setup rebuilt `.next` during this run, so the counts below come from a fresh build of 34debf6.

## 1. What is right

- **Place and reach.** The button is 44 x 44 at the right edge, 14 px in (`--margin` on a phone), and its bottom edge sits 12 px above the bottom bar (measured: button y 704 to 748, bar from 760, at 390 x 844). That is in the natural thumb arc for a right hand and still reachable with the left. Tap goes to the top and the page start is the cue (P3, P4).
- **Thresholds.** The button shows at 1.5 screens down and hides again within 1 screen of the top. The gap stops flicker at the edge, and the unit test pins it. Viewport height is read live, so the iOS toolbar collapsing does not break it.
- **Lazy and honest.** It is not in the server HTML or the accessibility tree before the first phone scroll. Hidden means `visibility: hidden`, so it is out of the tab order and not announced. Print hides it.
- **Overlays.** The search panel (listbox), filter and entity sheets, menus, popovers and the lightbox all hide it (shots `search-open-*`). The bottom sheets sit above it in z order anyway (`--z-menu` 40 against `--z-drawer` 25).
- **Reduced motion.** It scrolls at once (`behavior: 'auto'`), and the button fades without the 8 px rise. The CSS order is correct: `[data-show]` resets the visibility delay at a higher specificity.
- **Safe area (the builder's claim).** It holds for the button. The button's bottom edge is `84 + 12 = 96` px above the layout viewport bottom. The iPhone home-indicator inset is 34 px, so the button clears it by 62 px. `layout.tsx:21` sets no `viewport-fit=cover`, so `env(safe-area-inset-bottom)` would resolve to 0 in Safari today and adding it would change nothing. The 26 px padding belongs to the bar, not the button. Whether that padding is enough in a standalone or in-app browser is a bottom bar question for a real device (section 5), not part of this lane.
- **Tap focus.** After a touch tap, `main` takes focus and `:focus-visible` is false, so no ring shows (measured in both themes, `place-after-tap-*`).
- **Pages it lands on.** The button showed and worked on the trip, place and Places pages in both themes. It is absent at 640 px and wider (640 x 960, 667 x 375 and 844 x 390 all report no element), so 1440 is unaffected.

## 2. Contrast (WCAG 2.2; 1.4.11 non-text 3:1, 1.4.3 text 4.5:1)

| Pair | Light | Dark | Sunlight | Use |
|---|---|---|---|---|
| Arrow `--ink` on fill `--surface` | 16.06 | 13.83 | 21.00 | the icon (the identifying part) |
| Border `--line-2` against page `--bg` | 3.39 | 3.78 | 3.39 | the control boundary on the page |
| Border `--line-2` against a card `--surface` | 3.67 | 3.42 | 3.67 | when it rests over a card |
| Border `--line-2` against `--surface-2` | 3.12 | 3.02 | 3.12 | over a tinted panel or day chip |
| Border `--line-2` against `--well` | 3.18 | 3.94 | 3.18 | over a well |
| Fill `--surface` against `--bg` | 1.08 | 1.10 | 1.08 | not relied on (the border carries it) |
| `--e-2` ring against `--bg` | 1.25 (`#D8DEE5`) | 3.78 (`#5E748E`) | 1.25 | decorative halo, not relied on in light |
| Focus ring `--focus` against `--bg` | 14.85 | 15.28 | 14.85 | `:focus-visible` on the button |

Every pair the control relies on passes: the icon at 13.8:1 or more, the boundary at 3.02:1 or more. The weakest is dark border on `--surface-2` at 3.02, which passes with almost no margin. Over a photo the boundary is the white or dark fill against the photo, which varies. The 13.8:1 icon still identifies the control, so 1.4.11 is met by the icon alone. Approved.

**The dark border the builder flagged.** In dark, the big drop shadow (`rgba(0,0,0,0.5)`) does not show against `#0F1620`, so the edge is the border, and that is enough (3.78:1). But `--e-2` starts with its own `0 0 0 1px #5E748E` ring. With the `#5E748E` border inside it, that makes a 2 px ring in dark, heavier than every other 1 px control on the page (`trip-dark.png`, `place-dark.png`). In light the same layer draws a pale `#D8DEE5` halo outside a `#7A8794` border. Neither is wrong, but neither is intended (polish 2).

## 3. MUST (before merge)

**M1. The button floats over the open trip map sheet.** Screen: trip page, phone, map open (`trip-mapsheet-light.png`, `trip-mapsheet-dark.png`).
- The phone map is a non-modal fixed sheet (`styles/timeline.css:437`, `z-index: --z-tripbar` 15) with no `role="dialog"`, so `OVERLAY` misses it (`web/components/shell/ToTop.tsx:6`). The button (`--z-drawer` 25, `web/app/app.css:86`) draws on top of the map. Measured: `elementFromPoint` at the button's centre returns the button's SVG, which sits over the 50 km scale bar and the map's lower right.
- Why it matters: a parent panning the map or tapping a stop near the bottom right throws the day list behind the sheet to the top while the sheet stays open. They lose their place in the trip with no visible cause (P5: every open and close is linked; S5 and S7 in trip-scope-scenarios use this map on the road).
- The spec is also wrong here. `S28-back-to-top.md:17` says "No fixed bar other than the bottom bar exists on the trip page today", but the map sheet is exactly that.
- Fix:
  - Block while any fixed bottom panel is open. Add `.tl-mapcol[data-sheet]` to the blocked test. Better, add a one-word contract, `[data-covers-bottom]`, that the map sheet (and any later plan bar or copy sheet) sets while it is open.
  - Also make the `MutationObserver` at `ToTop.tsx:26-27` watch attributes: `{ childList: true, subtree: true, attributes: true, attributeFilter: ['data-sheet', 'data-covers-bottom', 'open'] }`. Opening the sheet a second time only flips `data-sheet`, which a childList observer never sees.
  - Rewrite `S28-back-to-top.md:17` to name the map sheet.
  - Add an e2e test: open the map on `/trips/dolomites-2027/` at 390 px and expect the button to be hidden.

**M2. The "keyboard is up" test hides the button for anyone who zooms.** Screens: any long page, phone.
- `keyboardUp` (`web/lib/to-top.ts:14-16`) is true when `visualViewport.height < 0.75 x innerHeight`. Pinch zoom shrinks the visual viewport by the zoom factor. Measured at 1.5x: `visualViewport.height` 562.7 against `innerHeight` 844, so the button hides with no keyboard in sight. Anything past 1.33x does the same.
- Page zoom triggers it too whenever a page is wider than the zoomed viewport. At 195 CSS px (200% text size on a 390 px phone) the layout grows to 587 px tall against a 422 px visual viewport, and the button hides.
- The `typing` test (`web/components/shell/ToTop.tsx:18`) treats a focused checkbox, radio, range or `<select>` as typing. On Android those take focus on tap, so the button stays hidden after someone toggles a control until focus moves.
- Why it matters: people who zoom have to scroll further and are the ones a back-to-top control serves most (accessibility first; P4).
- Fix:
  - Drop the viewport-ratio test. A soft keyboard is only up while an editable field has focus, on both iOS and Android, so the focus test alone is enough. When Android's back key closes the keyboard and leaves the field focused, the button stays hidden, which does no harm.
  - Narrow `typing` to text entry: `a.isContentEditable || a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/^(button|checkbox|radio|range|color|file|image|reset|submit|hidden)$/.test((a as HTMLInputElement).type))`.
  - Update the unit test at `web/tests/shell/to-top.test.ts:18-22` with a pinch case (visual 562, layout 844, not typing: visible).
  - Update `S28-back-to-top.md:9`.
  - If a viewport test is kept anyway, it must use `visualViewport.height * visualViewport.scale`. That fixes pinch zoom but not the overflow case.

**M3. Keyboard activation leaves a 2 px line across the page.** Screen: place page, phone, after Enter on the button (`place-end-light.png`, `place-end-dark.png`).
- `go()` (`web/components/shell/ToTop.tsx:48-52`) focuses `main#main`. After a keyboard press, `:focus-visible` is true (measured), so the global ring (`web/app/app.css:24`, 2 px `--focus` at 2 px offset) draws round the whole `main`. The top and sides fall under the header and off the screen edge. The bottom edge shows as a full-width 2 px bar above the footer: `#172230` in light, `#E7ECF1` in dark (pixel-sampled at y 1196 to 1199 in both shots). It stays until focus moves.
- `tabindex="-1"` is also left on `main` for the rest of the visit. In Chromium a click on any blank part of the page now focuses `main`, and the skip link (`layout.tsx:39`) now moves focus to `main` and draws the same line.
- Why it matters: it is a stray rule across the content that means nothing to the reader. Calm, honest UI and the keyboard path are both product rules.
- Fix:
  - Add `#main:focus { outline: none; }` to `app.css`. `main` is a landmark, not a control, and the content start is the cue.
  - Remove the attribute once focus leaves: `main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true })`. This only runs when `go()` added the attribute itself.

## 4. SHOULD

**S1. Long toasts sit on top of the button.** Screen: any phone page after Copy, Export or Download.
- The toast region is centred at the same bottom offset (`web/app/app.css:79`, `ui.css:436`) and draws above the button (`--z-toast` 45 against 25). The spec says the opposite (`S28-back-to-top.md:14`: "may pass under it"). Short toasts clear it ("Link copied", 114 px wide, `toast.png`).
- Any toast wider than 274 px overlaps it. That includes "Copied <trip> · 14 days from ... Undo" and "Downloaded <file> · <summary>", which can reach 362 px. The button's ring then peeks out round the toast's rounded end beside the Undo action. A slightly wide tap aimed at Undo then scrolls the page instead of undoing.
- Fix: count a showing toast as blocking (add `.toast` to the blocked selector), and correct the spec line.

**S2. While it rests, it covers the last action on a row.** Screens: Places cards and the trip day list (`places-light.png`, `search-light.png`, `trip-light.png`).
- On every Places card the rightmost footer link, "Globe", is fully covered whenever the card footer passes the 44 px band ("Place page G", then the button). On the trip day list it covers the right end of the day's time bar.
- The reader can scroll a little, but this is the comfortable reading band.
- Fix (owner choice): show the button only after an upward scroll of 48 px or more past the 1.5-screen mark, and hide it on downward scroll. The intent is clear, it covers nothing while someone reads down, and it is still one tap (P3). Otherwise, accept it and record it in the spec.

**S3. The overlay test can match things that are not open.** File: `web/components/shell/ToTop.tsx:6,19`.
- `document.querySelector('[role="listbox"]', ...)` matches any listbox in the DOM, including one kept mounted but hidden, or a future inline list such as a where picker on a page. That would silently kill the button on that page and no test would notice.
- Today every match is a real open overlay (GlobalSearch `gs-body`, WhereMenu inside its popover or sheet, VariantMenu only while open), so this is not a must.
- Fix: test visibility, `[...document.querySelectorAll(SEL)].some((el) => el.checkVisibility ? el.checkVisibility() : (el as HTMLElement).offsetParent !== null)`, and add a code comment that names the contract.

**S4. The trip-page start-JS budget has 3 bytes left. The commit message's number does not reproduce.**
- Measured on a fresh build of 34debf6: four trip pages (Algonquin, Rockies, Chamonix, Costa Rica) load 204,797 B gzipped at start, which is 199.997 KB against the 200 KB cap in `web/tests/budget.test.ts:9`.
- The commit message says 199.98 KB. My count matches 199.997, the figure the brief gave as the before. So the listener costs about nothing, but the headroom is 3 bytes, not 20.
- Why it matters: the next lane to add anything to `BottomBar.tsx`, `SiteHeader` or any shared chunk will fail `budget.test.ts` with no warning, probably at merge time.
- Fix (coordinator): record the 3 B headroom in `docs/v2/PLAN.md`, run BottomBar and shell lanes one after another, and decide before the next shell change whether to re-baseline the trip-page cap or move something out of the trip page's start bundle. Not this lane's code.

**S5. Tablets and phones in landscape get no button.**
- The breakpoint is 639 px (`web/app/app.css:84`, `BottomBar.tsx:24`), matching the bottom bar. Every current iPhone in landscape (844 to 932 px wide, 375 to 430 px tall) and every iPad gets nothing (`w844x390.png`, `w667x375.png`).
- The trip page uses its phone layout, with the map as a sheet, up to 1023 px (`styles/timeline.css:435`), and a landscape phone shows about two lines of a day at a time.
- The owner asked for "mobile", so this is a decision, not a defect.
- Recommendation: extend to `(max-width: 1023px) and (pointer: coarse)`. With no bottom bar, use `bottom: max(var(--s-4), env(safe-area-inset-bottom))`. That needs `viewport-fit=cover` in `layout.tsx:21`, which is a shell change, so plan it as its own row.

**S6. The tests do not cover the risky paths.** Missing:
- the map sheet (M1);
- a long toast (S1);
- pinch zoom and the keyboard rule (M2: a unit test is enough once the rule is focus-only);
- dark mode;
- keyboard Enter leaving no outline (M3).

`webkit-iphone` already runs `to-top.spec.ts` (`playwright.config.ts:23`). Add the map-sheet case to it.

**S7. The control is not in the foundation.** `components.md` has no entry for a floating back-to-top button, so the next floating control will reinvent its z-index, offset and blocking rules.
- Fix: add a short floating-control entry: offset `--phone-bottombar-h + --s-3`, `--z-drawer`, the `[data-covers-bottom]` contract, and the toast rule.
- I own the foundation and will make that change in the foundation files (`tokens.md`, `components.md`, `patterns.md`, `specimen.html` and `changes-from-preview.md` together) once M1 settles the contract. This run was limited to this file.

## 5. Polish

1. **Icon stroke.** The inline SVG uses `strokeWidth="2"` (`ToTop.tsx:57`). The icon set draws at 1.75 (`web/components/ui/Icon.tsx:92`). Add `arrowUp: 'M12 19V5M6 11l6-6 6 6'` to `Icon` and use it. `Icon` is already in the bottom bar's chunk, so it costs no start bytes.
2. **One ring, not two.** Swap `border: 1px solid var(--line-2); box-shadow: var(--e-2)` for `border: 0; box-shadow: var(--e-3)`. The ring in `--e-3` is `#7A8794` in light and `#5E748E` in dark, the same colours as `--line-2`. That gives one 1 px boundary at the same 3.39:1 and 3.78:1, and a shadow that does a little more in dark (`app.css:87-88`).
3. **RTL.** `right: var(--margin)` (`app.css:86`) should be `inset-inline-end: var(--margin)`. The site is English only today, and the up arrow needs no mirroring.
4. **Observer cost.** The observer at `ToTop.tsx:26` watches the whole body for the rest of the session, globe included, and runs one `querySelector` per animation frame when the DOM changes. The cost is small but never stops. Disconnect it while `(max-width: 639px)` does not match. The page is then wider than a phone, and the CSS already hides the button.
5. **Pressed state on iOS.** `:active` (`app.css:93`) does not apply in iOS Safari without a touch listener. The 1 px press is invisible there, which is harmless.
6. **Spec wording.** "Smooth under `--d-*` defaults" (`S28-back-to-top.md:10`) is not true: the browser sets smooth-scroll timing. Say "smooth (browser timing)".

## 6. Checked and fine, or outside this lane

- **Thumb reach and hit area against the bar**: 12 px gap, no overlap with the bar's 56 px items.
- **Page ends**: on the trip page, a place page and Places, the footer's Units control and the pagination clear the button at the bottom of the page (`end-*.png`, `place-end-*.png`).
- **Short landscape phone** (568 x 320, iPhone SE): the button shows over a thin content band between the sticky filter heading and the bar. That band comes from the bar and the sticky headings, not this button.
- **Places map view** (`?view=map`): the page is short, so the button never shows.
- **Screen readers**: the button is a native `button` named "Back to top" with an `aria-hidden` icon. After activation, focus on an unnamed `main` should make VoiceOver say "main" and read from the page start. Not verified on a device.
- **Outside this lane, seen while rendering**:
  - At 260 CSS px (150% page zoom) the trip page is 302 px wide. Fixed UI then lands partly off the visual viewport (`zoom-260-_trips_dolomites-2027_.png`), which is a reflow defect in the trip page.
  - The day-rail counter at the top right of the trip page shows "02" and "08" drawn over each other while the map sheet is open (`trip-mapsheet-*.png`).
  - In touch emulation, the theme toggle kept a visible focus ring after a tap (`place-btn-focus-dark.png`).

  Each should go to the shell or trip owner.

## 7. What I could not verify

- **The keyboard rule on real devices.** Manual check needed on an iPhone (Safari) and an Android phone (Chrome):
  1. On a Places page scrolled 2 screens down, open search from the bottom bar, type, then close the keyboard. iOS: with "Done". Android: with the back key, which keeps the field focused.
  2. Confirm the button stays hidden while the panel is open and comes back after Close.
  3. After M2, pinch-zoom to 2x and confirm the button stays.
- **VoiceOver and TalkBack**: what is announced after activation.
- **Home indicator** in a standalone or in-app browser (Instagram, Gmail), where Safari's own bottom toolbar does not cover the inset. The button clears it by arithmetic; the bar is the open question.
- **WebKit rendering.** All my renders are Chromium. The builder's e2e runs it on `webkit-iphone`, but I ran no e2e here.
- **Motion quality** of the fade and of the smooth scroll on a long trip page on a real phone. Not judged.

## 8. Hand-back for the builder

Must, in order:
- M1: `ToTop.tsx:6,19,26-27`; `TripPlan.tsx:353` or `timeline.css` to set the contract attribute; spec line 17; one e2e test.
- M2: `lib/to-top.ts:14-16`, `ToTop.tsx:18-19`, the unit test, spec line 9.
- M3: `app.css` (one rule) and `ToTop.tsx:48-52`.

Should, in this lane: S1, S3 and S6. S2 needs the owner's choice. S4 and S5 go to the coordinator. S7 comes back to me.
