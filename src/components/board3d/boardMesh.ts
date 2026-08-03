// BoardDef -> three.js geometry.
//
// Everything is instanced and shares a handful of materials, so a 12x17
// composed board is ~15 draw calls regardless of how many belts it has.
//
// Geometry comes from the Blender tile kit (3D-3, `tileKit.ts`) when it
// loaded, and from the primitives below when it didn't — piece by piece, the
// way `placeholder()` backs the robot chassis. The primitives are the low-end
// path, not dead code: keep them working.
//
// The `C` palette is lifted from index.css custom properties. It still drives
// the fallback in full, and in the kit path it drives everything whose colour
// is a game rule rather than art — belt speed class, checkpoint, laser.

import * as THREE from 'three';
import type { BoardDef, Direction, Position, TileDef } from '../../engine';
import { rotate } from '../../engine';
import type { KitPiece, TileKit } from './tileKit';

/** index.css custom properties, as hex. Keep in sync with :root there. */
const C = {
  panel: 0x1f2230, //  --panel      floor
  conveyorFloor: 0x262c3d, //  .tile-conveyor
  base: 0x171a26, //  tile body under the cap (reads as grout)
  line: 0x363b52, //  --line       board rim, spawn frame
  wall: 0xe8b830, //  --wall
  accent: 0x4cc9f0, //  --accent     express belts
  belt: 0x8ea0c9, //  ConveyorSprite normal chevrons
  danger: 0xf25c54, //  --danger     laser emitters
  checkpoint: 0x43aa8b, //  CheckpointSprite
  checkpointLit: 0x6fe3bd,
  gear: 0xc88f3c, //  GearSprite
  gearDark: 0x8a5f22,
  pit: 0x04050a, //  PitSprite core
  dim: 0x9aa0b8, //  --text-dim   spawn pips
};

/** Tile thickness. Deep enough that a pit reads as a shaft, not a dark decal. */
const SLAB = 0.5;

/** Portal pair colors, matching PORTAL_FILL in board/sprites.tsx. */
const PORTAL_HEX: Record<string, number> = {
  red: 0xe05555,
  blue: 0x57a7e8,
  green: 0x58c470,
  purple: 0xa06ae0,
  orange: 0xe09a4a,
};

const DIR_VEC: Record<Direction, THREE.Vector3> = {
  N: new THREE.Vector3(0, 0, -1),
  E: new THREE.Vector3(1, 0, 0),
  S: new THREE.Vector3(0, 0, 1),
  W: new THREE.Vector3(-1, 0, 0),
};

/** Yaw that turns a north-facing mesh to `dir`. Shared with the robot rigs. */
export const DIR_YAW: Record<Direction, number> = {
  N: 0,
  E: -Math.PI / 2,
  S: Math.PI,
  W: Math.PI / 2,
};

/** Height of a board emitter's barrel and lens above the deck. */
const LASER_Y = 0.16;
/**
 * Where the barrel sits relative to its cell's centre, along the facing. The
 * emitter is mounted on the wall BEHIND its beam, matching the DOM emitter
 * sprite: an emitter facing E sits on its cell's west edge.
 */
const BARREL_ALONG = -0.38;
/** The lens, forward of the barrel's back plate. */
const LENS_ALONG = BARREL_ALONG + 0.19;

/**
 * World position of a board emitter's lens — the ONE definition of where a
 * board laser's beam starts. `buildBoard` places the modelled `laser_lens` here
 * and scene.ts starts the beam here, so the beam cannot drift off the muzzle.
 */
export function laserMuzzle(l: { pos: Position; facing: Direction }): THREE.Vector3 {
  return new THREE.Vector3(l.pos.x + 0.5, LASER_Y, l.pos.y + 0.5).addScaledVector(
    DIR_VEC[l.facing],
    LENS_ALONG,
  );
}

interface Placement {
  pos: THREE.Vector3;
  yaw?: number;
  scale?: THREE.Vector3 | number;
  color?: number;
}

/** Collects placements, then bakes them into one InstancedMesh. */
class Batch {
  private readonly items: Placement[] = [];

  add(p: Placement): void {
    this.items.push(p);
  }

  get count(): number {
    return this.items.length;
  }

  build(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    opts: { cast?: boolean; receive?: boolean } = {},
  ): THREE.InstancedMesh | null {
    if (!this.items.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, this.items.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const color = new THREE.Color();
    let tinted = false;
    this.items.forEach((it, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.yaw ?? 0);
      if (typeof it.scale === 'number') s.setScalar(it.scale);
      else s.copy(it.scale ?? new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, m.compose(it.pos, q, s));
      if (it.color !== undefined) {
        mesh.setColorAt(i, color.setHex(it.color));
        tinted = true;
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (tinted && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = !!opts.cast;
    mesh.receiveShadow = !!opts.receive;
    mesh.frustumCulled = false;
    return mesh;
  }
}

/** Text drawn to an offscreen canvas: checkpoint/spawn digits, register
 * schedules on trap-doors/crushers/flamers. Wider than tall for schedules. */
function labelTexture(text: string, color: string): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    const px = text.length > 2 ? size * 0.34 : size * 0.72;
    ctx.font = `700 ${px}px 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size * 0.54);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A flat chevron band pointing north, lying in the XZ plane. */
function chevronGeometry(): THREE.BufferGeometry {
  const w = 0.3;
  const h = 0.17;
  const t = 0.1;
  const shape = new THREE.Shape();
  shape.moveTo(-w, 0);
  shape.lineTo(0, h);
  shape.lineTo(w, 0);
  shape.lineTo(w, -t);
  shape.lineTo(0, h - t);
  shape.lineTo(-w, -t);
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
  // Shape +Y -> world -Z (north); extrude depth -> world +Y (up).
  geom.rotateX(-Math.PI / 2);
  return geom;
}

/** One scrolling chevron: everything tick() needs to re-place it each frame. */
interface Chevron {
  /** `x,y` of the cell this chevron belongs to, so a carry can find it. */
  cell: string;
  centre: THREE.Vector3;
  dir: THREE.Vector3;
  yaw: number;
  /**
   * Extra tiles of travel this chevron has been surged by, on top of the
   * ambient scroll. Cumulative and never reset: a belt that hurried has
   * MOVED, and winding the phase back would read as a stutter.
   */
  surge: number;
  /** Position within the tile at phase 0, in [0, 1). */
  offset: number;
  /** Tiles per second. Matches the DOM belt animation's px/s at a 52px tile. */
  speed: number;
  /**
   * Second leg, for curved belts: the first half of the cycle rides `dir`
   * (the entry travel axis) from the entry edge to the tile centre, the
   * second half rides `dir2` (the exit axis) out, yaw switching at the
   * midpoint. Unset on straight belts.
   */
  dir2?: THREE.Vector3;
  yaw2?: number;
}

/** Height of the flame cone over a flamer, and half its own height. */
const FLAME_BASE_Y = 0.09;
const FLAME_HALF = 0.21;
/**
 * How far a pusher's piston throws past its resting pose, and how far a
 * crusher's head descends, both in world units. These are GEOMETRY, so they
 * live here rather than in elementAnim.ts — that module hands over a 0..1
 * fraction of a full throw and does not know how big a full throw is.
 * The plate rests 0.28 in front of its housing, so a 0.5 throw stops it well
 * inside its own cell; the press hangs at 0.5 and stops at 0.2, below the top
 * of the 0.52 posts it runs between.
 */
const PUSHER_THROW = 0.5;
const CRUSHER_DROP = 0.3;
/** Radians a second a portal's ring turns, and how fast its core breathes. */
const PORTAL_SPIN = 0.9;
const PORTAL_PULSE_HZ = 0.55;

export interface BoardMeshes {
  group: THREE.Group;
  /**
   * True when something on this board animates on its own — scrolling belts,
   * and since Phase 48 a portal's idle swirl.
   *
   * This is what keeps ./scene.ts's render loop awake, so adding portals to it
   * means A BOARD WITH PORTALS NEVER SLEEPS, exactly as a board with belts
   * never sleeps. That is the deliberate, consistent choice: every builtin
   * board already carries 4-52 belts, so in practice nothing changes for any of
   * them, and the only board it costs is a hand-built portal-only one from the
   * editor. The alternative considered and rejected was a CONDITIONAL swirl
   * ("animate only while something else already is"), which would make the same
   * portal look different depending on what else happened to be on its board.
   */
  animated: boolean;
  tick(elapsed: number): void;
  /**
   * Scale the modelled flame on the flamer at (x, y); 1 is its resting size.
   * False when there is no flamer there, so scene.ts can fire blind off a
   * `damage` event without knowing what hurt the robot.
   *
   * The flame's ROOT stays on the nozzle whatever the scale — the cone's origin
   * is its own centre, so a naive uniform scale would push half the growth
   * through the deck.
   */
  flameAt(x: number, y: number, scale: number): boolean;
  /**
   * Pose a board element that is performing its own action. Each returns false
   * when that cell carries no such element, which is what lets scene.ts fire
   * blind off an event — the same contract `flameAt` already has ("the mesh
   * confirming there is a flamer there is the check"). `gear-rotated` needs it
   * most: that event carries no position at all, so the cell is the robot's
   * and a false here IS the confirmation that a gear was really what turned.
   *
   * NOTE none of these touch `animated`. They are event-driven and they settle,
   * so they must never flip a board into always-on rendering — see the header
   * of ./elementAnim.ts for why that would be a defect rather than a cost.
   */
  pusherAt(x: number, y: number, extend: number): boolean;
  /** `angle` is cumulative radians; negative is clockwise, as DIR_YAW is. */
  gearAt(x: number, y: number, angle: number): boolean;
  crusherAt(x: number, y: number, press: number): boolean;
  /** `extra` is cumulative extra tiles of travel, applied on the next tick. */
  beltSurgeAt(x: number, y: number, extra: number): boolean;
  /**
   * The checkpoint ring drawn on a cell: its geometry (whichever of the kit
   * piece or the primitive won) and the exact matrix it was instanced with, so
   * the claimed-checkpoint pop can flare THAT ring rather than a guess at where
   * it is. Null for a cell with no checkpoint.
   */
  checkpointRing(x: number, y: number): { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 } | null;
  dispose(): void;
}

export function buildBoard(board: BoardDef, kit?: TileKit | null): BoardMeshes {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  function geom<T extends THREE.BufferGeometry>(g: T): T {
    geometries.push(g);
    return g;
  }
  function mat<T extends THREE.Material>(m: T): T {
    materials.push(m);
    return m;
  }
  function add(mesh: THREE.Object3D | null): void {
    if (mesh) group.add(mesh);
  }

  /**
   * The kit piece's geometry, or the primitive it stands in for. The fallback
   * is a thunk so a loaded kit doesn't build — and then have to dispose —
   * geometry nothing ever draws.
   */
  function pieceGeom(piece: KitPiece | null | undefined, fallback: () => THREE.BufferGeometry) {
    return piece?.geometry ?? geom(fallback());
  }

  const centre = (x: number, y: number, h = 0) => new THREE.Vector3(x + 0.5, h, y + 0.5);

  // ---------------------------------------------------------------- batches
  const bodies = new Batch();
  // Two deck batches, not one tinted batch: a modelled belt bed is different
  // geometry from a floor plate, and it has to face the way the belt runs.
  const floorDecks = new Batch();
  const beltDecks = new Batch();
  // Curved belt beds are a third piece: one CW-frame model (exit N, entry
  // edge E), yawed so entry/exit line up; CCW reuses it with the exit edge
  // taking the model's E slot — the bed carries no direction of its own.
  const curveDecks = new Batch();
  const pitFloors = new Batch();
  const pitRims = new Batch();
  const chevrons: Chevron[] = [];
  const gearDiscs = new Batch();
  const gearTeeth = new Batch();
  const gearArrows = new Batch();
  /**
   * Cell key -> the instance handles a gear's own wheel occupies, so a
   * `gear-rotated` event can turn THAT gear. The arrows are deliberately NOT
   * in here: they are a signpost saying which way this gear turns, not part
   * of the wheel, and a rotating signpost stops being readable.
   */
  const gearIndex = new Map<
    string,
    { disc: number; teethStart: number; teeth: number; centre: THREE.Vector3 }
  >();
  const rings = new Batch();
  /** Cell key -> its instance index in the checkpoint ring batch. */
  const ringIndex = new Map<string, number>();
  const spawns = new Batch();
  const wrenches = new Batch();
  // Fallback-only wrench glyph bars (the kit's hatch models the tool itself).
  const wrenchGlyphs = new Batch();
  const labels: THREE.Mesh[] = [];
  const walls = new Batch();
  const emitterBodies = new Batch();
  const emitterLenses = new Batch();
  const pusherHousings = new Batch();
  // Two plate batches so each register variant keeps its own tint.
  const pusherPlatesOdd = new Batch();
  const pusherPlatesEven = new Batch();
  /**
   * Cell key -> which plate batch this pusher's piston landed in, its index
   * there, and the resting pose it throws out from. `odd` picks the mesh
   * because the two register variants are separate instanced meshes.
   */
  const pusherIndex = new Map<
    string,
    { odd: boolean; index: number; rest: THREE.Vector3; yaw: number; dir: THREE.Vector3 }
  >();
  // Expansion elements (Phase 38). All primitives — the Blender kit pieces
  // are deferred, and the primitive fallback is the designed contract.
  const drainBars = new Batch();
  const trapdoorPlates = new Batch();
  const radiationDiscs = new Batch();
  const wastePatches = new Batch();
  const portalRings = new Batch(); // per-instance tint = pair color
  const portalCores = new Batch();
  const teleporterRings = new Batch();
  const teleporterCores = new Batch();
  const repulsorBodies = new Batch();
  const repulsorCores = new Batch();
  const oneWayReds = new Batch();
  const oneWayGreens = new Batch();
  const crusherPosts = new Batch();
  const crusherPlates = new Batch();
  /** Cell key -> the press head's instance index and the height it hangs at. */
  const crusherIndex = new Map<string, { index: number; rest: THREE.Vector3 }>();
  const flamerNozzles = new Batch();
  const flamerFlames = new Batch();
  /** Portal cells in batch order, so tick() can find each ring/core instance. */
  const portalCells: Position[] = [];
  /** Cell key -> its instance index in the flame batch. */
  const flameIndex = new Map<string, number>();

  /**
   * The checkpoint/spawn number, as a digit lying on the tile. Pips were the
   * first attempt and read as a face, not a number — the DOM board draws the
   * actual digit and the 3D board has to be as legible.
   */
  function addLabel(
    x: number,
    y: number,
    text: string | number,
    color: string,
    size: number,
    height = 0.045,
  ) {
    const mesh = new THREE.Mesh(
      geom(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2)),
      mat(
        new THREE.MeshBasicMaterial({
          map: labelTexture(String(text), color),
          transparent: true,
          depthWrite: false,
        }),
      ),
    );
    mesh.position.set(x + 0.5, height, y + 0.5);
    labels.push(mesh);
  }

  function addTile(def: TileDef, x: number, y: number) {
    if (def.kind === 'pit') {
      pitFloors.add({ pos: centre(x, y, -SLAB - 0.12) });
      pitRims.add({ pos: centre(x, y, -0.02) });
      // A drain is a pit wearing a grate. The kit's grate is the whole
      // opening in one piece; the primitive is a single bar, so it takes five
      // placements — chord-scaled, because the primitive rim is a torus.
      if (def.style === 'drain') {
        if (kit?.drain_grate) drainBars.add({ pos: new THREE.Vector3(x + 0.5, -0.01, y + 0.5) });
        else {
          for (const off of [-0.28, -0.14, 0, 0.14, 0.28]) {
            drainBars.add({
              pos: new THREE.Vector3(x + 0.5, -0.01, y + 0.5 + off),
              scale: new THREE.Vector3(Math.sqrt(1 - (off / 0.44) ** 2), 1, 1),
            });
          }
        }
      }
      return;
    }
    bodies.add({ pos: centre(x, y, -SLAB / 2) });
    if (def.kind === 'conveyor' && def.curve) {
      curveDecks.add({
        pos: centre(x, y, -0.015),
        yaw: DIR_YAW[def.curve === 'cw' ? def.dir : rotate(def.dir, -1)],
      });
    } else if (def.kind === 'conveyor') {
      beltDecks.add({ pos: centre(x, y, -0.015), yaw: DIR_YAW[def.dir] });
    } else floorDecks.add({ pos: centre(x, y, -0.015) });

    switch (def.kind) {
      case 'conveyor': {
        const k = def.express ? 3 : 2;
        // 13px per 1.8s (normal) / 12px per 0.9s (express) at a 52px tile.
        const speed = def.express ? 0.256 : 0.139;
        // On a curve the chevron rides in along the entry axis, out along the
        // exit axis (see Chevron.dir2); a straight belt is one leg end to end.
        const entry = def.curve ? rotate(def.dir, def.curve === 'cw' ? -1 : 1) : def.dir;
        for (let i = 0; i < k; i++) {
          chevrons.push({
            cell: `${x},${y}`,
            centre: centre(x, y, 0.014),
            dir: DIR_VEC[entry],
            yaw: DIR_YAW[entry],
            offset: i / k,
            speed,
            surge: 0,
            ...(def.curve ? { dir2: DIR_VEC[def.dir], yaw2: DIR_YAW[def.dir] } : {}),
          });
        }
        break;
      }
      case 'gear': {
        // Handles kept so `gear-rotated` can turn THIS wheel. The teeth are
        // what the turn reads on: the primitive disc is a cylinder and so
        // rotationally symmetric, exactly as the portal ring is, and only the
        // kit's modelled gear shows a yaw on the disc alone.
        const gearHandle = {
          disc: gearDiscs.count,
          teethStart: gearTeeth.count,
          teeth: 0,
          centre: centre(x, y, 0.04),
        };
        gearIndex.set(`${x},${y}`, gearHandle);
        gearDiscs.add({ pos: centre(x, y, 0.04) });
        // The kit's gear is one toothed wheel; the primitive disc needs its
        // eight teeth bolted on as their own instances.
        for (let i = 0; !kit?.gear && i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          gearHandle.teeth++;
          gearTeeth.add({
            pos: new THREE.Vector3(x + 0.5 + Math.sin(a) * 0.42, 0.04, y + 0.5 - Math.cos(a) * 0.42),
            yaw: -a,
          });
        }
        // Two tangential chevrons showing which way the gear turns.
        for (const side of [1, -1]) {
          gearArrows.add({
            pos: new THREE.Vector3(x + 0.5 + side * 0.2, 0.1, y + 0.5),
            yaw: (def.cw ? side : -side) * (Math.PI / 2),
            scale: 0.62,
          });
        }
        break;
      }
      case 'checkpoint':
        ringIndex.set(`${x},${y}`, rings.count);
        rings.add({ pos: centre(x, y, 0.05) });
        addLabel(x, y, def.n, '#6fe3bd', 0.44);
        break;
      case 'spawn':
        // The kit's dock is the whole frame in one piece; the primitive is a
        // single bar, so it takes four placements to draw the same square.
        if (kit?.spawn) spawns.add({ pos: centre(x, y, 0.02) });
        else {
          for (const d of ['N', 'E', 'S', 'W'] as Direction[]) {
            spawns.add({
              pos: centre(x, y, 0.02).addScaledVector(DIR_VEC[d], 0.33),
              yaw: DIR_YAW[d],
            });
          }
        }
        addLabel(x, y, def.n, '#9aa0b8', 0.34);
        break;
      case 'trapdoor':
        // Closed hatch: a dark plate sitting just proud of the deck, its
        // schedule stamped on top. The open state is engine-side only.
        trapdoorPlates.add({ pos: centre(x, y, 0.035) });
        addLabel(x, y, def.registers.join(' '), '#e0b341', 0.6, 0.085);
        break;
      case 'radiation':
        radiationDiscs.add({ pos: centre(x, y, 0.03) });
        break;
      case 'waste':
        // Irregular-ish: a flattened, slightly rotated elliptical puddle.
        wastePatches.add({
          pos: centre(x, y, 0.03),
          yaw: ((x * 7 + y * 13) % 8) * (Math.PI / 8),
          scale: new THREE.Vector3(1, 1, 0.82),
        });
        break;
      case 'portal':
        portalRings.add({ pos: centre(x, y, 0.05), color: PORTAL_HEX[def.color] });
        portalCores.add({ pos: centre(x, y, 0.04), color: PORTAL_HEX[def.color] });
        portalCells.push({ x, y });
        break;
      case 'teleporter':
        teleporterRings.add({ pos: centre(x, y, 0.05) });
        teleporterCores.add({ pos: centre(x, y, 0.035) });
        break;
      case 'repulsor':
        repulsorBodies.add({ pos: centre(x, y, 0.08) });
        repulsorCores.add({ pos: centre(x, y, 0.17) });
        break;
      case 'wrench':
        wrenches.add({ pos: centre(x, y, 0.025) });
        if (!kit?.wrench) {
          // Procedural glyph: a diagonal handle bar plus a stubby wide "head"
          // (the same box squashed) at its NE end — wrench-ish at deck scale.
          const diag = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
          wrenchGlyphs.add({ pos: centre(x, y, 0.07), yaw: Math.PI / 4 });
          wrenchGlyphs.add({
            pos: centre(x, y, 0.07).addScaledVector(diag, 0.21),
            yaw: Math.PI / 4,
            scale: new THREE.Vector3(0.45, 1, 1.9),
          });
        }
        break;
      case 'floor':
        break;
    }
  }

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) addTile(board.tiles[y][x], x, y);
  }

  for (const w of board.walls) {
    const edge = centre(w.x, w.y, 0.17).addScaledVector(DIR_VEC[w.side], 0.5);
    if (!w.oneWay) {
      walls.add({ pos: edge, yaw: DIR_YAW[w.side] });
      continue;
    }
    // One-way wall: two half-thickness slabs, red on the side the wall
    // blocks from ('out' blocks leaving the cell → red faces the interior),
    // green on the passable side — same read as the DOM edge gradient.
    const inward = -0.033; // toward the wall's own cell
    const redOffset = w.oneWay === 'out' ? inward : -inward;
    oneWayReds.add({
      pos: edge.clone().addScaledVector(DIR_VEC[w.side], redOffset),
      yaw: DIR_YAW[w.side],
    });
    oneWayGreens.add({
      pos: edge.clone().addScaledVector(DIR_VEC[w.side], -redOffset),
      yaw: DIR_YAW[w.side],
    });
  }

  for (const c of board.crushers ?? []) {
    const { x, y } = c.pos;
    for (const [dx, dz] of [
      [-0.4, -0.4],
      [0.4, -0.4],
      [-0.4, 0.4],
      [0.4, 0.4],
    ]) {
      crusherPosts.add({ pos: new THREE.Vector3(x + 0.5 + dx, 0.26, y + 0.5 + dz) });
    }
    const crusherRest = centre(x, y, 0.5);
    crusherIndex.set(`${x},${y}`, { index: crusherPlates.count, rest: crusherRest });
    crusherPlates.add({ pos: crusherRest });
    addLabel(x, y, c.registers.join(' '), '#dde3f2', 0.6, 0.56);
  }

  for (const f of board.flamers ?? []) {
    const { x, y } = f.pos;
    flamerNozzles.add({ pos: centre(x, y, 0.05) });
    flameIndex.set(`${x},${y}`, flamerFlames.count);
    flamerFlames.add({ pos: centre(x, y, FLAME_BASE_Y + FLAME_HALF) });
    addLabel(x, y, f.registers.join(' '), '#7d1d10', 0.5, 0.52);
  }

  for (const l of board.lasers) {
    emitterBodies.add({
      pos: centre(l.pos.x, l.pos.y, LASER_Y).addScaledVector(DIR_VEC[l.facing], BARREL_ALONG),
      yaw: DIR_YAW[l.facing],
    });
    // Placed by the same function scene.ts starts the beam from, so the two
    // cannot disagree about where the muzzle is.
    emitterLenses.add({ pos: laserMuzzle(l), yaw: DIR_YAW[l.facing] });
  }

  for (const p of board.pushers ?? []) {
    // Mounted on the wall BEHIND the push direction, like the laser barrel:
    // housing flush against the edge, piston plate poised in front of it.
    pusherHousings.add({
      pos: centre(p.pos.x, p.pos.y, 0.16).addScaledVector(DIR_VEC[p.facing], -0.42),
      yaw: DIR_YAW[p.facing],
    });
    const odd = p.registers.includes(1);
    const plates = odd ? pusherPlatesOdd : pusherPlatesEven;
    const rest = centre(p.pos.x, p.pos.y, 0.16).addScaledVector(DIR_VEC[p.facing], -0.28);
    pusherIndex.set(`${p.pos.x},${p.pos.y}`, {
      odd,
      index: plates.count,
      rest,
      yaw: DIR_YAW[p.facing],
      dir: DIR_VEC[p.facing],
    });
    plates.add({ pos: rest, yaw: DIR_YAW[p.facing] });
  }

  // -------------------------------------------------------------- materials
  // The kit ships two materials of its own — one PBR, one emissive — and they
  // win for every piece whose colour is art. These stay for two jobs: the
  // whole fallback board, and the pieces whose colour is a game rule (belt
  // speed class, checkpoint, laser) even when the kit did load.
  const slabMat = mat(new THREE.MeshStandardMaterial({ color: C.base, roughness: 0.95 }));
  const floorMat = mat(
    new THREE.MeshStandardMaterial({ color: C.panel, roughness: 0.82, metalness: 0.06 }),
  );
  const beltFloorMat = mat(
    new THREE.MeshStandardMaterial({ color: C.conveyorFloor, roughness: 0.82, metalness: 0.06 }),
  );
  const pitMat = mat(new THREE.MeshStandardMaterial({ color: C.pit, roughness: 1 }));
  const rimMat = mat(
    new THREE.MeshStandardMaterial({ color: C.wall, roughness: 0.55, metalness: 0.25 }),
  );
  const wallMat = mat(
    new THREE.MeshStandardMaterial({ color: C.wall, roughness: 0.45, metalness: 0.35 }),
  );
  const beltMat = mat(
    new THREE.MeshStandardMaterial({
      color: C.belt,
      roughness: 0.5,
      emissive: new THREE.Color(C.belt),
      emissiveIntensity: 0.25,
    }),
  );
  const beltExpressMat = mat(
    new THREE.MeshStandardMaterial({
      color: C.accent,
      roughness: 0.45,
      emissive: new THREE.Color(C.accent),
      emissiveIntensity: 0.45,
    }),
  );
  const gearMat = mat(
    new THREE.MeshStandardMaterial({ color: C.gear, roughness: 0.5, metalness: 0.5 }),
  );
  const gearDarkMat = mat(new THREE.MeshStandardMaterial({ color: C.gearDark, roughness: 0.7 }));
  const checkMat = mat(
    new THREE.MeshStandardMaterial({
      color: C.checkpoint,
      roughness: 0.35,
      emissive: new THREE.Color(C.checkpoint),
      emissiveIntensity: 0.6,
    }),
  );
  const lineMat = mat(new THREE.MeshStandardMaterial({ color: C.line, roughness: 0.8 }));
  const wrenchMat = mat(
    new THREE.MeshStandardMaterial({ color: C.belt, roughness: 0.45, metalness: 0.5 }),
  );
  const emitterMat = mat(
    new THREE.MeshStandardMaterial({ color: 0x4a5069, roughness: 0.5, metalness: 0.6 }),
  );
  const lensMat = mat(
    new THREE.MeshStandardMaterial({
      color: C.danger,
      emissive: new THREE.Color(C.danger),
      emissiveIntensity: 1.4,
      roughness: 0.3,
    }),
  );
  // Pusher plates keep code materials even with a kit loaded: which registers
  // a piston fires on is a game rule, and the tint is how you read it.
  const pusherOddMat = mat(
    new THREE.MeshStandardMaterial({ color: 0xe0b341, roughness: 0.5, metalness: 0.35 }),
  );
  const pusherEvenMat = mat(
    new THREE.MeshStandardMaterial({ color: C.belt, roughness: 0.5, metalness: 0.35 }),
  );
  // Expansion-element materials. Seven of these stay in play even with a kit
  // loaded (see the build calls below); the rest are the fallback path.
  const grateMat = mat(
    new THREE.MeshStandardMaterial({ color: 0x39415a, roughness: 0.55, metalness: 0.5 }),
  );
  const hatchMat = mat(new THREE.MeshStandardMaterial({ color: 0x20242f, roughness: 0.8 }));
  const radiationMat = mat(
    new THREE.MeshStandardMaterial({
      color: 0xd3e34a,
      emissive: new THREE.Color(0xd3e34a),
      emissiveIntensity: 0.5,
      roughness: 0.6,
    }),
  );
  const wasteMat = mat(
    new THREE.MeshStandardMaterial({
      color: 0x3f7d36,
      emissive: new THREE.Color(0x58c470),
      // 0.18 under ACES made the puddle the brightest thing on a deck — louder
      // than radiation sitting next to it, which is the same class of hazard
      // for the same 1 damage. Down to where the green still cues the hazard
      // but the modelled surface gets some shading back.
      emissiveIntensity: 0.1,
      roughness: 0.9,
    }),
  );
  // Portal rings/cores tint per instance (pair color), so the base is white.
  const portalMat = mat(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  const teleRingMat = mat(
    new THREE.MeshStandardMaterial({ color: 0x7d3436, roughness: 0.5, metalness: 0.3 }),
  );
  const teleCoreMat = mat(
    new THREE.MeshStandardMaterial({
      color: 0x57a7e8,
      emissive: new THREE.Color(0x57a7e8),
      // The kit models an iris into this core; at 0.7 it clipped to a flat
      // white-blue disc and the relief vanished — Phase 46's rule again.
      emissiveIntensity: 0.45,
      roughness: 0.35,
    }),
  );
  const repulsorMat = mat(
    new THREE.MeshStandardMaterial({ color: 0x33241f, roughness: 0.7, metalness: 0.3 }),
  );
  const repulsorCoreMat = mat(
    new THREE.MeshStandardMaterial({
      color: 0xff7847,
      emissive: new THREE.Color(0xff7847),
      emissiveIntensity: 1.1,
      roughness: 0.3,
    }),
  );
  const oneWayRedMat = mat(
    new THREE.MeshStandardMaterial({ color: 0xe05555, roughness: 0.45, metalness: 0.35 }),
  );
  const oneWayGreenMat = mat(
    new THREE.MeshStandardMaterial({ color: 0x58c470, roughness: 0.45, metalness: 0.35 }),
  );
  const crusherMat = mat(
    new THREE.MeshStandardMaterial({ color: 0x5a6180, roughness: 0.5, metalness: 0.45 }),
  );
  const flameMat = mat(
    new THREE.MeshStandardMaterial({
      color: 0xff9636,
      emissive: new THREE.Color(0xff9636),
      // 1.2 clipped straight through orange to a pale beige cone — a flame with
      // no fire in it. This is also the one emissive that has a second job now:
      // scene.ts scales this cone on a flamer burst, and a burst has to read as
      // HOTTER than the resting jet, which it cannot if the resting jet is
      // already at white.
      emissiveIntensity: 0.6,
      roughness: 0.4,
      transparent: true,
      opacity: 0.85,
    }),
  );

  // ------------------------------------------------------------------ build
  // The slab under every tile is sized to the grid, not modelled, so it is
  // always the primitive — as is the board rim further down.
  add(bodies.build(geom(new THREE.BoxGeometry(1, SLAB, 1)), slabMat, { receive: true }));
  const deckPrimitive = () => new THREE.BoxGeometry(0.94, 0.05, 0.94);
  add(
    floorDecks.build(pieceGeom(kit?.floor, deckPrimitive), kit?.floor?.material ?? floorMat, {
      receive: true,
    }),
  );
  add(
    beltDecks.build(
      pieceGeom(kit?.conveyor, deckPrimitive),
      kit?.conveyor?.material ?? beltFloorMat,
      { receive: true },
    ),
  );
  // A kit without the curve piece falls back to the flat deck primitive —
  // the chevrons still bend, which is the readable part.
  add(
    curveDecks.build(
      pieceGeom(kit?.conveyor_curve, deckPrimitive),
      kit?.conveyor_curve?.material ?? beltFloorMat,
      { receive: true },
    ),
  );
  add(
    pitFloors.build(
      pieceGeom(kit?.pit_shaft, () => new THREE.BoxGeometry(1, 0.08, 1)),
      kit?.pit_shaft?.material ?? pitMat,
      { receive: true },
    ),
  );
  add(
    pitRims.build(
      pieceGeom(kit?.pit_rim, () => new THREE.TorusGeometry(0.44, 0.035, 6, 20).rotateX(Math.PI / 2)),
      kit?.pit_rim?.material ?? rimMat,
      { cast: true },
    ),
  );
  add(
    walls.build(
      pieceGeom(kit?.wall, () => new THREE.BoxGeometry(0.98, 0.34, 0.12)),
      kit?.wall?.material ?? wallMat,
      { cast: true, receive: true },
    ),
  );
  const gearDiscMesh = gearDiscs.build(
    pieceGeom(kit?.gear, () => new THREE.CylinderGeometry(0.38, 0.38, 0.1, 20)),
    kit?.gear?.material ?? gearMat,
    { cast: true, receive: true },
  );
  add(gearDiscMesh);
  const gearToothMesh = gearTeeth.count
    ? gearTeeth.build(geom(new THREE.BoxGeometry(0.14, 0.09, 0.13)), gearMat, { cast: true })
    : null;
  add(gearToothMesh);
  // Checkpoint and laser lens take the kit's geometry but keep their own
  // emissive materials: those two colours mean something in the rules.
  const ringMesh = rings.build(
    pieceGeom(kit?.checkpoint, () =>
      new THREE.TorusGeometry(0.33, 0.05, 8, 26).rotateX(Math.PI / 2),
    ),
    checkMat,
    { cast: true },
  );
  add(ringMesh);
  add(
    spawns.build(
      pieceGeom(kit?.spawn, () => new THREE.BoxGeometry(0.62, 0.05, 0.07)),
      kit?.spawn?.material ?? lineMat,
      { receive: true },
    ),
  );
  add(
    wrenches.build(
      pieceGeom(kit?.wrench, () => new THREE.CylinderGeometry(0.36, 0.36, 0.04, 20)),
      kit?.wrench?.material ?? lineMat,
      { receive: true },
    ),
  );
  if (wrenchGlyphs.count) {
    add(wrenchGlyphs.build(geom(new THREE.BoxGeometry(0.46, 0.06, 0.1)), wrenchMat, { cast: true }));
  }
  for (const label of labels) group.add(label);
  add(
    emitterBodies.build(
      pieceGeom(kit?.laser_body, () => new THREE.BoxGeometry(0.2, 0.16, 0.34)),
      kit?.laser_body?.material ?? emitterMat,
      { cast: true },
    ),
  );
  add(
    emitterLenses.build(
      pieceGeom(kit?.laser_lens, () => new THREE.SphereGeometry(0.06, 10, 8)),
      lensMat,
    ),
  );
  add(
    pusherHousings.build(
      pieceGeom(kit?.pusher_housing, () => new THREE.BoxGeometry(0.72, 0.2, 0.14)),
      kit?.pusher_housing?.material ?? emitterMat,
      { cast: true },
    ),
  );
  const pusherPlateGeom = pieceGeom(kit?.pusher_plate, () => new THREE.BoxGeometry(0.6, 0.14, 0.08));
  const pusherOddMesh = pusherPlatesOdd.build(pusherPlateGeom, pusherOddMat, { cast: true });
  const pusherEvenMesh = pusherPlatesEven.build(pusherPlateGeom, pusherEvenMat, { cast: true });
  add(pusherOddMesh);
  add(pusherEvenMesh);

  // Expansion elements. Six of the fourteen keep a CODE material even with the
  // kit loaded — waste/teleporter-core/repulsor-core because the emissive
  // colour is the hazard cue, portals because the pair colour is per-instance,
  // one-ways because red/green IS the rule. Those take the kit's geometry only,
  // so those pieces are modelled to read through shape alone.
  //
  // Radiation is NOT one of them, and that was a correction: on the emissive
  // material the trefoil relief vanished — uniform emission gives the shading
  // nothing to bite on, so a modelled symbol rendered as a flat yellow blob.
  // On the kit material the painted trefoil reads the way the DOM board's
  // does, which is worth more than the glow was.
  add(
    drainBars.build(
      pieceGeom(kit?.drain_grate, () => new THREE.BoxGeometry(0.82, 0.05, 0.07)),
      kit?.drain_grate?.material ?? grateMat,
      { cast: true },
    ),
  );
  add(
    trapdoorPlates.build(
      pieceGeom(kit?.trapdoor_hatch, () => new THREE.BoxGeometry(0.82, 0.06, 0.82)),
      kit?.trapdoor_hatch?.material ?? hatchMat,
      { cast: true, receive: true },
    ),
  );
  add(
    radiationDiscs.build(
      pieceGeom(kit?.radiation_disc, () => new THREE.CylinderGeometry(0.36, 0.36, 0.03, 20)),
      kit?.radiation_disc?.material ?? radiationMat,
      { receive: true },
    ),
  );
  add(
    wastePatches.build(
      pieceGeom(kit?.waste_puddle, () => new THREE.CylinderGeometry(0.44, 0.46, 0.035, 14)),
      wasteMat,
      { receive: true },
    ),
  );
  // Held rather than added blind: tick() re-poses both every frame.
  const portalRingMesh = portalRings.build(
    pieceGeom(kit?.portal_ring, () =>
      new THREE.TorusGeometry(0.32, 0.06, 8, 24).rotateX(Math.PI / 2),
    ),
    portalMat,
    { cast: true },
  );
  add(portalRingMesh);
  const portalCoreMesh = portalCores.build(
    pieceGeom(kit?.portal_core, () => new THREE.CylinderGeometry(0.16, 0.16, 0.025, 16)),
    portalMat,
  );
  add(portalCoreMesh);
  add(
    teleporterRings.build(
      pieceGeom(kit?.teleporter_pad, () =>
        new THREE.TorusGeometry(0.36, 0.055, 8, 24).rotateX(Math.PI / 2),
      ),
      kit?.teleporter_pad?.material ?? teleRingMat,
      { cast: true },
    ),
  );
  add(
    teleporterCores.build(
      pieceGeom(kit?.teleporter_core, () => new THREE.CylinderGeometry(0.2, 0.2, 0.025, 16)),
      teleCoreMat,
    ),
  );
  add(
    repulsorBodies.build(
      pieceGeom(kit?.repulsor_coil, () => new THREE.CylinderGeometry(0.4, 0.44, 0.14, 8)),
      kit?.repulsor_coil?.material ?? repulsorMat,
      { cast: true, receive: true },
    ),
  );
  add(
    repulsorCores.build(
      pieceGeom(kit?.repulsor_core, () => new THREE.SphereGeometry(0.09, 10, 8)),
      repulsorCoreMat,
    ),
  );
  const oneWayGeom = pieceGeom(kit?.oneway_slab, () => new THREE.BoxGeometry(0.98, 0.34, 0.055));
  add(oneWayReds.build(oneWayGeom, oneWayRedMat, { cast: true, receive: true }));
  add(oneWayGreens.build(oneWayGeom, oneWayGreenMat, { cast: true, receive: true }));
  add(
    crusherPosts.build(
      pieceGeom(kit?.crusher_post, () => new THREE.BoxGeometry(0.1, 0.52, 0.1)),
      kit?.crusher_post?.material ?? emitterMat,
      { cast: true },
    ),
  );
  const crusherPlateMesh = crusherPlates.build(
    pieceGeom(kit?.crusher_head, () => new THREE.BoxGeometry(0.72, 0.09, 0.72)),
    kit?.crusher_head?.material ?? crusherMat,
    { cast: true },
  );
  add(crusherPlateMesh);
  add(
    flamerNozzles.build(
      pieceGeom(kit?.flamer_nozzle, () => new THREE.CylinderGeometry(0.14, 0.18, 0.1, 10)),
      kit?.flamer_nozzle?.material ?? emitterMat,
      { cast: true },
    ),
  );
  const flameMesh = flamerFlames.build(
    geom(new THREE.ConeGeometry(0.15, FLAME_HALF * 2, 10)),
    flameMat,
    { cast: true },
  );
  add(flameMesh);

  // Chevrons: one instanced mesh per speed class so express keeps its accent
  // colour, both re-placed every frame by tick().
  const chevGeom = pieceGeom(kit?.chevron, chevronGeometry);
  add(gearArrows.build(chevGeom, gearDarkMat, {}));

  const normal = chevrons.filter((c) => c.speed < 0.2);
  const express = chevrons.filter((c) => c.speed >= 0.2);
  const chevMeshes: { mesh: THREE.InstancedMesh; items: Chevron[] }[] = [];
  for (const [items, material] of [
    [normal, beltMat],
    [express, beltExpressMat],
  ] as const) {
    if (!items.length) continue;
    const mesh = new THREE.InstancedMesh(chevGeom, material, items.length);
    mesh.frustumCulled = false;
    group.add(mesh);
    chevMeshes.push({ mesh, items });
  }

  /**
   * Cell key -> that cell's chevrons, so a `conveyor-moved` pulse surges
   * exactly the belt that carried someone. Same objects `chevMeshes` holds,
   * so writing `surge` here is read by the next `tick`.
   */
  const beltIndex = new Map<string, Chevron[]>();
  for (const c of chevrons) {
    const list = beltIndex.get(c.cell);
    if (list) list.push(c);
    else beltIndex.set(c.cell, [c]);
  }

  // Board rim, matching the DOM board's 3px --line border.
  const rimGeoms: THREE.BufferGeometry[] = [];
  const t = 0.16;
  const hRim = SLAB + 0.14;
  const yRim = 0.07 - hRim / 2;
  for (const [w, h, x, z] of [
    [board.width + t * 2, t, board.width / 2, -t / 2],
    [board.width + t * 2, t, board.width / 2, board.height + t / 2],
    [t, board.height, -t / 2, board.height / 2],
    [t, board.height, board.width + t / 2, board.height / 2],
  ]) {
    rimGeoms.push(new THREE.BoxGeometry(w, hRim, h).translate(x, yRim, z));
  }
  for (const g of rimGeoms) {
    const m = new THREE.Mesh(geom(g), lineMat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  // ------------------------------------------------------------------- tick
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  const s3 = new THREE.Vector3();

  /**
   * A portal's idle swirl: the ring turns and the core breathes.
   *
   * Two motions because the two paths have different geometry to work with. The
   * kit's `portal_ring` carries four mounting tabs, so a yaw is plainly visible
   * on it; the primitive is a plain torus and rotationally symmetric, where the
   * yaw is a no-op. The core's in-plane pulse is what reads on BOTH — it is the
   * fallback board's whole animation.
   *
   * The phase comes from the cell, not from an index, so two portals of a pair
   * are out of step with each other and the board doesn't pulse as one unit.
   */
  const swirls = portalCells.map((c) => ({
    ring: new THREE.Vector3(c.x + 0.5, 0.05, c.y + 0.5),
    core: new THREE.Vector3(c.x + 0.5, 0.04, c.y + 0.5),
    phase: ((c.x * 5 + c.y * 3) % 8) * (Math.PI / 4),
  }));

  function tickPortals(elapsed: number): void {
    if (!swirls.length) return;
    swirls.forEach((sw, i) => {
      const spin = elapsed * PORTAL_SPIN + sw.phase;
      if (portalRingMesh) {
        portalRingMesh.setMatrixAt(i, m4.compose(sw.ring, q.setFromAxisAngle(up, spin), one));
      }
      if (portalCoreMesh) {
        // In-plane only: a core that grew vertically would lift out of its ring.
        const pulse = 1 + 0.16 * Math.sin(2 * Math.PI * PORTAL_PULSE_HZ * elapsed + sw.phase);
        portalCoreMesh.setMatrixAt(
          i,
          m4.compose(sw.core, q.setFromAxisAngle(up, -spin), s3.set(pulse, 1, pulse)),
        );
      }
    });
    if (portalRingMesh) portalRingMesh.instanceMatrix.needsUpdate = true;
    if (portalCoreMesh) portalCoreMesh.instanceMatrix.needsUpdate = true;
  }

  function tick(elapsed: number): void {
    tickPortals(elapsed);
    for (const { mesh, items } of chevMeshes) {
      items.forEach((c, i) => {
        // Chevrons cycle within their own tile; neighbours share the phase, so
        // the belt reads as continuous across cell boundaries.
        const frac = (((c.offset + elapsed * c.speed + c.surge) % 1) + 1) % 1;
        if (c.dir2 && frac >= 0.5) {
          // Second leg of a curve: out from the centre along the exit axis.
          p.copy(c.centre).addScaledVector(c.dir2, frac - 0.5);
          q.setFromAxisAngle(up, c.yaw2 ?? c.yaw);
        } else {
          p.copy(c.centre).addScaledVector(c.dir, frac - 0.5);
          q.setFromAxisAngle(up, c.yaw);
        }
        mesh.setMatrixAt(i, m4.compose(p, q, one));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  tick(0);

  return {
    group,
    animated: chevMeshes.length > 0 || swirls.length > 0,
    tick,
    flameAt(x, y, scale) {
      const i = flameIndex.get(`${x},${y}`);
      if (i === undefined || !flameMesh) return false;
      const s = Math.max(scale, 0.01);
      p.set(x + 0.5, FLAME_BASE_Y + FLAME_HALF * s, y + 0.5);
      flameMesh.setMatrixAt(i, m4.compose(p, q.identity(), s3.setScalar(s)));
      flameMesh.instanceMatrix.needsUpdate = true;
      return true;
    },
    pusherAt(x, y, extend) {
      const h = pusherIndex.get(`${x},${y}`);
      const mesh = h && (h.odd ? pusherOddMesh : pusherEvenMesh);
      if (!h || !mesh) return false;
      p.copy(h.rest).addScaledVector(h.dir, PUSHER_THROW * extend);
      mesh.setMatrixAt(h.index, m4.compose(p, q.setFromAxisAngle(up, h.yaw), one));
      mesh.instanceMatrix.needsUpdate = true;
      return true;
    },
    gearAt(x, y, angle) {
      const h = gearIndex.get(`${x},${y}`);
      if (!h) return false;
      if (gearDiscMesh) {
        gearDiscMesh.setMatrixAt(h.disc, m4.compose(h.centre, q.setFromAxisAngle(up, angle), one));
        gearDiscMesh.instanceMatrix.needsUpdate = true;
      }
      if (gearToothMesh && h.teeth) {
        for (let i = 0; i < h.teeth; i++) {
          // A tooth built at ring angle `a` rides round to `a - angle` (a yaw
          // of -π/2 carries north to east, so a clockwise turn is a NEGATIVE
          // angle and advances the ring). Its own yaw stays the negative of
          // wherever it now sits, which is what keeps it tangential.
          const a = (i / h.teeth) * Math.PI * 2 - angle;
          p.set(h.centre.x + Math.sin(a) * 0.42, h.centre.y, h.centre.z - Math.cos(a) * 0.42);
          gearToothMesh.setMatrixAt(
            h.teethStart + i,
            m4.compose(p, q.setFromAxisAngle(up, -a), one),
          );
        }
        gearToothMesh.instanceMatrix.needsUpdate = true;
      }
      return true;
    },
    crusherAt(x, y, press) {
      const h = crusherIndex.get(`${x},${y}`);
      if (!h || !crusherPlateMesh) return false;
      p.copy(h.rest);
      p.y = h.rest.y - CRUSHER_DROP * press;
      crusherPlateMesh.setMatrixAt(h.index, m4.compose(p, q.identity(), one));
      crusherPlateMesh.instanceMatrix.needsUpdate = true;
      return true;
    },
    beltSurgeAt(x, y, extra) {
      const list = beltIndex.get(`${x},${y}`);
      if (!list) return false;
      // Only the phase changes; tick() does the writing on its next pass, and
      // a belt board is already awake for the ambient scroll.
      for (const c of list) c.surge = extra;
      return true;
    },
    checkpointRing(x, y) {
      const i = ringIndex.get(`${x},${y}`);
      if (i === undefined || !ringMesh) return null;
      // The group sits at the origin and is never transformed, so an instance's
      // local matrix IS its world matrix.
      const matrix = new THREE.Matrix4();
      ringMesh.getMatrixAt(i, matrix);
      return { geometry: ringMesh.geometry, matrix };
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) {
        // Material.dispose() doesn't touch its maps; the label digits are
        // canvas textures we own.
        const map = (m as THREE.MeshBasicMaterial).map;
        map?.dispose();
        m.dispose();
      }
      group.clear();
    },
  };
}
