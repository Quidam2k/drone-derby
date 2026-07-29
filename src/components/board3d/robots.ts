// The four Blender chassis as meshes, and the rig that eases one around the
// board. Same models the sprites are rendered from — scripts/blender/robots.py
// `build(seat)` — exported by `npm run art -- --glb`.
//
// Static meshes only. Rolling treads, the hexapod walk cycle and spinning
// wheels are a later phase.
//
// Phase 3D-4 gives the rig a small presentation state machine — a fall, a
// respawn drop, a bump recoil — on top of the ease. Two rules keep it honest:
//
//  1. The VisualState reducer hides a robot on `robot-fell`/`robot-destroyed` in
//     the SAME update that delivers the event, so a death animation has to be
//     allowed to keep drawing through `setVisible(false)` and only honour the
//     hide when it finishes.
//  2. These animations are presentation only. The VisualState is always the
//     truth, so scene.ts force-finishes them the moment the next event arrives
//     (which is also what makes scrubbing backwards safe).

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Direction, Position } from '../../engine';
import { DIR_YAW } from './boardMesh';
import { clamp01, DIR_STEP, edgeFall, pitFall, vecToDir } from './effectMath';

export const SEATS = 4;

/** --player-0..3 from index.css, as hex. Shared with the beam colour. */
export const SEAT_COLORS = [0xf94144, 0xf9c74f, 0x43aa8b, 0x9d6bf2];

const modelUrl = (seat: number) => `/models/robot-${seat}.glb`;

/**
 * Each chassis is built from 30-60 separate Blender objects, which would be
 * 30-60 draw calls per robot. They only use seven materials between them, so
 * merging by material takes a four-robot board from ~200 draw calls to ~28.
 */
function mergeByMaterial(root: THREE.Object3D): THREE.Group {
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    // Merging needs identical attribute sets; UVs exist on some parts only.
    for (const attr of Object.keys(g.attributes)) {
      if (attr !== 'position' && attr !== 'normal') g.deleteAttribute(attr);
    }
    const list = byMaterial.get(material);
    if (list) list.push(g);
    else byMaterial.set(material, [g]);
  });

  const group = new THREE.Group();
  for (const [material, geoms] of byMaterial) {
    const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
    if (!merged) {
      // mergeGeometries returns null on mismatched attributes — keep the parts
      // rather than losing them.
      for (const g of geoms) group.add(new THREE.Mesh(g, material));
      continue;
    }
    if (merged !== geoms[0]) for (const g of geoms) g.dispose();
    group.add(new THREE.Mesh(merged, material));
  }
  group.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = false;
  });
  return group;
}

/** Loads all four chassis. A model that fails to load resolves to null. */
export async function loadChassis(): Promise<(THREE.Group | null)[]> {
  const loader = new GLTFLoader();
  return Promise.all(
    Array.from({ length: SEATS }, (_, seat) =>
      loader
        .loadAsync(modelUrl(seat))
        .then((gltf) => mergeByMaterial(gltf.scene))
        .catch((err) => {
          console.warn(`[board3d] chassis ${seat} failed to load`, err);
          return null;
        }),
    ),
  );
}

/** Fallback body so a failed .glb load still shows something on the board. */
function placeholder(seat: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.4, 0.7),
    new THREE.MeshStandardMaterial({ color: SEAT_COLORS[seat % 4], roughness: 0.5 }),
  );
  body.position.y = 0.2;
  body.castShadow = true;
  g.add(body);
  return g;
}

/** Seconds to cover ~63% of the remaining distance — tuned to the DOM board's
 *  `transition: transform 0.32s ease`. */
const TAU = 0.1;
const FLASH_SECONDS = 0.32;

// Fixed durations, sized to ReplayPlayer's eventDuration at 1x with a little
// headroom: robot-fell holds 750ms, robot-respawned 550ms, robot-blocked 450ms.
const PIT_SECONDS = 0.68;
const EDGE_SECONDS = 0.72;
const DROP_SECONDS = 0.42;
/** Tiles above its dock a respawning robot materialises. */
const DROP_HEIGHT = 1.7;
const RECOIL_SECONDS = 0.26;
/** Tiles the chassis rocks back off a wall. A few centimetres, not a bounce. */
const RECOIL_TILES = 0.11;

interface Death {
  cause: 'pit' | 'edge';
  t: number;
  life: number;
  /** Outward direction for an edge fall; zero for a pit. */
  dir: { x: number; z: number };
  base: THREE.Vector3;
}

/** One robot on the 3D board: eased position, shortest-path facing, hit flash. */
export class RobotRig {
  readonly object: THREE.Group;

  private readonly pos = new THREE.Vector3();
  private readonly wanted = new THREE.Vector3();
  /** Cumulative, so a W->N turn goes 90 degrees CW instead of 270 back. */
  private angle = 0;
  private wantedAngle = 0;
  private flash = 0;
  private readonly emissives: {
    material: THREE.MeshStandardMaterial;
    color: THREE.Color;
    intensity: number;
  }[] = [];
  /** Every cloned material, for the fade a fall needs. */
  private readonly fades: { material: THREE.Material; opacity: number; transparent: boolean }[] = [];

  private death: Death | null = null;
  /** Seconds into a respawn drop, or -1. */
  private dropT = -1;
  /** Seconds into a bump recoil, or -1. */
  private recoilT = -1;
  private readonly recoilDir = { x: 0, z: 0 };
  /** What the VisualState last said. A death animation overrides it until done. */
  private wantVisible = true;
  /** Powered down: lamps and thrusters off — the chassis reads as dead metal. */
  private poweredDown = false;
  /** Last non-zero step of `wanted`, for breaking edge-fall corner ties. */
  private travelX = 0;
  private travelZ = 0;
  private facing: Direction = 'N';
  private placed = false;

  constructor(chassis: THREE.Group | null, seat: number, ghost = false) {
    const source = chassis ?? placeholder(seat);
    this.object = source.clone(true);
    // Clone materials so a damage flash (or the ghost's transparency) touches
    // this robot only — Object3D.clone() shares material references.
    this.object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = (
        Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      ).clone() as THREE.MeshStandardMaterial;
      mesh.material = material;
      mesh.castShadow = !ghost;
      if (ghost) {
        material.transparent = true;
        material.opacity = 0.42;
        material.depthWrite = false;
      } else if (material.emissive) {
        this.emissives.push({
          material,
          color: material.emissive.clone(),
          intensity: material.emissiveIntensity,
        });
      }
      this.fades.push({
        material,
        opacity: material.opacity,
        transparent: material.transparent,
      });
    });
  }

  setTarget(pos: Position, facing: Direction): void {
    const x = pos.x + 0.5;
    const z = pos.y + 0.5;
    // Only a genuine change counts as travel; the first placement isn't a move.
    if (this.placed && (Math.abs(x - this.wanted.x) > 1e-6 || Math.abs(z - this.wanted.z) > 1e-6)) {
      this.travelX = x - this.wanted.x;
      this.travelZ = z - this.wanted.z;
    }
    this.placed = true;
    this.facing = facing;
    this.wanted.set(x, 0, z);
    const target = DIR_YAW[facing];
    let delta = (((target - this.angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    this.wantedAngle = this.angle + delta;
  }

  /**
   * The board direction this rig was last moving in, or null if it hasn't moved.
   * Only used to break an edge-fall corner tie, behind the facing — an edge fall
   * has no `robot-moved` before it, so travel may be a register stale.
   */
  travelDirection(): Direction | null {
    return vecToDir(this.travelX, this.travelZ);
  }

  /** Where the chassis is pointing. The better edge-fall corner tie-breaker. */
  facingDirection(): Direction {
    return this.facing;
  }

  /**
   * What the VisualState says. A running death animation keeps drawing through
   * a `false` — the reducer hides the robot on the same update that delivers
   * `robot-fell`, and the fall has to be allowed to play.
   */
  setVisible(visible: boolean): void {
    this.wantVisible = visible;
    this.object.visible = visible || this.death !== null;
  }

  /** Red pulse on a hit. Purely cosmetic; the state change is the event's. */
  hit(): void {
    this.flash = FLASH_SECONDS;
  }

  /**
   * All systems off while powered down: every self-lit part (lamps,
   * thrusters) goes dark. The damage flash still plays over it — a hit on a
   * sleeping robot should read — and its own restore respects this state.
   */
  setPoweredDown(down: boolean): void {
    if (down === this.poweredDown) return;
    this.poweredDown = down;
    if (this.flash > 0) return; // stepFlash's restore applies the new state
    for (const e of this.emissives) {
      e.material.emissiveIntensity = down ? 0 : e.intensity;
    }
  }

  /** Rock back off the wall it just hit. `dir` is the direction it tried to go. */
  recoil(dir: Direction, still = false): void {
    if (still) return;
    this.recoilDir.x = DIR_STEP[dir].x;
    this.recoilDir.z = DIR_STEP[dir].z;
    this.recoilT = 0;
  }

  /** Into the pit, or off the rim. `dir` is the outward direction for an edge. */
  fall(cause: 'pit' | 'edge', dir: Direction | null, still = false): void {
    this.dropT = -1;
    this.recoilT = -1;
    if (still) {
      // Reduced motion: skip straight to the end state, which for a fall is
      // simply gone. The caption and the player strip carry the information.
      this.finishDeath();
      return;
    }
    this.death = {
      cause,
      t: 0,
      life: cause === 'pit' ? PIT_SECONDS : EDGE_SECONDS,
      dir: dir ? { ...DIR_STEP[dir] } : { x: 0, z: 0 },
      // From the cell it fell INTO, not from wherever the move's ease had got
      // to: `robot-fell` follows a `robot-moved` whose ease may still be running,
      // and a pit swallows you at the cell, not halfway there.
      base: this.wanted.clone(),
    };
    this.object.visible = true;
  }

  /**
   * Blown up. The blast effect covers the disappearance, so the chassis goes on
   * the first frame rather than animating — this only makes sure no half-played
   * fall is left holding it on screen.
   */
  explode(): void {
    this.finishDeath();
  }

  /**
   * Respawn: teleport to the dock at height and drop in. A teleport, not an
   * ease — otherwise the corpse slides across the board to its dock.
   */
  respawnAt(pos: Position, facing: Direction, still = false): void {
    this.death = null;
    this.recoilT = -1;
    this.setOpacity(1);
    this.setTarget(pos, facing);
    this.pos.copy(this.wanted);
    this.angle = this.wantedAngle;
    this.travelX = 0;
    this.travelZ = 0;
    this.dropT = still ? -1 : 0;
    this.object.visible = this.wantVisible;
    this.applyTransform();
  }

  /**
   * Force-finish whatever is running. Called when the next event arrives, which
   * is both how the fixed durations stay inside the replay clock's budget and
   * how a backwards scrub can never leave a rig invisible or mid-air.
   */
  finishAnim(): void {
    if (this.death) this.finishDeath();
    this.dropT = -1;
    this.recoilT = -1;
    this.applyTransform();
  }

  /** Advance the ease. Returns true while still moving. */
  step(dt: number): boolean {
    let moving = this.stepFlash(dt);

    if (this.death) {
      // The trajectory owns the transform outright while a fall is playing.
      return this.stepDeath(dt) || moving;
    }

    const k = 1 - Math.exp(-dt / TAU);
    this.pos.lerp(this.wanted, k);
    this.angle += (this.wantedAngle - this.angle) * k;

    if (
      this.pos.distanceToSquared(this.wanted) > 1e-6 ||
      Math.abs(this.wantedAngle - this.angle) > 1e-3
    ) {
      moving = true;
    } else {
      this.pos.copy(this.wanted);
      this.angle = this.wantedAngle;
    }

    if (this.dropT >= 0) {
      this.dropT += dt;
      if (this.dropT >= DROP_SECONDS) this.dropT = -1;
      moving = true;
    }
    if (this.recoilT >= 0) {
      this.recoilT += dt;
      if (this.recoilT >= RECOIL_SECONDS) this.recoilT = -1;
      moving = true;
    }

    this.applyTransform();
    return moving;
  }

  /** The damage pulse, which has to keep decaying through a fall. */
  private stepFlash(dt: number): boolean {
    if (this.flash <= 0) return false;
    this.flash = Math.max(0, this.flash - dt);
    const t = this.flash / FLASH_SECONDS;
    for (const e of this.emissives) {
      if (this.flash === 0) {
        // Restore the colour too: several chassis parts are lamps and
        // thrusters that emit on their own (unless the robot is powered down).
        e.material.emissive.copy(e.color);
        e.material.emissiveIntensity = this.poweredDown ? 0 : e.intensity;
      } else {
        e.material.emissive.setHex(0xff2b2b);
        e.material.emissiveIntensity = 0.15 + t * 1.6;
      }
    }
    return true;
  }

  private stepDeath(dt: number): boolean {
    const d = this.death;
    if (!d) return false;
    d.t += dt;
    const u = clamp01(d.life > 0 ? d.t / d.life : 1);
    const pose = d.cause === 'pit' ? pitFall(u) : edgeFall(u);
    this.object.position.set(
      d.base.x + d.dir.x * pose.out,
      pose.y,
      d.base.z + d.dir.z * pose.out,
    );
    this.object.rotation.set(pose.tilt, this.angle + pose.spin, 0);
    this.setOpacity(pose.opacity);
    if (u >= 1) {
      this.finishDeath();
      return false;
    }
    return true;
  }

  private finishDeath(): void {
    this.death = null;
    this.setOpacity(1);
    // Back to the cell the VisualState says it is on — which, for a robot that
    // is about to respawn, is where the reducer will move it anyway.
    this.snap();
    this.object.visible = this.wantVisible;
  }

  /** Fade the whole chassis. `transparent` toggles do not recompile a shader. */
  private setOpacity(o: number): void {
    const solid = o >= 1;
    for (const f of this.fades) {
      f.material.transparent = solid ? f.transparent : true;
      f.material.opacity = solid ? f.opacity : f.opacity * o;
    }
  }

  private applyTransform(): void {
    this.object.position.copy(this.pos);
    if (this.dropT >= 0) {
      // Accelerating downward: still at the top, fastest at touchdown.
      const u = clamp01(this.dropT / DROP_SECONDS);
      this.object.position.y += DROP_HEIGHT * (1 - u * u);
    }
    if (this.recoilT >= 0) {
      // Back off the wall and settle again, so it reads as a bounce rather than
      // a teleport into the neighbouring cell.
      const k = Math.sin(Math.PI * clamp01(this.recoilT / RECOIL_SECONDS)) * RECOIL_TILES;
      this.object.position.x -= this.recoilDir.x * k;
      this.object.position.z -= this.recoilDir.z * k;
    }
    this.object.rotation.set(0, this.angle, 0);
  }

  /**
   * Where this rig actually is, in board cells. Fractional mid-ease. `height` is
   * in tiles above the deck — 0 unless a fall or a respawn drop is playing,
   * which is what makes "no robot is left airborne after a scrub" checkable.
   */
  cell(): { x: number; y: number; height: number; visible: boolean } {
    return {
      x: this.object.position.x - 0.5,
      y: this.object.position.z - 0.5,
      height: this.object.position.y,
      visible: this.object.visible,
    };
  }

  snap(): void {
    this.pos.copy(this.wanted);
    this.angle = this.wantedAngle;
    this.dropT = -1;
    this.recoilT = -1;
    this.applyTransform();
  }

  dispose(): void {
    this.object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of material) m.dispose();
    });
  }
}
