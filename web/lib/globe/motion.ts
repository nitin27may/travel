/**
 * Globe motion timings (patterns 6): one revolution per 90 s, spin decays over 400 ms when the pointer goes
 * down, spin resumes after 20 s idle, fly-in 1200 ms. Pure, so the timings are testable without a map.
 */
export const SPIN_DEG_PER_S = 360 / 90;
export const SPIN_DECAY_MS = 400;
export const SPIN_RESUME_MS = 20_000;
export const FLY_MS = 1200;
export const TILT_MS = 500;
/** Above this zoom the globe stops spinning: the visitor is looking at something. */
export const SPIN_MAX_ZOOM = 3.2;

export interface SpinState {
  /** Current speed as a share of full speed, 0 to 1. */
  speed: number;
  /** ms timestamp of the last pointer interaction, or null before any. */
  lastTouch: number | null;
  /** True after a pointer-down until the 20 s idle has passed. */
  held: boolean;
}

export const initialSpin = (): SpinState => ({ speed: 1, lastTouch: null, held: false });

export function touchSpin(s: SpinState, now: number): SpinState {
  return { ...s, lastTouch: now, held: true };
}

export interface SpinStep { state: SpinState; dLng: number }

/**
 * Advances the spin by `dt` ms at time `now`. `active` is false when spin is off, reduced motion is on, the view is
 * not the world or the camera is moving; the speed then falls to zero over the same 400 ms so a stop is never abrupt.
 */
export function stepSpin(s: SpinState, dt: number, now: number, active: boolean): SpinStep {
  let held = s.held;
  if (held && s.lastTouch !== null && now - s.lastTouch >= SPIN_RESUME_MS) held = false;
  const target = active && !held ? 1 : 0;
  const rate = dt / SPIN_DECAY_MS;
  const speed = target > s.speed ? Math.min(target, s.speed + rate) : Math.max(target, s.speed - rate);
  return { state: { ...s, held, speed }, dLng: (dt / 1000) * SPIN_DEG_PER_S * speed };
}

/** Camera that shows a box: centre and zoom. Wide shapes (Russia, Canada) stay on the globe at about zoom 2.6. */
export function zoomForSpan(spanLon: number, spanLat: number, viewportW: number, viewportH: number, maxZoom = 7): number {
  if (spanLon > 170) return 2.6;
  const w = Math.max(spanLon, 0.01), h = Math.max(spanLat, 0.01);
  const zx = Math.log2((viewportW * 360) / (512 * w));
  const zy = Math.log2((viewportH * 170) / (512 * h));
  return Math.max(1.5, Math.min(maxZoom, Math.min(zx, zy) - 0.35));
}

/** The spin is chained one-second linear eases (MapLibre's own spinning-globe pattern), never a per-frame jump. */
export const SPIN_EASE_MS = 1000;
/** Quiet time before the spin resumes: after a drag or wheel, and after the pointer last moved over a shape. */
export const SPIN_AFTER_GESTURE_MS = 2000;
export const SPIN_AFTER_HOVER_MS = 4000;
/** A press that moves farther than this is a drag, and its release is not a click. */
export const CLICK_SLOP_PX = 4;

/** Longitude one ease should travel: a full turn in 90 s. */
export const spinStepDeg = (ms = SPIN_EASE_MS): number => (ms / 1000) * SPIN_DEG_PER_S;

/** Whether the release of a press at `from` ending at `to` is a click. */
export const isClick = (from: { x: number; y: number } | null, to: { x: number; y: number }, dragged: boolean): boolean =>
  !dragged && (!from || Math.hypot(to.x - from.x, to.y - from.y) <= CLICK_SLOP_PX);
