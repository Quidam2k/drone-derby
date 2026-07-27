// The maths behind the 3D board's transient effects, deliberately free of
// `three`.
//
// Same split as ./viewMath: everything here is plain numbers in, plain numbers
// out, so the fall trajectories, the easing curves, the muzzle offsets and the
// bubble's screen-space clamp are unit tested in the node environment without a
// DOM or a GPU. ./effects.ts holds only the three.js that consumes this.
//
// World space matches ./camera.ts and ./boardMesh.ts: one unit = one tile, cell
// (x, y) centres on (x + 0.5, 0, y + 0.5), so +X is east and +Z is south.
//
// Durations are NOT here: they are sized to ReplayPlayer's eventDuration budget
// and live beside the effect that uses them.

import type { Direction, Position } from '../../engine';

export function clamp01(t: number): number {
  if (!Number.isFinite(t)) return 0;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Cubic ease-out: leaves fast, arrives soft. */
export function ease(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

/** Fraction of a flash's life spent rising. Short — a flash has no wind-up. */
const ATTACK = 0.12;

/**
 * Brightness of a flash across its life, in [0, 1]: a near-instant attack to
 * full, then a quadratic decay. Peaks at ATTACK rather than at 0 so the effect
 * is brightest a frame or two *after* it spawns, which is what stops it looking
 * like a single dropped frame.
 */
export function flashCurve(t: number): number {
  const u = clamp01(t);
  if (u <= ATTACK) return u / ATTACK;
  const d = (u - ATTACK) / (1 - ATTACK);
  return (1 - d) * (1 - d);
}

/** Unit step, in world units, for each board direction. */
export const DIR_STEP: Record<Direction, { x: number; z: number }> = {
  N: { x: 0, z: -1 },
  E: { x: 1, z: 0 },
  S: { x: 0, z: 1 },
  W: { x: -1, z: 0 },
};

/** The dominant board direction of a world-space displacement, or null. */
export function vecToDir(x: number, z: number): Direction | null {
  if (Math.abs(x) < 1e-6 && Math.abs(z) < 1e-6) return null;
  if (Math.abs(x) >= Math.abs(z)) return x > 0 ? 'E' : 'W';
  return z > 0 ? 'S' : 'N';
}

// -------------------------------------------------------------- falling
/**
 * A chassis mid-fall. `out` is measured along the fall direction (0 for a pit,
 * which drops straight down the shaft the 3D-3 kit models); `y` is height above
 * the deck, so it goes negative; `opacity` reaches 0 exactly at t = 1 so the
 * robot is gone by the time the rig honours `visible: false`.
 */
export interface FallPose {
  out: number;
  y: number;
  /** Radians of yaw spin, on top of whatever the chassis was facing. */
  spin: number;
  /** Radians of pitch, tipping the chassis over as it goes. */
  tilt: number;
  opacity: number;
}

/** Linear fade to nothing over the tail of a life. */
function fadeFrom(t: number, from: number): number {
  if (t <= from) return 1;
  return Math.max(0, 1 - (t - from) / (1 - from));
}

/**
 * Straight down the shaft, tumbling, fading as it passes the lip — the pit
 * floor is only half a tile down, so the fade is what sells the depth rather
 * than the drop distance.
 */
export function pitFall(t: number): FallPose {
  const u = clamp01(t);
  return {
    out: 0,
    y: -1.9 * u * u,
    spin: u * 2.6,
    tilt: u * 1.5,
    opacity: fadeFrom(u, 0.42),
  };
}

/**
 * Off the rim: flung outward and slightly up, then gravity. The early rise is
 * what distinguishes this from a pit at a glance — one drops, one is thrown.
 *
 * The throw is deliberately barely over a tile. The 3D viewport is sized to the
 * board itself, so there is no canvas outside the rim to fall into: a longer arc
 * just leaves the frame before it has finished reading as a fall.
 */
export function edgeFall(t: number): FallPose {
  const u = clamp01(t);
  return {
    out: 1.05 * ease(u),
    y: 1.3 * u - 4.4 * u * u,
    spin: u * 3.4,
    tilt: u * 2.2,
    opacity: fadeFrom(u, 0.5),
  };
}

/**
 * Which way a robot that fell off the board went.
 *
 * `robot-fell`'s `at` is the last IN-BOUNDS cell, so the board edge it touches
 * names the direction — and for all but corner cells that is the whole answer.
 *
 * A corner touches two edges (a one-cell-wide board touches opposite pairs), and
 * the engine emits NO `robot-moved` before an edge fall — the robot never lands
 * out of bounds — so there is nothing in the event to disambiguate it. `hints`
 * are tried in order against the candidate edges; the caller passes the rig's
 * facing first (a robot that drives off a corner went the way it was pointing)
 * and its travel second (which covers being pushed or backing up).
 */
export function edgeFallDir(
  at: Position,
  width: number,
  height: number,
  ...hints: (Direction | null | undefined)[]
): Direction {
  const edges: Direction[] = [];
  if (at.y <= 0) edges.push('N');
  if (at.x >= width - 1) edges.push('E');
  if (at.y >= height - 1) edges.push('S');
  if (at.x <= 0) edges.push('W');
  const hinted = hints.find((h): h is Direction => !!h && edges.includes(h));
  // An interior cell shouldn't produce an edge fall at all, but a hand-authored
  // board or a future rule shouldn't be able to throw here.
  if (!edges.length) return hints.find((h): h is Direction => !!h) ?? 'S';
  if (edges.length === 1) return edges[0];
  return hinted ?? edges[0];
}

// -------------------------------------------------------------- lasers
/**
 * How far along its facing a robot's muzzle sits, and how high off the deck.
 * Matched to the Blender chassis: far enough forward to clear the front of the
 * widest hull, level with the turrets on all four.
 */
export const ROBOT_MUZZLE = { along: 0.34, height: 0.3 };

/** Where a robot standing at `pos` (world units) fires from. */
export function robotMuzzle(
  pos: { x: number; z: number },
  facing: Direction,
): { x: number; y: number; z: number } {
  const d = DIR_STEP[facing];
  return {
    x: pos.x + d.x * ROBOT_MUZZLE.along,
    y: ROBOT_MUZZLE.height,
    z: pos.z + d.z * ROBOT_MUZZLE.along,
  };
}

/** How far past the last cell's centre a beam that hit nothing carries on. */
export const BEAM_OVERSHOOT = 0.5;

export interface Segment {
  mid: { x: number; y: number; z: number };
  length: number;
  /** Unit vector from `from` to `to`. Zero-length segments report +X. */
  dir: { x: number; y: number; z: number };
}

/**
 * A beam as a mesh wants it: a midpoint to sit on, a length to scale to, and a
 * direction to point at. Full 3D, because a board emitter's lens and a robot's
 * turret are at different heights and a beam between them must slope.
 */
export function segment(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
): Segment {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dy, dz);
  return {
    mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 },
    length,
    dir: length > 1e-9 ? { x: dx / length, y: dy / length, z: dz / length } : { x: 1, y: 0, z: 0 },
  };
}

// -------------------------------------------------------------- bubbles
export interface ViewportPoint {
  /** CSS pixels from the canvas's top-left. */
  x: number;
  y: number;
  visible: boolean;
}

/**
 * Normalised device coordinates -> CSS pixels inside a `width` x `height`
 * canvas, nudged to stay `margin` px inside it so a bubble over a robot at the
 * rim isn't half cut off. The margins are separate because a bubble is much
 * wider than it is tall, and it hangs upward from its anchor.
 *
 * Anything OUTSIDE the canvas is culled, not clamped. Two reasons. A point
 * behind the eye (`z > 1` after the perspective divide) projects to the opposite
 * side of the screen, so clamping it would pin the bubble to the wrong edge. And
 * with the camera tight on the action most robots are off-frame most of the
 * time: pinning their bubbles to the rim would fill the frame with speech from
 * robots you cannot see, which is the noise this phase has to avoid. A bubble
 * belongs to a robot you can point at.
 */
export function projectToViewport(
  ndc: { x: number; y: number; z: number },
  width: number,
  height: number,
  margin: { x: number; y: number } = { x: 8, y: 8 },
): ViewportPoint {
  if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y) || !(ndc.z <= 1)) {
    return { x: 0, y: 0, visible: false };
  }
  const px = (ndc.x * 0.5 + 0.5) * width;
  const py = (-ndc.y * 0.5 + 0.5) * height;
  if (px < 0 || px > width || py < 0 || py > height) {
    return { x: px, y: py, visible: false };
  }
  // On a viewport narrower than twice the margin the clamp would invert, so
  // fall back to the centre line.
  const mx = Math.min(margin.x, width / 2);
  const my = Math.min(margin.y, height / 2);
  return {
    x: Math.min(width - mx, Math.max(mx, px)),
    y: Math.min(height - my, Math.max(my, py)),
    visible: true,
  };
}
