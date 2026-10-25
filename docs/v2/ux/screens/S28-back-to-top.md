# S28. Back to top (phone)

Owner request, 25 Oct 2026: "on mobile scroll to top needed". Answer: a back-to-top button on every long page, on a phone.
Principles: P3 (a glance, then a few clicks: one tap returns to the page start), P4 (no manual: a known arrow control), P1 (long lists and trip pages).

## Behaviour
- Phone only: 639 px and narrower (the same breakpoint as the bottom bar). At 640 px and wider the button does not exist.
- Shows once the reader is 1.5 screens down (`scrollY >= 1.5 x viewport height`); once shown it hides again when they are back within one screen of the top. The gap stops flicker. Rule: `web/lib/to-top.ts` (`toTopVisible`), unit-tested.
- Hidden while the on-screen keyboard is up (only while a real text-entry field has focus: text, search, email, url, tel, password, number, textarea, contenteditable; not checkbox, radio, range or select; there is deliberately no viewport-size test, because pinch zoom and page zoom shrink the visual viewport too) and while a dialog, menu or listbox is open (`[role=dialog|menu|listbox]`, `[aria-modal]`: the search results listbox, filter sheets, lightbox, entity sheet). A listbox, dialog or menu counts only while it is rendered and visible (`checkVisibility`), so a hidden or inline one does not hide the button. It is hidden while a toast is showing (`.toast-region .toast`; the toast is centred and wide ones reach the button). It is also below the scrim (`--z-drawer`).
- Tap: scroll to the top, smooth under `--d-*` defaults, instant under `prefers-reduced-motion: reduce`; focus moves to `main#main` (the skip-link target, given `tabindex=-1` on first use, `preventScroll`) so keyboard and screen-reader users continue from the top.
- Navigation itself already starts at the top (checked in `to-top.spec.ts`: Home, Trips, a trip, Places, a place, via the bottom bar and in-page links).

## Placement and look
- Fixed, right edge at `--margin`, bottom at `--phone-bottombar-h + --s-3`, so it sits above the bottom bar (whose height already includes the home-indicator allowance) and never over it. A showing toast hides the button (see Behaviour), so the two never overlap.
- 44 x 44 px (`--touch-min`), circle (`--r-full`), `--surface` fill, `--line-2` border, `--e-2` shadow, `--ink` arrow (22 px stroke arrow). Both themes come from the tokens; no new colour.
- States: hidden (opacity 0, `visibility: hidden`, so out of the tab order), shown (fade and 8 px rise over `--d-base`), pressed (1 px down), focus ring from the global `:focus-visible`. Reduced motion: fade only. Print: not shown.
- The trip page has a second fixed bottom panel: the map sheet (`.tl-mapcol[data-sheet]`, non-modal, z `--z-tripbar`). The button is hidden while it is open and returns when it closes (`ToTop` watches the attribute, so a second open is seen). A later plan bar or copy sheet must either set its own attribute in the blocked list in `ToTop.tsx` or offset this button.

## Accessibility
Native `<button>`, name "Back to top", icon `aria-hidden`. Not in the DOM until the first phone scroll, so it is not announced on arrival.

## Budgets
- No server markup: the button renders after mount only, so HTML size is unchanged.
- Always loaded: one passive scroll listener in `BottomBar` (already a client component in the layout). The button (`ToTop.tsx`) and the rule are a lazy chunk fetched on the first scroll on a phone.
- Start JS of the heaviest trip page (the 200 KB gzip cap) and place HTML (+25% cap) are measured before and after in the change that shipped this; see the commit message.
