// The four Blender chassis as meshes, and the rig that eases one around the
// board. Same models the sprites are rendered from — scripts/blender/robots.py
// `build(seat)` — exported by `npm run art -- --glb`.
//
// Phase 47 makes the chassis MOVE — rolling treads, an alternating tripod
// gait, spinning wheels, a hovercraft bob. Three rules keep that honest:
//
//  * The motion is derived from the rig's own eased position, never from a
//    clock, so it stops when the robot settles and ./scene.ts's on-demand
//    render loop can still go to sleep. See ./robotAnim.ts.
//  * The moving parts are named in Blender (`anim_*` empties) and pulled out of
//    the by-material merge below, at ~3-4 extra draw calls per robot. A .glb
//    without them merges exactly as it always did and the robot is static —
//    a broken model costs you the animation, never the board.
//  * `setStill` (prefers-reduced-motion) parks every part at its rest pose.
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
import {
  gait,
  gaitPhase,
  hoverPose,
  motionEnvelope,
  thrustGlow,
  treadOffset,
  wheelSpin,
} from './robotAnim';

export const SEATS = 4;

/** --player-0..3 from index.css, as hex. Shared with the beam colour. */
export const SEAT_COLORS = [0xf94144, 0xf9c74f, 0x43aa8b, 0x9d6bf2];

/**
 * Node names in the .glb that the rig animates, each written by an
 * `anim_group(...)` call in scripts/blender/robots.py. Nothing links the two
 * lists, and drift in either direction is silent — so ./robotAnim.parity.test.ts
 * reads the Python and asserts they agree.
 *
 * The hovercraft is deliberately absent: its bob IS the whole body, so it needs
 * no sub-part at all.
 */
export const ANIM_PARTS = [
  'anim_tread_l',
  'anim_tread_r',
  'anim_tripod_a',
  'anim_tripod_b',
  'anim_wheel_0',
  'anim_wheel_1',
  'anim_wheel_2',
  'anim_wheel_3',
] as const;

const ANIM_PREFIX = 'anim_';

const modelUrl = (seat: number) => `/models/robot-${seat}.glb`;

/** The nearest `anim_*` ancestor of a node, or null if it is static geometry. */
function animOwner(o: THREE.Object3D): THREE.Object3D | null {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (n.name.startsWith(ANIM_PREFIX)) return n;
  }
  return null;
}

/** Collapse one bucket of same-material geometries into as few meshes as possible. */
function emitMerged(target: THREE.Object3D, byMaterial: Map<THREE.Material, THREE.BufferGeometry[]>): void {
  for (const [material, geoms] of byMaterial) {
    const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
    if (!merged) {
      // mergeGeometries returns null on mismatched attributes — keep the parts
      // rather than losing them.
      for (const g of geoms) target.add(new THREE.Mesh(g, material));
      continue;
    }
    if (merged !== geoms[0]) for (const g of geoms) g.dispose();
    target.add(new THREE.Mesh(merged, material));
  }
}

/**
 * Each chassis is built from 30-60 separate Blender objects, which would be
 * 30-60 draw calls per robot. They only use seven materials between them, so
 * merging by material takes a four-robot board from ~200 draw calls to ~28.
 *
 * Anything under an `anim_*` empty is held back from that merge and gets its
 * own group instead, since a part the rig has to move independently cannot
 * share a buffer with the hull. It is still merged by material WITHIN the part,
 * so a wheel's 12 objects are 2 draw calls and a chassis pays ~3-4 over the
 * static case, not 30.
 *
 * Each part's geometry is baked into a frame whose ORIGIN is the empty's pivot
 * but whose AXES are the chassis's, which is what makes ./robotAnim's numbers
 * directly usable: -Z is where the robot is pointing, +Y is up, and a wheel
 * spins about local X.
 */
function mergeByMaterial(root: THREE.Object3D): THREE.Group {
  /** Keyed by owning `anim_*` node; `null` is the static chassis. */
  const buckets = new Map<THREE.Object3D | null, Map<THREE.Material, THREE.BufferGeometry[]>>();
  const pivot = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const owner = animOwner(mesh);
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (owner) {
      pivot.setFromMatrixPosition(owner.matrixWorld);
      g.translate(-pivot.x, -pivot.y, -pivot.z);
    }
    // Merging needs identical attribute sets; UVs exist on some parts only.
    for (const attr of Object.keys(g.attributes)) {
      if (attr !== 'position' && attr !== 'normal') g.deleteAttribute(attr);
    }
    let bucket = buckets.get(owner);
    if (!bucket) buckets.set(owner, (bucket = new Map()));
    const list = bucket.get(material);
    if (list) list.push(g);
    else bucket.set(material, [g]);
  });

  const group = new THREE.Group();
  for (const [owner, byMaterial] of buckets) {
    if (!owner) {
      emitMerged(group, byMaterial);
      continue;
    }
    const part = new THREE.Group();
    part.name = owner.name;
    part.position.setFromMatrixPosition(owner.matrixWorld);
    emitMerged(part, byMaterial);
    group.add(part);
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

// ---------------------------------------------------------------- animation
// Every number here is a measurement off the Blender model, so a change in
// robots.py has to be mirrored here or the motion stops matching the mesh.
/** Gap between the tracked chassis's tread ribs. */
const TREAD_SPACING = 0.067;
/** Tiles a hexapod foot reaches either side of its rest pose. */
const GAIT_STRIDE = 0.085;
/** Tiles a swinging tripod clears the deck by. */
const GAIT_LIFT = 0.07;
/** The buggy's modelled tyre radius. */
const WHEEL_RADIUS = 0.175;
/** Seconds for the smoothed travel speed to cover ~63% of a change. */
const SPEED_TAU = 0.08;
/**
 * Tiles/second below which the robot counts as stopped and the smoothed speed
 * is snapped to exactly zero.
 *
 * Load-bearing, not a tidiness threshold: an exponential decay never reaches 0
 * on its own, and a speed that stays a hair above it would keep every rig
 * reporting `moving` — and scene.ts's on-demand render loop awake — forever.
 * At 0.01 tiles/s the tail is ~0.4s and nothing on screen is moving.
 */
const SPEED_EPS = 0.01;

/** One `anim_*` group from the .glb, with the pose the model was built in. */
interface AnimPart {
  node: THREE.Object3D;
  rest: THREE.Vector3;
}

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

  /**
   * The chassis, inside `object`. The wrapper exists purely so the hovercraft
   * has somewhere to bob: `cell()` reports `object.position.y` as height above
   * the deck and Playwright asserts no robot is left airborne, so body-local
   * motion must not touch it. Everything else — the death trajectory, the
   * respawn drop, opacity, visibility, dispose — still owns `object`.
   */
  private readonly body: THREE.Group;
  private readonly treads: AnimPart[] = [];
  /** Each tripod with its offset into the gait cycle: 0 and pi. */
  private readonly tripods: { part: AnimPart; phase: number }[] = [];
  private readonly wheels: AnimPart[] = [];
  /** The nozzle materials, by their Blender name, for the speed pulse. */
  private readonly thrusters: { material: THREE.MeshStandardMaterial; intensity: number }[] = [];
  /**
   * A chassis with thrusters and no named moving parts is the hovercraft, whose
   * animation IS the whole body — which is exactly why it has no parts.
   * Derived rather than keyed off the seat, so a placeholder box (or a .glb
   * that failed to load) simply never bobs.
   */
  private readonly hovers: boolean;
  /** Signed tiles travelled along the chassis's own facing. The anim clock. */
  private dist = 0;
  /** Smoothed travel speed, tiles/second. Exactly 0 once settled. */
  private speed = 0;
  /** Seconds of wall clock, advanced only while actually moving. */
  private animT = 0;
  /** Reduced motion: every part parked at its rest pose. */
  private still = false;

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
    this.object = new THREE.Group();
    this.body = source.clone(true);
    this.object.add(this.body);
    // Clone materials so a damage flash (or the ghost's transparency) touches
    // this robot only — Object3D.clone() shares material references.
    this.body.traverse((o) => {
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
        // Named in Blender (`Mats.THRUST`) and carried through the glTF, so the
        // pulse can pick the nozzles out of the seven materials without a
        // second list to keep in step.
        if (material.name === 'thrust') {
          this.thrusters.push({ material, intensity: material.emissiveIntensity });
        }
      }
      this.fades.push({
        material,
        opacity: material.opacity,
        transparent: material.transparent,
      });
    });

    // The moving parts, if this .glb has them. A name that isn't there just
    // leaves its list empty and that part of the chassis stays static.
    for (const name of ANIM_PARTS) {
      const node = this.body.getObjectByName(name);
      if (!node) continue;
      const part: AnimPart = { node, rest: node.position.clone() };
      if (name.startsWith('anim_tread')) this.treads.push(part);
      else if (name.startsWith('anim_tripod')) {
        // Half a cycle apart — that IS the alternating tripod gait.
        this.tripods.push({ part, phase: name.endsWith('_b') ? Math.PI : 0 });
      } else if (name.startsWith('anim_wheel')) this.wheels.push(part);
    }
    this.hovers =
      this.thrusters.length > 0 &&
      this.treads.length === 0 &&
      this.tripods.length === 0 &&
      this.wheels.length === 0;
  }

  /**
   * Reduced motion: park every moving part at the pose it was modelled in and
   * stop deriving new ones. Mirrors `setPoweredDown` — scene.ts calls both from
   * `update()` — and is idempotent, so it is safe on every frame's input.
   */
  setStill(still: boolean): void {
    if (still === this.still) return;
    this.still = still;
    if (still) this.restPose();
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
   * Which `anim_*` groups this rig actually found in its .glb, and how many
   * meshes each one costs.
   *
   * A verification hook, for the same reason `cell()` is one: a part that
   * didn't resolve is INVISIBLE as a bug — the robot just goes back to being
   * the static model it was before Phase 47, with no warning anywhere. And
   * since every part held out of the by-material merge is a draw call, the mesh
   * count is the merge budget, measurable from Playwright rather than guessed.
   */
  animParts(): { name: string; meshes: number }[] {
    const parts = [
      ...this.treads,
      ...this.tripods.map((t) => t.part),
      ...this.wheels,
    ];
    return parts.map((p) => ({
      name: p.node.name,
      meshes: p.node.children.length,
    }));
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
    this.speed = 0;
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

    const fromX = this.pos.x;
    const fromZ = this.pos.z;
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
    // After applyTransform: the hovercraft's bob writes body-local values that
    // the transform above would otherwise clear.
    return this.stepAnim(dt, this.pos.x - fromX, this.pos.z - fromZ) || moving;
  }

  /**
   * Drive the moving parts off this frame's displacement of the ease.
   *
   * Returns true while anything is still animating. That has to become false
   * shortly after the ease settles or scene.ts's render loop never sleeps —
   * which is why the speed is snapped to zero at SPEED_EPS and why the treads,
   * legs and wheels are functions of DISTANCE: with the chassis stopped, the
   * distance stops, and their pose is simply constant.
   */
  private stepAnim(dt: number, dx: number, dz: number): boolean {
    if (this.still) return false;

    // Signed along the chassis's own facing, so reversing scrolls the treads
    // and spins the wheels backwards. A model at yaw 0 faces -Z (DIR_YAW.N is
    // 0) because Blender's +Y is three.js's -Z.
    this.dist += dx * -Math.sin(this.angle) + dz * -Math.cos(this.angle);

    // Smoothed, with its own decay, so the speed-driven flourishes fade out
    // instead of popping off on the frame the ease happens to finish.
    const target = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    this.speed += (target - this.speed) * (1 - Math.exp(-dt / SPEED_TAU));
    if (this.speed < SPEED_EPS) this.speed = 0;
    else this.animT += dt;

    if (this.treads.length) {
      const off = treadOffset(this.dist, TREAD_SPACING);
      for (const t of this.treads) t.node.position.set(t.rest.x, t.rest.y, t.rest.z - off);
    }
    if (this.tripods.length) {
      const phase = gaitPhase(this.dist, GAIT_STRIDE);
      // Scaled by speed so the legs settle back into the pose they were
      // sculpted in rather than freezing mid-stride when the robot stops.
      const env = motionEnvelope(this.speed);
      for (const t of this.tripods) {
        const g = gait(phase + t.phase, GAIT_STRIDE, GAIT_LIFT);
        t.part.node.position.set(
          t.part.rest.x,
          t.part.rest.y + g.lift * env,
          t.part.rest.z - g.forward * env,
        );
      }
    }
    if (this.wheels.length) {
      // Negative: rotating about +X swings the top of a wheel toward +Z, and
      // forward is -Z.
      const angle = -wheelSpin(this.dist, WHEEL_RADIUS);
      for (const w of this.wheels) w.node.rotation.x = angle;
    }
    if (this.hovers) {
      const pose = hoverPose(this.speed, this.animT);
      this.body.position.y = pose.bob;
      this.body.rotation.x = pose.pitch;
    }
    // stepFlash owns emissiveIntensity while a hit is playing, and a sleeping
    // robot's thrusters stay dark whatever it is doing.
    if (this.flash <= 0 && !this.poweredDown) {
      for (const t of this.thrusters) {
        t.material.emissiveIntensity = thrustGlow(this.speed, this.animT, t.intensity);
      }
    }
    return this.speed > 0;
  }

  /** Every moving part back to the pose the .glb was built in. */
  private restPose(): void {
    for (const t of this.treads) t.node.position.copy(t.rest);
    for (const t of this.tripods) t.part.node.position.copy(t.part.rest);
    for (const w of this.wheels) {
      w.node.position.copy(w.rest);
      w.node.rotation.x = 0;
    }
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    if (this.flash <= 0) {
      for (const t of this.thrusters) {
        t.material.emissiveIntensity = this.poweredDown ? 0 : t.intensity;
      }
    }
    this.speed = 0;
    this.animT = 0;
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
    // The fall bypasses stepAnim entirely, so the speed it was carrying when it
    // went over would otherwise still be there when it comes back.
    this.speed = 0;
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
