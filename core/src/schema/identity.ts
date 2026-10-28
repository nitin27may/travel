// The trip identity colours (FLOW TF19, foundation tokens 4) and a copy's ring colour (SW-026). No zod and no other import, so the copy
// sheet, Mine and the Account page can read a ring without loading the plan document's schema (start JS of every trip page, P9).
//
// `PLAN_IDENTITY_KEYS` is the one list (plan-draft.ts re-exports it; web/components/ui/Chip.tsx `IDENTITY_KEYS` is pinned equal by
// core/test/plan/step2-keys.test.ts). The colours themselves live only in web/app/themes.css (`--id-<key>`).

export const PLAN_IDENTITY_KEYS = ["blue", "orange", "rose", "teal", "sky", "yellow", "vermillion", "none"] as const;
export type PlanIdentity = (typeof PLAN_IDENTITY_KEYS)[number];

/**
 * The colours a copy is given, in order: the identity keys without `none` (done trips and ideas) and without `rose` (the palette's
 * reddish purple: the owner's rule is no purple, so a copy is never given it; a stored `rose` from elsewhere still reads).
 */
export const COPY_RING_KEYS = ["blue", "orange", "teal", "sky", "yellow", "vermillion"] as const satisfies readonly PlanIdentity[];

/** FNV-1a over the slug's UTF-16 units: a stable, spread-out number for a slug (not security). */
function slugHash(slug: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** The colour a trip reads from its slug alone: the same on every device and every visit, so a copy made before copies/2 has a ring too. */
export function slugIdentity(slug: string): PlanIdentity {
  return COPY_RING_KEYS[slugHash(slug) % COPY_RING_KEYS.length]!;
}

/** What a ring is read from: a copy, or an account trip shaped as one. */
export interface Ringed {
  slug: string;
  identity?: PlanIdentity | undefined;
}

/** A copy's ring colour: the one it was given, else its slug's. */
export function copyIdentity(c: Ringed): PlanIdentity {
  return c.identity ?? slugIdentity(c.slug);
}

/**
 * The colour a new copy is given (tokens 4: unique among the trips that are not done, as far as the six colours go): its slug's colour
 * when no other copy shows it, else the next free one after it in COPY_RING_KEYS order, else its slug's.
 */
export function pickIdentity(others: readonly Ringed[], slug: string): PlanIdentity {
  const used = new Set(others.map(copyIdentity));
  const at = slugHash(slug) % COPY_RING_KEYS.length;
  for (let i = 0; i < COPY_RING_KEYS.length; i++) {
    const k = COPY_RING_KEYS[(at + i) % COPY_RING_KEYS.length]!;
    if (!used.has(k)) return k;
  }
  return slugIdentity(slug);
}
