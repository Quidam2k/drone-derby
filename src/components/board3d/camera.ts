// Camera + the (deliberately dumb) director for the 3D board.
//
// The real interest-scoring director is 3D-5. This one does the minimum that
// answers "does flying to the action feel good": every cursor step it asks the
// current event where it happened and eases the camera onto that cell, falling
// back to framing the whole board when the event has no place (turn/register
// markers, card reveals) or when there is no event at all (live views).
//
// Phase 3D-2 splits ownership rather than replacing any of that: the director
// still owns the *subject* (which cell, and how close the action wants to be)
// while the player owns the *viewpoint* (yaw, tilt, and a zoom multiplier on
// whatever distance the director asked for — see ./viewMath). They compose,
// so a player who has orbited 40 degrees to see behind a wall keeps that angle
// while the camera still flies to the laser hit. Only panning takes the
// subject away from the director, and that is what flips the mode to `free`.
//
// World space: one unit = one tile. Board cell (x, y) centres on
// (x + 0.5, 0, y + 0.5), so +X is east and +Z is south — the same orientation
// the DOM board reads in, with north up-screen.

import * as THREE from 'three';
import type { BoardDef, EngineEvent, Position } from '../../engine';
import type { VisualState } from '../replay/visualState';
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
 * Narrow and far back rather than wide and close — "orthographic-ish". At 34
 * degrees the near rank of a 17-row board rendered twice the size of the far
 * one and the top of the board became unreadable; this keeps tiles roughly
 * uniform while still giving the chassis some perspective to sit in.
 */
const FOV = 20;
/** Tiles of half-extent kept in frame when the camera is on a single event. */
const FOCUS_RADIUS = 3.6;
/** Wider than a single event: "lock to my bot's *area*" wants the pushes and
 * the incoming lasers in frame too, not just the chassis. */
export const ROBOT_RADIUS = 4.6;
const PADDING = 1.1;
/** Headroom above the board for robot height and the far rim, in tiles. */
const RIM = 0.6;
/** Seconds to cover ~63% of the remaining distance. Frame-rate independent. */
const TAU = 0.36;
/**
 * The player's own input eases three times faster than the director's. A drag
 * has to feel like it is attached to your finger; an automatic fly-in has to
 * feel cinematic. One time constant cannot be both.
 */
const VIEW_TAU = 0.12;

export function cellCentre(p: Position, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(p.x + 0.5, 0, p.y + 0.5);
}

function robotPos(visual: VisualState, player: string): Position | null {
  return visual.robots.find((r) => r.player === player)?.pos ?? null;
}

/**
 * Where an event happened, or null for "no particular place".
 *
 * Every one of the 19 EngineEvent variants either carries a Position or names
 * a player whose position the VisualState knows — which is why the camera
 * needs no change to the event union (that would break replay).
 */
export function eventFocus(e: EngineEvent | null | undefined, visual: VisualState): Position | null {
  if (!e) return null;
  switch (e.type) {
    case 'robot-moved':
    case 'conveyor-moved':
      return e.to;
    case 'robot-blocked':
    case 'robot-fell':
    case 'robot-destroyed':
      return e.at;
    case 'robot-respawned':
      return e.pos;
    case 'laser-fired': {
      // Midpoint of the beam, so both muzzle and impact stay in frame.
      const a = e.path[0];
      const b = e.path[e.path.length - 1];
      return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
    }
    case 'robot-rotated':
    case 'gear-rotated':
    case 'damage':
    case 'register-locked':
    case 'life-lost':
    case 'player-eliminated':
    case 'checkpoint-claimed':
    case 'game-won':
    case 'card-revealed':
      return robotPos(visual, e.player);
    case 'turn-started':
    case 'turn-ended':
    case 'register-started':
      return null;
  }
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
  /** False once focus() is on a single cell rather than the whole board. */
  private wide = true;
  /** Half-extent the current focus wants in frame. */
  private radius = FOCUS_RADIUS;
  /** Eased viewpoint, and where the player has asked it to go. */
  private readonly view: View = { ...DEFAULT_VIEW };
  private readonly wantedView: View = { ...DEFAULT_VIEW };

  constructor(board: BoardDef, aspect: number) {
    this.board = board;
    this.aspect = aspect;
    this.camera = new THREE.PerspectiveCamera(FOV, aspect, 0.5, 200);
    this.setBoard(board);
    this.focus(null);
    this.snap();
  }

  setBoard(board: BoardDef): void {
    this.board = board;
    this.focus(null);
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

  /** The framed cell, in board coordinates. */
  subject(): { x: number; y: number } {
    return { x: this.wanted.x - 0.5, y: this.wanted.z - 0.5 };
  }

  /** Distance at which a halfW x halfH slab centred on the target just fits. */
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

  /** null = frame the whole board. */
  focus(pos: Position | null, radius = FOCUS_RADIUS): void {
    this.wide = !pos;
    this.radius = radius;
    if (!pos) {
      this.wanted.set(this.board.width / 2, 0, this.board.height / 2);
      return;
    }
    cellCentre(pos, this.wanted);
    // Keep the framing over the board rather than sliding off its corner.
    const margin = Math.min(radius, this.board.width / 2);
    const marginZ = Math.min(radius, this.board.height / 2);
    this.wanted.x = THREE.MathUtils.clamp(this.wanted.x, margin, this.board.width - margin);
    this.wanted.z = THREE.MathUtils.clamp(this.wanted.z, marginZ, this.board.height - marginZ);
  }

  /**
   * Slide the subject under a drag. This is the one gesture that takes the
   * subject off the director, which is why the caller flips to `free` mode —
   * a frozen camera should be a visible state, not a mystery.
   */
  pan(dxFrac: number, dyFrac: number): void {
    // World units spanned by the viewport's height at the current distance.
    const scale = 2 * this.distance * Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
    const d = panOffset(this.view.yaw, dxFrac, dyFrac, scale);
    // A tile of slack past the rim, so the board can be pushed to an edge but
    // not flung into empty space.
    this.wanted.x = THREE.MathUtils.clamp(this.wanted.x + d.x, -1, this.board.width + 1);
    this.wanted.z = THREE.MathUtils.clamp(this.wanted.z + d.z, -1, this.board.height + 1);
  }

  private apply(): void {
    // At yaw 0 the camera sits south of and above the target, looking north —
    // so a robot facing N (its modelled forward) points away from the viewer,
    // exactly as it reads on the DOM board.
    const off = cameraOffset(this.view.yaw, this.view.tilt, this.distance);
    this.camera.position.set(
      this.target.x + off.x,
      this.target.y + off.y,
      this.target.z + off.z,
    );
    this.camera.lookAt(this.target);
  }

  /** Advance the ease. Returns true while the camera is still moving. */
  step(dt: number): boolean {
    const k = 1 - Math.exp(-dt / TAU);
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

    const moving =
      this.target.distanceToSquared(this.wanted) > 1e-6 ||
      Math.abs(wantedBase - this.base) > 1e-3 ||
      Math.abs(dYaw) > 0.01 ||
      Math.abs(dTilt) > 0.01 ||
      Math.abs(dZoom) > 1e-4;
    if (!moving) this.snapValues();
    this.apply();
    return moving;
  }

  private snapValues(): void {
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
