// The maths behind the robot chassis animation, deliberately free of `three`.
//
// Same split as ./effectMath and ./directorMath: plain numbers in, plain
// numbers out, so a gait cycle or a tread wrap can be folded through a node
// test instead of judged by eye. ./robots.ts holds the three.js that consumes
// it.
//
// The one idea everything here shares: THE CLOCK IS DISTANCE, NOT TIME. Treads,
// legs and wheels are driven by how far the chassis has actually travelled, so
// they stop dead when the rig's ease settles — which is what lets the
// on-demand render loop in ./scene.ts still go to sleep. Only the hovercraft's
// idle bob uses a real clock, and its amplitude is scaled by speed so it
// reaches exactly zero when the robot does.
//
// World space matches ./effectMath: one unit = one tile, +X east, +Z south, and
// a chassis at yaw 0 faces north (-Z), because the Blender models are built
// facing +Y.

import { clamp01 } from './effectMath';

/**
 * Speed, in tiles per second, at which the speed-driven flourishes (the hover
 * bob, the thruster pulse, the leg-swing envelope) reach full amplitude.
 *
 * The rig's ease has TAU = 0.1, so a one-tile step leaves at ~10 tiles/s and
 * is under 1 by two thirds of the way there. Anything much above 3 would mean
 * the flourish only ever showed for the first two frames of a move.
 */
export const FULL_SPEED = 3;

/**
 * How much of a speed-driven flourish to apply, in [0, 1].
 *
 * Also what returns the legs to their modelled rest pose when the robot stops:
 * without it a walker freezes mid-stride at whatever phase the last move
 * happened to end on, and a robot that has never moved would sit one full
 * stride out of the pose it was sculpted in.
 */
export function motionEnvelope(speed: number): number {
  return clamp01(speed / FULL_SPEED);
}

/**
 * How far to slide a tread's rib strip forward, in tiles, given the distance
 * the chassis has travelled and the gap between ribs.
 *
 * Positive modulo, so a robot backing up scrolls its treads backwards instead
 * of jumping a whole rib. The wrap is seamless because the strip is modelled
 * with one rib more than the visible band needs: at `spacing` the strip has
 * moved rib i exactly onto where rib i+1 was, and the spare rib at the rear has
 * closed the gap the front one left.
 */
export function treadOffset(dist: number, spacing: number): number {
  if (!Number.isFinite(dist) || !(spacing > 0)) return 0;
  return ((dist % spacing) + spacing) % spacing;
}

/**
 * Gait phase, in radians, after travelling `dist` tiles.
 *
 * This constant is the no-slip condition and not a free choice. `gait` swings a
 * tripod from +stride to -stride over the half cycle it is on the ground, and
 * that half cycle is π of phase; π of phase here is `2 * stride` of travel. So
 * the planted tripod slides backwards under the body at exactly the speed the
 * body moves forward, and the feet look like they are gripping the deck rather
 * than skating over it.
 */
export function gaitPhase(dist: number, stride: number): number {
  if (!Number.isFinite(dist) || !(stride > 0)) return 0;
  return (Math.PI * dist) / (2 * stride);
}

/**
 * One tripod's offset from its rest pose: `forward` tiles along the chassis's
 * facing, `lift` tiles up.
 *
 * Phase 0 is fully forward and planted; the ground half is [0, π) and the
 * swing half — the only half that leaves the deck — is [π, 2π). The other
 * tripod is this one at `phase + π`, which is the whole of an alternating
 * tripod gait: at any moment three feet are down and three are coming over.
 */
export function gait(phase: number, stride: number, lift: number): { forward: number; lift: number } {
  if (!Number.isFinite(phase)) return { forward: 0, lift: 0 };
  return {
    forward: stride * Math.cos(phase),
    lift: lift * Math.max(0, -Math.sin(phase)),
  };
}

/**
 * Wheel rotation, in radians, after travelling `dist` tiles. Rolling without
 * slip: the contact patch covers exactly the arc it turns through.
 */
export function wheelSpin(dist: number, radius: number): number {
  if (!Number.isFinite(dist) || !(radius > 0)) return 0;
  return dist / radius;
}

/** Tiles the hovercraft rises and falls, and how many times a second. */
const BOB_TILES = 0.05;
const BOB_HZ = 1.7;
/** Radians of nose-up the skirt takes under way. A squat, not a wheelie. */
const PITCH_RAD = 0.055;

/**
 * The hovercraft's whole animation: it has no moving parts, so the body IS the
 * moving part. Rises, falls and squats back on its skirt while it is under way,
 * and sits dead level the moment it stops — at speed 0 both numbers are exactly
 * 0 whatever the clock says, which is what keeps this from holding the render
 * loop open forever.
 */
export function hoverPose(speed: number, elapsed: number): { bob: number; pitch: number } {
  const u = motionEnvelope(speed);
  if (u <= 0 || !Number.isFinite(elapsed)) return { bob: 0, pitch: 0 };
  return {
    bob: BOB_TILES * u * Math.sin(2 * Math.PI * BOB_HZ * elapsed),
    pitch: PITCH_RAD * u,
  };
}

/** How fast the thruster flicker cycles, in Hz. */
const FLICKER_HZ = 9;

/**
 * Emissive intensity for a thruster nozzle at `speed`, from its modelled
 * resting `base`. Brightens as the craft accelerates away and flickers a
 * little while it does; returns `base` EXACTLY at rest, so a settled robot
 * looks the way the .glb says it should and nothing is left animating.
 */
export function thrustGlow(speed: number, elapsed: number, base: number): number {
  const u = motionEnvelope(speed);
  if (u <= 0 || !Number.isFinite(elapsed)) return base;
  return base * (1 + u * (0.7 + 0.3 * Math.sin(2 * Math.PI * FLICKER_HZ * elapsed)));
}
