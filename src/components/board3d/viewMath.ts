// The maths behind player camera control, deliberately free of `three`.
//
// Phase 3D-2 splits the camera in two: the *director* owns the subject (which
// cell is framed, and how close the action wants to be) while the *player*
// owns the viewpoint (yaw around that subject, tilt, and a zoom multiplier on
// the director's distance). This module is the player half — plain numbers in,
// plain `{x, y, z}` out — so the clamps and the spherical placement are unit
// testable in the node test environment and cannot silently drift when
// camera.ts is refactored.
//
// Angles are DEGREES at every boundary: they are what the clamps are written
// in, what lands in localStorage, and what `window.__board3d.view()` reports
// to Playwright. Radians only exist inside the functions below.
//
// World space matches camera.ts: one unit = one tile, +X east, +Z south.

/** Who chooses the subject the camera frames. */
export type FollowMode = 'action' | 'robot' | 'free';

export interface View {
  /**
   * Degrees the camera has orbited east around the subject. 0 puts it due
   * south looking north — the fixed angle 3D-1 shipped, and the one the DOM
   * board reads in. Wrapped to [-180, 180).
   */
  yaw: number;
  /** Degrees above the board plane. */
  tilt: number;
  /**
   * Multiplier on the director's distance, so it composes instead of
   * replacing: 1 is whatever framing the director asked for, below 1 is
   * pulled in closer, above 1 is pulled back.
   */
  zoom: number;
}

/** 3D-1's fixed camera, and what ↺ returns to. */
export const DEFAULT_VIEW: View = { yaw: 0, tilt: 52, zoom: 1 };

/** Below this you are inside the board; above it the lookAt gimbals. */
export const TILT_MIN = 18;
export const TILT_MAX = 85;
export const ZOOM_MIN = 0.45;
export const ZOOM_MAX = 2.2;

const DEG = Math.PI / 180;

/** Wrap degrees to [-180, 180) so eases take the short way round. */
export function wrapYaw(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

function clampNum(value: number | undefined, lo: number, hi: number, fallback: number): number {
  // Values arrive from localStorage as well as from gestures, so a corrupt
  // NaN must land on the default rather than poisoning the camera matrix.
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(hi, Math.max(lo, value));
}

/** Clamp a (possibly partial, possibly junk) view into the legal envelope. */
export function clampView(v: Partial<View>): View {
  return {
    yaw: wrapYaw(typeof v.yaw === 'number' ? v.yaw : DEFAULT_VIEW.yaw),
    tilt: clampNum(v.tilt, TILT_MIN, TILT_MAX, DEFAULT_VIEW.tilt),
    zoom: clampNum(v.zoom, ZOOM_MIN, ZOOM_MAX, DEFAULT_VIEW.zoom),
  };
}

/**
 * Where the camera sits relative to the subject. At yaw 0 this is exactly
 * 3D-1's `(0, sin(tilt) * d, cos(tilt) * d)` — south of and above the target,
 * looking north — and yaw orbits that offset east about the subject.
 */
export function cameraOffset(
  yaw: number,
  tilt: number,
  distance: number,
): { x: number; y: number; z: number } {
  const y = yaw * DEG;
  const t = tilt * DEG;
  const ground = Math.cos(t) * distance;
  return {
    x: Math.sin(y) * ground,
    y: Math.sin(t) * distance,
    z: Math.cos(y) * ground,
  };
}

/** The player's zoom applied over the director's chosen distance. */
export function composeDistance(base: number, zoom: number): number {
  if (!Number.isFinite(base) || base <= 0) return 1;
  return base * clampNum(zoom, ZOOM_MIN, ZOOM_MAX, 1);
}

/**
 * Half-extents of the board rectangle as the camera sees it, in the camera's
 * own screen axes — which is what a field-of-view fit needs.
 *
 * At yaw 0 this returns `{ width / 2, height * sin(tilt) / 2 }`, the two terms
 * 3D-1 hardcoded; away from yaw 0 the board's diagonal is what has to fit, and
 * that is the whole reason this is computed rather than assumed.
 */
export function boardHalfExtents(
  width: number,
  height: number,
  yaw: number,
  tilt: number,
): { halfW: number; halfH: number } {
  const y = yaw * DEG;
  const t = tilt * DEG;
  // Screen-right and screen-up, projected onto the ground plane. Up is
  // foreshortened by sin(tilt) — that is the board tipping away from you.
  const rx = Math.cos(y);
  const rz = -Math.sin(y);
  const ux = Math.sin(y) * Math.sin(t);
  const uz = Math.cos(y) * Math.sin(t);
  let halfW = 0;
  let halfH = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const vx = (sx * width) / 2;
      const vz = (sz * height) / 2;
      halfW = Math.max(halfW, Math.abs(vx * rx + vz * rz));
      halfH = Math.max(halfH, Math.abs(vx * ux + vz * uz));
    }
  }
  return { halfW, halfH };
}

/**
 * Ground-plane movement of the *subject* for a drag across the screen, so the
 * board follows the finger: drag right and the subject slides left.
 *
 * `dxFrac`/`dyFrac` are fractions of the viewport height (screen pixels are
 * meaningless to a world-space camera); `scale` is world units per one such
 * fraction, which only the camera — holding distance and FOV — can know.
 */
export function panOffset(
  yaw: number,
  dxFrac: number,
  dyFrac: number,
  scale: number,
): { x: number; z: number } {
  const y = yaw * DEG;
  // Screen-right on the ground, and the ground direction that reads as
  // "down-screen" (away from the camera's north).
  const rx = Math.cos(y);
  const rz = -Math.sin(y);
  const fx = Math.sin(y);
  const fz = Math.cos(y);
  return {
    x: -(dxFrac * rx + dyFrac * fx) * scale,
    z: -(dxFrac * rz + dyFrac * fz) * scale,
  };
}
