// The maths behind the 3D board's REACTIVE LIGHTING, deliberately free of
// `three`.
//
// Same split as ./effectMath and ./robotAnim: plain numbers in, plain numbers
// out, so a light curve can be folded through a node test instead of judged by
// eye. ./scene.ts holds only the three.js that consumes it.
//
// The one idea everything here shares, and the reason it is a separate module
// at all: EVERY CURVE LANDS EXACTLY BACK ON ITS RESTING VALUE. The render loop
// in ./scene.ts sleeps when nothing reports movement, so a light nudge that
// decayed asymptotically — or that ended a float epsilon off the resting
// intensity — would either keep the loop open forever or leave the board a
// shade wrong until the next event. `nudgeCurve` and `flameScale` therefore
// return their rest values from an exact `>= life` branch rather than from the
// tail of a sine, and the tests assert that identity rather than approximating
// it. Phase 47 learned this the hard way with the hover bob; the same trap is
// here.

import { flashCurve } from './effectMath';

/**
 * What the key light sits at when nothing is happening — the intensity and the
 * warm white ./scene.ts constructs it with. Every nudge is an offset from
 * these, and every nudge ends on them exactly.
 */
export const KEY_REST = { intensity: 2.4, color: 0xfff2dc } as const;

/**
 * How far toward its tint a nudge may pull the key at its peak. Well short of
 * 1: the key lights the whole board, and a fully red key reads as a broken
 * renderer rather than as a robot taking a hit.
 *
 * 0.35 by measurement, not by taste. At 0.55 a single point of radiation damage
 * repainted the entire deck red for a quarter second — a reaction sized for a
 * destruction, on the most routine event in the game. At 0.35 it reads as the
 * lights flinching, which is what one damage is worth.
 */
const TINT_MAX = 0.35;

/** Which reaction a nudge is. One event kind each; see NUDGES. */
export type NudgeKind = 'damage' | 'destroyed' | 'laser' | 'win';

export interface Nudge {
  /** Seconds elapsed. */
  t: number;
  life: number;
  /** Signed peak offset from `KEY_REST.intensity`. Negative is a dip. */
  peak: number;
  /** Hex the key leans toward at the peak, or null to keep the resting hue. */
  tint: number | null;
}

/**
 * Event -> reaction. Short, all of them: this is punctuation on an event that
 * the caption and the effect field are already telling you about, so anything
 * long enough to notice as "the lighting changed" is too long.
 *
 * `laser` is deliberately BEAM_PUNCH's 0.14s — the beam's opening flare and the
 * key pulse are one event, and a key that outlived the punch read as a second,
 * unexplained flash.
 *
 * `destroyed` is the 20% dim the phase plan asked for, as an absolute offset:
 * -0.2 * 2.4.
 */
export const NUDGES: Record<NudgeKind, Omit<Nudge, 't'>> = {
  damage: { life: 0.26, peak: -0.35, tint: 0xff5a4a },
  destroyed: { life: 0.5, peak: -0.48, tint: null },
  laser: { life: 0.14, peak: 0.55, tint: null },
  win: { life: 0.8, peak: 1.3, tint: null },
};

export function startNudge(kind: NudgeKind): Nudge {
  return { t: 0, ...NUDGES[kind] };
}

/**
 * A nudge's shape over its life, in [0, 1]: up and back down once.
 *
 * EXACTLY 0 outside (0, life) — the boundary is a branch, not `Math.sin(PI)`,
 * which is 1.2e-16 and not zero. That epsilon is the difference between a key
 * light that settles and one that is permanently a hair off its resting value.
 */
export function nudgeCurve(t: number, life: number): number {
  if (!Number.isFinite(t) || !(life > 0) || t <= 0 || t >= life) return 0;
  return Math.sin(Math.PI * (t / life));
}

/** Advance a nudge. False once it is spent — and it is spent AT `life`. */
export function stepNudge(n: Nudge, dt: number): boolean {
  if (Number.isFinite(dt)) n.t += dt;
  return n.t < n.life;
}

/**
 * Blend two packed 0xRRGGBB colours. Returns `a` bit-exactly at k <= 0 and `b`
 * at k >= 1, so a tint that has finished cannot leave the key a rounding step
 * off the white it started at.
 */
export function mixHex(a: number, b: number, k: number): number {
  if (!Number.isFinite(k) || k <= 0) return a;
  if (k >= 1) return b;
  let out = 0;
  for (let shift = 16; shift >= 0; shift -= 8) {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    out |= Math.round(ca + (cb - ca) * k) << shift;
  }
  return out >>> 0;
}

/**
 * What the key light should be right now. `null`, or a spent nudge, gives back
 * `KEY_REST` — the same object's numbers, not an approximation of them.
 */
export function nudgeLight(n: Nudge | null): { intensity: number; color: number } {
  const k = n ? nudgeCurve(n.t, n.life) : 0;
  if (!n || k <= 0) return { intensity: KEY_REST.intensity, color: KEY_REST.color };
  return {
    // Clamped at 0: a dip deeper than the resting intensity would otherwise ask
    // three.js for a negative light.
    intensity: Math.max(0, KEY_REST.intensity + n.peak * k),
    color: n.tint === null ? KEY_REST.color : mixHex(KEY_REST.color, n.tint, k * TINT_MAX),
  };
}

// --------------------------------------------------------------- flamer flame
/**
 * The modelled flame's rest scale (1 = exactly what the .glb/primitive says),
 * what a burst leaps to, and how long the burst lasts.
 *
 * `boardMesh` already instances a cone over every flamer. It is NOT idled —
 * a permanently flickering flame would keep the render loop awake on every
 * board carrying a flamer, and it would also say "firing" on the four registers
 * out of five when the burner is cold. It sits at rest and leaps on the
 * `damage` event that says the burner actually fired.
 */
export const FLAME_REST = 1;
export const FLAME_PEAK = 2.3;
export const FLAME_SECONDS = 0.45;

/**
 * Flame scale at `t` seconds into a burst. Uses the effect field's flash curve
 * — instant attack, quadratic decay — because a burner has no wind-up, and
 * returns `FLAME_REST` exactly once the burst is over.
 */
export function flameScale(t: number): number {
  if (!Number.isFinite(t) || t <= 0 || t >= FLAME_SECONDS) return FLAME_REST;
  return FLAME_REST + (FLAME_PEAK - FLAME_REST) * flashCurve(t / FLAME_SECONDS);
}
