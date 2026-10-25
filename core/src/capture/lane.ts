// The trip-less capture lane (DATA-LOC section 5.4, PLAN R-110, BACKLOG 15.110). A place in the locations store that no trip uses
// still carries capture, suitability and relevance records: they live in data/<kind>/<TRIPLESS_LANE>/ with `"trip": TRIPLESS_LANE`, the
// same schema as a trip's lane files, so the validators, the gap reports and the Neon load treat them like any trip's.
//
// The id is neutral on purpose (owner decision DD-8, 25 Oct 2026): it must not say which places came from the owner's private list
// (PRIV1, store.ts A24). It is one constant so the owner can rename it without a data migration (move the three folders and change the
// `trip` of their files), and it is never emitted in public output or the API: the privacy detector (core/src/privacy/detect.ts) refuses
// it as a trip value. No imports, so the detector can read it without pulling in the capture world.

/** The trip id of the trip-less lane. Change it here only; everything else reads this constant. */
export const TRIPLESS_LANE = "catalogue";

/** The sidecar families that may hold a trip-less lane folder. */
export const TRIPLESS_KINDS = ["capture", "suitability", "relevance"] as const;
export type TriplessKind = (typeof TRIPLESS_KINDS)[number];

/** Repository-relative folder of the lane for one sidecar family: data/capture/catalogue and so on. */
export const triplessDir = (kind: TriplessKind): string => `data/${kind}/${TRIPLESS_LANE}`;

export const isTriplessLane = (trip: unknown): boolean => trip === TRIPLESS_LANE;

/**
 * The page ref a record of the lane hangs off: `part/<x>#<slug>` and `offer/<x>#<product>` unwrap to `<x>`, until a ref with no
 * wrapper is left. A lane record is always about a stored place, so the root must be `place/<pinned slug>`.
 */
export function rootRef(ref: string): string {
  let r = ref;
  for (let i = 0; i < 4; i++) {
    const m = /^(?:part|offer)\/(.+)#[^#]*$/.exec(r);
    if (!m) break;
    r = m[1]!;
  }
  return r;
}
