// The area derivation thresholds (`capture.ts derive-area`, capture contract 3.7.1), defined once. Pure and framework-free.
//
// Why these numbers (measured on 25 Oct 2026, research/runs/AREA-derive-area.md):
//   - radiusKm 10: the nearest labelled point of a registry area must be this close. The closest known point OUTSIDE Banff National
//     Park (Canmore and the Grassi Lakes, Kananaskis) sits 12 km from a labelled Banff point, Kootenay's Marble Canyon 15.6 km; at
//     15 km the rule already put Canmore trails in Banff. The registry has no area outlines, so the radius is the only fence against
//     territory the registry does not hold yet.
//   - marginRatio 2: the nearest labelled point of any OTHER area must be at least twice as far as the winner's (a border needs a
//     clear side); floorKm stops a 0 km hit from making every rival "twice as far".
/** The point rule of the area derivation. */
export const AREA_DERIVATION = {
  /** a registry area is a candidate only when one of its labelled points lies within this many km */
  radiusKm: 10,
  /** the nearest point of another area must be at least this many times farther than the winner's nearest */
  marginRatio: 2,
  /** the winner's distance is read as at least this many km for the margin, so a same-spot label cannot pass every rival */
  floorKm: 0.5,
  /** the hold-out test (frozen known records) must match at least this share of the answers the rule gives */
  minPrecision: 0.95,
} as const;
