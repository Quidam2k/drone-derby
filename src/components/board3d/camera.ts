// Camera for the 3D board — the three.js half of the director.
//
// WHAT DECIDES and WHAT EXECUTES are split. `./directorMath` decides: it scores
// events, clusters them into a Shot, and applies the dwell rule, all as pure
// data so a whole turn can be folded in a node test. This module executes: it
// eases onto whatever Shot it is handed, solves the pull-back that keeps the
// Shot's radius in frame, and composes all of that with the player's viewpoint.
//
// Phase 3D-2 split ownership between director and player and that is unchanged:
// the director owns the *subject* (which cells, and how close the action wants
// to be) while the player owns the *viewpoint* (yaw, tilt, and a zoom
// multiplier on whatever distance the director asked for — see ./viewMath).
// They compose, so a player who has orbited 40 degrees to see behind a wall
// keeps that angle while the camera still flies to the laser hit. Only panning
// takes the subject away from the director, and that is what flips the mode to
// `free`.
//
// Phase 3D-5 changes three things here. `focus()` takes a Shot instead of a
// bare cell, so a shot can ask for more than MIN_RADIUS and get it. The clamp
// that keeps the framing over the board gains a bounded OVERHANG, so a robot
// thrown off the south rim has canvas to be thrown into. And the ease is
// distance-adaptive, so a cross-board re-aim reads as a whip instead of a slow
// drift past everything in between.
//
// Phase 49 adds the two FLOURISHES from ./flourishMath — a sweep on a win and a
// field-of-view widen while whipping. Both are strictly ADDITIVE layers on top
// of the pose solved above, and that is not a style choice:
//
//   - The orbit is composed at `apply()` time and NEVER touches `view.yaw` or
//     `wantedView.yaw`. Those are the PLAYER's viewpoint, eased toward the
//     persisted `viewSettings` value — an orbit written into them would fight
//     its own ease and would leave the player's saved camera permanently
//     rotated after the win.
//   - The widen changes the live `camera.fov` while `fit()` keeps solving the
//     pull-back from the RESTING one. That is the whole trick: `fit()` derives
//     distance from the FOV, so a widened `fit()` would pull the camera in to
//     compensate and cancel the effect exactly.
//
// Both land on their resting values from a branch and then report `false`, so
// the on-demand render loop still sleeps; both are skipped entirely under
// reduced motion, where `setStill` has already pinned the framing.
//
// World space: one unit = one tile. Board cell (x, y) centres on
// (x + 0.5, 0, y + 0.5), so +X is east and +Z is south — the same orientation
// the DOM board reads in, with north up-screen.

import * as THREE from 'three';
import type { BoardDef, Position } from '../../engine';
import { easeTau, MIN_RADIUS, type Shot } from './directorMath';
import { ORBIT_SECONDS, fovWiden, orbitYaw } from './flourishMath';
import {
  boardHalfExtents,
  cameraOffset,
  composeDistance,
  DEFAULT_VIEW,
  panOffset,
  wrapYaw,
  type View,
} from './viewMath';

/**
 * The RESTING field of view: narrow and far back rather than wide and close —
 * "orthographic-ish". At 34 degrees the near rank of a 17-row board rendered
 * twice the size of the far one and the top of the board became unreadable;
 * this keeps tiles roughly uniform while still giving the chassis some
 * perspective to sit in.
 *
 * Since 49 this is the resting value, not the only value: `camera.fov` opens by
 * `fovWiden(travel)` while the director is whipping. Read this one for anything
 * that solves FRAMING (`fit()`, and so every pull-back) and the live one for
 * anything that reads the current PROJECTION (`pan()`).
 */
const FOV = 20;
/** Wider than a single event: "lock to my bot's *area*" wants the pushes and
 * the incoming lasers in frame too, not just the chassis. */
export const ROBOT_RADIUS = 4.6;
const PADDING = 1.1;
/** Headroom above the board for robot height and the far rim, in tiles. */
const RIM = 0.6;
/**
 * Tiles the subject may sit OUTSIDE the board.
 *
 * 3D-4 left a known hole: the viewport is sized to the board with headroom only
 * *above* it, and `focus()` clamped the subject so the framing stayed over the
 * board — so a robot thrown off the SOUTH rim fell out of the bottom of the
 * canvas with nothing to see. A bounded overhang gives a rim shot somewhere to
 * put the throw. Bounded, because unbounded is a camera that can be panned into
 * empty space by an event.
 */
const OVERHANG = 1.5;
/**
 * The player's own input eases three times faster than the director's. A drag
 * has to feel like it is attached to your finger; an automatic fly-in has to
 * feel cinematic. One time constant cannot be both.
 */
const VIEW_TAU = 0.12;

export function cellCentre(p: Position, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(p.x + 0.5, 0, p.y + 0.5);
}

/** Wall clock, so the dwell rule does not depend on frames being rendered. */
function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Two shots that frame the same thing. Interest and reason are deliberately
 * ignored: they explain a shot, they do not change where the camera points, and
 * counting a reason change as a re-aim would make `cuts()` meaningless.
 */
function sameShot(a: Shot | null, b: Shot | null): boolean {
  if (!a || !b) return !a && !b;
  return (
    Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3 && Math.abs(a.radius - b.radius) < 1e-3
  );
}

/** A whole-cell Shot, for the callers that still think in single cells. */
export function cellShot(pos: Position, radius = MIN_RADIUS, reason: Shot['reason'] = 'robot'): Shot {
  return { x: pos.x, y: pos.y, radius, content: 0, interest: 1, reason };
}

export class CameraDirector {
  readonly camera: THREE.PerspectiveCamera;

  private board: BoardDef;
  private aspect = 1;
  private readonly target = new THREE.Vector3();
  private readonly wanted = new THREE.Vector3();
  /** The director's own pull-back, before the player's zoom multiplier. */
  private base = 12;
  private distance = 12;
  /** False once focus() is on a shot rather than the whole board. */
  private wide = true;
  /** Half-extent the current focus wants in frame. */
  private radius = MIN_RADIUS;
  /** The shot the director is on, or null for the whole board. */
  private shot: Shot | null = null;
  /**
   * When the current shot was taken, on the wall clock.
   *
   * NOT accumulated from `step(dt)`, which would be the obvious thing and is
   * wrong: this scene renders on demand, so the rAF loop stops entirely once
   * the camera, the rigs and the effects have all settled. A dwell clock ticked
   * by frames would therefore run at somewhere between 100% and 5% of real
   * time depending on whether the board happens to have a conveyor animating —
   * and a camera that freezes on its first shot of the turn on the boards
   * without conveyors is a very confusing bug to find.
   */
  private shotAt = now();
  /** Shots taken since the scene started. Only a counter, for assertions. */
  private cutCount = 0;
  /**
   * Of those, how many were HARD cuts (`cutTo`) rather than eases.
   *
   * Separate because `cutCount` alone cannot answer the question the reel has
   * to be held to — "does it cut only on a beat boundary?" — and inferring the
   * answer from a re-aim count is exactly the eyeballing 3D-5 replaced.
   */
  private hardCutCount = 0;
  /**
   * prefers-reduced-motion: pin the whole-board framing and take the director
   * out of the loop entirely. Camera motion is the biggest vestibular offender
   * in this scene — 3D-2 shipped the player controls without handling it, and
   * 3D-4's effects already have their still-mark rule. Player control still
   * works: someone who asks for reduced motion has not asked to lose the orbit.
   */
  private still = false;
  /** Eased viewpoint, and where the player has asked it to go. */
  private readonly view: View = { ...DEFAULT_VIEW };
  private readonly wantedView: View = { ...DEFAULT_VIEW };
  /** Seconds into the win sweep, or null when there isn't one. */
  private orbitT: number | null = null;
  /**
   * DEGREES of sweep to add to the player's yaw right now — the boundary where
   * `orbitYaw`'s radians become viewMath's degrees, converted once so no other
   * call site has to know the difference.
   *
   * Additive and separate from `view.yaw` on purpose; see the module header.
   */
  private flourishYaw = 0;

  constructor(board: BoardDef, aspect: number) {
    this.board = board;
    this.aspect = aspect;
    this.camera = new THREE.PerspectiveCamera(FOV, aspect, 0.5, 200);
    this.setBoard(board);
    this.snap();
  }

  setBoard(board: BoardDef): void {
    this.board = board;
    this.clearFlourish();
    // Not focus(null): the shot may ALREADY be null, and focus() is idempotent
    // — it would skip the re-centring the new board's dimensions need.
    this.shot = null;
    this.shotAt = now();
    this.wide = true;
    this.radius = MIN_RADIUS;
    this.wanted.set(board.width / 2, 0, board.height / 2);
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    // No refit needed: the pull-back is re-solved from the live aspect and
    // view every step, so the ease carries the camera to the new framing.
  }

  /** The player's target viewpoint. Already clamped by the settings service. */
  setView(view: View): void {
    this.wantedView.yaw = view.yaw;
    this.wantedView.tilt = view.tilt;
    this.wantedView.zoom = view.zoom;
  }

  /** Read-only copy of the eased viewpoint — used by the probe. */
  currentView(): View {
    return { ...this.view };
  }

  /**
   * Degrees of win sweep currently layered ON TOP of `currentView().yaw`.
   *
   * Reported separately because it is separate: the player's yaw deliberately
   * does not move during a flourish, so a probe that only read `currentView()`
   * would report a perfectly still camera through the whole victory lap. This
   * is the only place the sweep is observable from outside.
   */
  flourishDegrees(): number {
    return this.flourishYaw;
  }

  /** The shot being held, or null for the whole board. */
  currentShot(): Shot | null {
    return this.shot ? { ...this.shot } : null;
  }

  /** Seconds the current shot has been held — the dwell rule's input. */
  heldSeconds(): number {
    return (now() - this.shotAt) / 1000;
  }

  /** How many times the director has re-aimed. The headline number. */
  cuts(): number {
    return this.cutCount;
  }

  /** Of those, how many were hard cuts. Only a reel ever makes one. */
  hardCuts(): number {
    return this.hardCutCount;
  }

  /** Reduced motion pins the whole-board framing; see `still`. */
  setStill(still: boolean): void {
    if (still === this.still) return;
    this.still = still;
    if (still) {
      this.clearFlourish();
      this.focus(null);
    }
  }

  /**
   * Take a victory lap: a short additive sweep of the camera around the
   * subject, out and straight back to exactly where the player left it.
   *
   * The one moment in a game that is allowed a flourish for its own sake —
   * before this, winning framed identically to claiming a checkpoint. It is NOT
   * a re-aim: the subject, the pull-back and `cuts()` are all untouched, and a
   * player dragging through the sweep keeps full control.
   */
  winFlourish(): void {
    if (this.still) return;
    this.orbitT = 0;
    this.flourishYaw = 0;
  }

  /** Back to no sweep at all, with the offset zeroed rather than left mid-arc. */
  private clearFlourish(): void {
    this.orbitT = null;
    this.flourishYaw = 0;
  }

  /** The framed cell, in board coordinates. */
  subject(): { x: number; y: number } {
    return { x: this.wanted.x - 0.5, y: this.wanted.z - 0.5 };
  }

  /**
   * Distance at which a halfW x halfH slab centred on the target just fits.
   *
   * Deliberately the RESTING FOV, never `camera.fov`. This solves the pull-back
   * FROM the field of view, so feeding it the widened value would pull the
   * camera in by exactly as much as the lens opened and cancel the whole
   * effect. The framing is solved at rest; only the projection widens.
   */
  private fit(halfW: number, halfH: number): number {
    const vHalf = THREE.MathUtils.degToRad(FOV) / 2;
    const hHalf = Math.atan(Math.tan(vHalf) * this.aspect);
    return Math.max(halfH / Math.tan(vHalf), halfW / Math.tan(hHalf)) * PADDING;
  }

  private wholeBoardDistance(): number {
    // Orbiting turns the board's diagonal toward the camera and tilting
    // foreshortens its depth, so both half-extents follow the live view.
    const { halfW, halfH } = boardHalfExtents(
      this.board.width,
      this.board.height,
      this.view.yaw,
      this.view.tilt,
    );
    return this.fit(halfW, halfH + RIM);
  }

  /** What the director wants, before the player's zoom. */
  private baseDistance(): number {
    const whole = this.wholeBoardDistance();
    // Never "zoom in" past the whole-board framing — on a small board that
    // would push the camera backwards and read as a lurch.
    return this.wide ? whole : Math.min(this.fit(this.radius, this.radius), whole);
  }

  /**
   * Take a shot. `null` frames the whole board.
   *
   * Idempotent by design: re-handing the director the shot it is already on
   * costs nothing and does NOT reset the dwell clock, because callers re-run
   * the follow rule on every update and a dwell timer that restarts 120 times a
   * turn is not a dwell timer.
   */
  focus(shot: Shot | null): void {
    if (this.still) shot = null;
    if (sameShot(this.shot, shot)) return;
    this.shot = shot ? { ...shot } : null;
    this.shotAt = now();
    this.cutCount++;
    this.wide = !shot;
    this.radius = shot?.radius ?? MIN_RADIUS;
    if (!shot) {
      this.wanted.set(this.board.width / 2, 0, this.board.height / 2);
      return;
    }
    this.wanted.set(shot.x + 0.5, 0, shot.y + 0.5);
    // Keep the framing over the board rather than sliding off its corner —
    // but with OVERHANG tiles of give, so a shot that deliberately reaches past
    // the rim (an edge fall) is not clamped back onto the board it left.
    const margin = Math.min(this.radius, this.board.width / 2);
    const marginZ = Math.min(this.radius, this.board.height / 2);
    this.wanted.x = THREE.MathUtils.clamp(
      this.wanted.x,
      margin - OVERHANG,
      this.board.width - margin + OVERHANG,
    );
    this.wanted.z = THREE.MathUtils.clamp(
      this.wanted.z,
      marginZ - OVERHANG,
      this.board.height - marginZ + OVERHANG,
    );
  }

  /**
   * Take a shot WITHOUT easing onto it — a hard cut.
   *
   * The only caller is the highlight reel, on a beat boundary, and that is the
   * whole justification. `easeTau`'s header says a hard cut with no
   * shot-change cue reads as a rendering bug in a viewport this small; a reel
   * has the cue, because its beat counter ticks over on exactly this frame.
   *
   * The subject and the pull-back snap; the player's yaw/tilt/zoom deliberately
   * keep easing, because those belong to whoever is dragging and a cut is not
   * an excuse to yank their viewpoint. Under reduced motion `focus()` has
   * already coerced the shot to null and the framing does not move at all.
   */
  cutTo(shot: Shot | null): void {
    const before = this.cutCount;
    this.focus(shot);
    // Only if the framing actually changed. `focus()` is idempotent, and under
    // reduced motion it coerces every shot to null — so a pinned camera counts
    // zero hard cuts, which is the assertion that matters there.
    if (this.cutCount !== before) this.hardCutCount++;
    this.target.copy(this.wanted);
    this.base = this.baseDistance();
    this.distance = composeDistance(this.base, this.view.zoom);
    this.apply();
  }

  /**
   * Slide the subject under a drag. This is the one gesture that takes the
   * subject off the director, which is why the caller flips to `free` mode —
   * a frozen camera should be a visible state, not a mystery.
   */
  pan(dxFrac: number, dyFrac: number): void {
    // World units spanned by the viewport's height at the current distance.
    // The LIVE fov, unlike `fit()`: this converts a screen fraction into world
    // units, which is a genuine question about the projection on screen right
    // now. Dragging mid-whip through a widened lens must move the board by what
    // the player sees, not by what it will be worth when the camera settles.
    const scale = 2 * this.distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    // Plus the flourish, for the same reason: during a win sweep the board is
    // rotated on screen, and a drag has to follow the finger through it.
    const d = panOffset(this.view.yaw + this.flourishYaw, dxFrac, dyFrac, scale);
    // A tile of slack past the rim, so the board can be pushed to an edge but
    // not flung into empty space.
    this.wanted.x = THREE.MathUtils.clamp(this.wanted.x + d.x, -1, this.board.width + 1);
    this.wanted.z = THREE.MathUtils.clamp(this.wanted.z + d.z, -1, this.board.height + 1);
  }

  private apply(): void {
    // At yaw 0 the camera sits south of and above the target, looking north —
    // so a robot facing N (its modelled forward) points away from the viewer,
    // exactly as it reads on the DOM board.
    // `view.yaw` is the player's; `flourishYaw` is the win sweep layered on top
    // and is zero at rest, so this is bit-identical to the pre-49 pose whenever
    // nothing is performing.
    const off = cameraOffset(this.view.yaw + this.flourishYaw, this.view.tilt, this.distance);
    this.camera.position.set(
      this.target.x + off.x,
      this.target.y + off.y,
      this.target.z + off.z,
    );
    this.camera.lookAt(this.target);
  }

  /** Advance the ease. Returns true while the camera is still moving. */
  step(dt: number): boolean {
    // Distance-adaptive: a long re-aim whips, a short one drifts. Measured from
    // where the camera IS to where it is going, so a re-aim interrupted
    // mid-flight slows down as it closes rather than snapping.
    const travel = Math.hypot(this.wanted.x - this.target.x, this.wanted.z - this.target.z);
    const k = 1 - Math.exp(-dt / easeTau(travel));
    const kv = 1 - Math.exp(-dt / VIEW_TAU);

    // Viewpoint: the player's, eased fast. Yaw goes the short way round so a
    // drag through +180 doesn't unwind the whole board.
    const dYaw = wrapYaw(this.wantedView.yaw - this.view.yaw);
    const dTilt = this.wantedView.tilt - this.view.tilt;
    const dZoom = this.wantedView.zoom - this.view.zoom;
    this.view.yaw = wrapYaw(this.view.yaw + dYaw * kv);
    this.view.tilt += dTilt * kv;
    this.view.zoom += dZoom * kv;

    // Subject and pull-back: the director's, eased slow.
    const wantedBase = this.baseDistance();
    this.target.lerp(this.wanted, k);
    this.base += (wantedBase - this.base) * k;
    this.distance = composeDistance(this.base, this.view.zoom);

    // The win sweep, advanced on the same clock. `!(t < ORBIT_SECONDS)` rather
    // than `t >= ORBIT_SECONDS` so a NaN dt ends the sweep instead of leaving
    // `orbitT` NaN forever — which would hold `moving` true and the render loop
    // awake for the rest of the page's life.
    if (this.orbitT !== null) {
      if (Number.isFinite(dt)) this.orbitT += dt;
      if (!(this.orbitT < ORBIT_SECONDS)) this.orbitT = null;
    }
    this.flourishYaw =
      this.orbitT === null ? 0 : THREE.MathUtils.radToDeg(orbitYaw(this.orbitT));

    const moving =
      this.orbitT !== null ||
      this.target.distanceToSquared(this.wanted) > 1e-6 ||
      Math.abs(wantedBase - this.base) > 1e-3 ||
      Math.abs(dYaw) > 0.01 ||
      Math.abs(dTilt) > 0.01 ||
      Math.abs(dZoom) > 1e-4;
    if (!moving) {
      // Restores the resting FOV too, so a settled projection is exact rather
      // than merely close.
      this.snapValues();
    } else {
      // Only ever WIDER than rest, and only while re-aiming: `travel` shrinks
      // as the ease closes, so the widen decays on its own and is already back
      // to FOV by the time the shot lands.
      this.setFov(FOV + (this.still ? 0 : fovWiden(travel)));
    }
    this.apply();
    return moving;
  }

  /** Change the projection only when it actually changed. */
  private setFov(fov: number): void {
    if (this.camera.fov === fov) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  private snapValues(): void {
    this.clearFlourish();
    this.setFov(FOV);
    // View first: the pull-back is solved from the yaw and tilt.
    this.view.yaw = this.wantedView.yaw;
    this.view.tilt = this.wantedView.tilt;
    this.view.zoom = this.wantedView.zoom;
    this.target.copy(this.wanted);
    this.base = this.baseDistance();
    this.distance = composeDistance(this.base, this.view.zoom);
  }

  snap(): void {
    this.snapValues();
    this.apply();
  }
}
