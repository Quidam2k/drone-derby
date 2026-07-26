// Camera + the (deliberately dumb) director for the 3D board spike.
//
// The real interest-scoring director is 3D-5. This one does the minimum that
// answers "does flying to the action feel good": every cursor step it asks the
// current event where it happened and eases the camera onto that cell, falling
// back to framing the whole board when the event has no place (turn/register
// markers, card reveals) or when there is no event at all (live views).
//
// World space: one unit = one tile. Board cell (x, y) centres on
// (x + 0.5, 0, y + 0.5), so +X is east and +Z is south — the same orientation
// the DOM board reads in, with north up-screen.

import * as THREE from 'three';
import type { BoardDef, EngineEvent, Position } from '../../engine';
import type { VisualState } from '../replay/visualState';

/** Three-quarter view: high enough to read the grid, low enough to see chassis. */
const ELEVATION = THREE.MathUtils.degToRad(52);
/**
 * Narrow and far back rather than wide and close — "orthographic-ish". At 34
 * degrees the near rank of a 17-row board rendered twice the size of the far
 * one and the top of the board became unreadable; this keeps tiles roughly
 * uniform while still giving the chassis some perspective to sit in.
 */
const FOV = 20;
/** Tiles of half-extent kept in frame when the camera is on a single event. */
const FOCUS_RADIUS = 3.6;
const PADDING = 1.1;
/** Seconds to cover ~63% of the remaining distance. Frame-rate independent. */
const TAU = 0.36;

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
  private distance = 12;
  private wantedDistance = 12;

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
    // Re-solve the framing: the same board needs a different pull-back when
    // the canvas goes from desktop landscape to a phone's portrait sliver.
    this.refit();
  }

  /** Distance at which a halfW x halfH slab centred on the target just fits. */
  private fit(halfW: number, halfH: number): number {
    const vHalf = THREE.MathUtils.degToRad(FOV) / 2;
    const hHalf = Math.atan(Math.tan(vHalf) * this.aspect);
    return Math.max(halfH / Math.tan(vHalf), halfW / Math.tan(hHalf)) * PADDING;
  }

  private wholeBoardDistance(): number {
    const { width, height } = this.board;
    // Tilted away from the camera, the board's depth foreshortens by sin(elev);
    // the +0.6 is headroom for robot height and the board rim.
    return this.fit(width / 2, (height * Math.sin(ELEVATION)) / 2 + 0.6);
  }

  /** null = frame the whole board. */
  focus(pos: Position | null): void {
    const whole = this.wholeBoardDistance();
    if (!pos) {
      this.wanted.set(this.board.width / 2, 0, this.board.height / 2);
      this.wantedDistance = whole;
      return;
    }
    // Never "zoom in" past the whole-board framing — on a small board that
    // would push the camera backwards and read as a lurch.
    this.wantedDistance = Math.min(this.fit(FOCUS_RADIUS, FOCUS_RADIUS), whole);
    cellCentre(pos, this.wanted);
    // Keep the framing over the board rather than sliding off its corner.
    const margin = Math.min(FOCUS_RADIUS, this.board.width / 2);
    const marginZ = Math.min(FOCUS_RADIUS, this.board.height / 2);
    this.wanted.x = THREE.MathUtils.clamp(this.wanted.x, margin, this.board.width - margin);
    this.wanted.z = THREE.MathUtils.clamp(this.wanted.z, marginZ, this.board.height - marginZ);
  }

  /** Re-solve distance for the current framing without moving the target. */
  private refit(): void {
    const whole = this.wholeBoardDistance();
    const focused = Math.min(this.fit(FOCUS_RADIUS, FOCUS_RADIUS), whole);
    // Within a hair of the whole-board pull-back means we're in wide framing.
    this.wantedDistance = this.wantedDistance >= whole - 0.01 ? whole : focused;
  }

  private apply(): void {
    // Camera sits south of and above the target, looking north — so a robot
    // facing N (its modelled forward) points away from the viewer, exactly as
    // it reads on the DOM board.
    this.camera.position.set(
      this.target.x,
      this.target.y + Math.sin(ELEVATION) * this.distance,
      this.target.z + Math.cos(ELEVATION) * this.distance,
    );
    this.camera.lookAt(this.target);
  }

  /** Advance the ease. Returns true while the camera is still moving. */
  step(dt: number): boolean {
    const k = 1 - Math.exp(-dt / TAU);
    this.target.lerp(this.wanted, k);
    this.distance += (this.wantedDistance - this.distance) * k;
    const moving =
      this.target.distanceToSquared(this.wanted) > 1e-6 ||
      Math.abs(this.wantedDistance - this.distance) > 1e-3;
    if (!moving) this.snapValues();
    this.apply();
    return moving;
  }

  private snapValues(): void {
    this.target.copy(this.wanted);
    this.distance = this.wantedDistance;
  }

  snap(): void {
    this.snapValues();
    this.apply();
  }
}
