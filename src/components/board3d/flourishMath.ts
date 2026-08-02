// The two CAMERA FLOURISHES, deliberately free of `three`.
//
// Fourth module in the ./viewMath, ./directorMath, ./lightMath pattern: plain
// numbers in, plain numbers out, node-testable without a DOM or a GPU.
// ./camera.ts holds only the three.js that composes these onto the live pose.
//
// Everything before this phase framed the action competently and never
// *performed*: winning the game looked exactly like claiming a checkpoint, and
// a cross-board whip re-aim looked exactly like a two-tile nudge apart from
// being faster. These are the two curves that close that gap, and they are both
// deliberately small — a camera flourish only reads if it is subtle.
//
// THE ONE RULE, shared with ./lightMath and for the same reason: BOTH CURVES
// RETURN EXACTLY THEIR RESTING VALUE OUTSIDE THEIR LIVE RANGE, from a branch
// rather than from the tail of a sine. ./scene.ts's render loop sleeps when
// nothing reports movement, so a flourish that decayed asymptotically would
// hold the loop open forever, and one that ended a float epsilon off would
// leave the player's camera permanently a hair rotated or a hair wide. That is
// invisible in the browser — every builtin board has belts and never settles —
// so the tests are the only place the guarantee is observable.

import { WHIP_DISTANCE } from './directorMath';
import { nudgeCurve } from './lightMath';

// ------------------------------------------------------------------ win orbit
/**
 * How long the victory sweep lasts. Long enough to read as a deliberate move
 * rather than a jolt, short enough that it is over before the player reaches
 * for the results screen.
 */
export const ORBIT_SECONDS = 1.8;
/**
 * How far the sweep reaches, in RADIANS — about 32 degrees.
 *
 * A SWEEP, NOT AN ORBIT, and the distinction is the whole design. A full
 * revolution swings the camera behind the board and shows the far rim and the
 * backs of every tile; that is not a victory lap, it is a bug report. A third
 * of a right angle is enough parallax to say "something happened" while every
 * piece on the board stays the way up the player left it.
 *
 * Radians because that is what the curve is written in; ./camera.ts converts
 * once at its boundary, where viewMath's degrees begin.
 */
export const ORBIT_PEAK_RAD = 0.55;

/**
 * Radians of yaw offset `t` seconds into a win orbit. EXACTLY 0 outside.
 *
 * Borrows `nudgeCurve`'s shape — up and back down once, zero from a branch at
 * both ends — because the sweep has to come back to PRECISELY where the player
 * left it. This offset is composed on top of the player's own yaw and never
 * written into it, so "precisely" is not a nicety: an orbit that ended at
 * 1e-16 rad would leave the camera fighting its own ease forever.
 */
export function orbitYaw(t: number): number {
  return ORBIT_PEAK_RAD * nudgeCurve(t, ORBIT_SECONDS);
}

// ------------------------------------------------------------------ FOV widen
/**
 * Degrees the field of view opens at the top of a full-length whip.
 *
 * Two degrees on a 20-degree lens, which is about as far as this can go before
 * it stops reading as speed and starts reading as the board changing size. The
 * effect is the projection widening while the framing stays solved at rest —
 * see `fit()` in ./camera.ts, which must keep using the RESTING value or the
 * pull-back compensates and cancels this exactly.
 */
export const FOV_WIDEN_DEG = 2.2;

/**
 * Degrees to add to the resting FOV for a re-aim of `travel` tiles.
 *
 * Scales on the same `min(1, travel / WHIP_DISTANCE)` ramp `easeTau` uses, so
 * "what counts as a whip" has ONE definition rather than two that drift apart.
 * Exactly 0 at travel 0 — a settled camera does no projection work at all.
 */
export function fovWiden(travel: number): number {
  if (!Number.isFinite(travel) || travel <= 0) return 0;
  return FOV_WIDEN_DEG * Math.min(1, travel / WHIP_DISTANCE);
}
