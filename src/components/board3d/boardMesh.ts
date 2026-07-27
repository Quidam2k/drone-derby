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

/** A digit drawn to an offscreen canvas, for the checkpoint/spawn numbers. */
function labelTexture(text: string, color: string): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.font = `700 ${size * 0.72}px 'Segoe UI', system-ui, sans-serif`;
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
  centre: THREE.Vector3;
  dir: THREE.Vector3;
  yaw: number;
  /** Position within the tile at phase 0, in [0, 1). */
  offset: number;
  /** Tiles per second. Matches the DOM belt animation's px/s at a 52px tile. */
  speed: number;
}

export interface BoardMeshes {
  group: THREE.Group;
  /** True when something on this board animates on its own (scrolling belts). */
  animated: boolean;
  tick(elapsed: number): void;
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
  const pitFloors = new Batch();
  const pitRims = new Batch();
  const chevrons: Chevron[] = [];
  const gearDiscs = new Batch();
  const gearTeeth = new Batch();
  const gearArrows = new Batch();
  const rings = new Batch();
  /** Cell key -> its instance index in the checkpoint ring batch. */
  const ringIndex = new Map<string, number>();
  const spawns = new Batch();
  const labels: THREE.Mesh[] = [];
  const walls = new Batch();
  const emitterBodies = new Batch();
  const emitterLenses = new Batch();

  /**
   * The checkpoint/spawn number, as a digit lying on the tile. Pips were the
   * first attempt and read as a face, not a number — the DOM board draws the
   * actual digit and the 3D board has to be as legible.
   */
  function addLabel(x: number, y: number, n: number, color: string, size: number) {
    const mesh = new THREE.Mesh(
      geom(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2)),
      mat(
        new THREE.MeshBasicMaterial({
          map: labelTexture(String(n), color),
          transparent: true,
          depthWrite: false,
        }),
      ),
    );
    mesh.position.set(x + 0.5, 0.045, y + 0.5);
    labels.push(mesh);
  }

  function addTile(def: TileDef, x: number, y: number) {
    if (def.kind === 'pit') {
      pitFloors.add({ pos: centre(x, y, -SLAB - 0.12) });
      pitRims.add({ pos: centre(x, y, -0.02) });
      return;
    }
    bodies.add({ pos: centre(x, y, -SLAB / 2) });
    if (def.kind === 'conveyor') beltDecks.add({ pos: centre(x, y, -0.015), yaw: DIR_YAW[def.dir] });
    else floorDecks.add({ pos: centre(x, y, -0.015) });

    switch (def.kind) {
      case 'conveyor': {
        const k = def.express ? 3 : 2;
        // 13px per 1.8s (normal) / 12px per 0.9s (express) at a 52px tile.
        const speed = def.express ? 0.256 : 0.139;
        for (let i = 0; i < k; i++) {
          chevrons.push({
            centre: centre(x, y, 0.014),
            dir: DIR_VEC[def.dir],
            yaw: DIR_YAW[def.dir],
            offset: i / k,
            speed,
          });
        }
        break;
      }
      case 'gear':
        gearDiscs.add({ pos: centre(x, y, 0.04) });
        // The kit's gear is one toothed wheel; the primitive disc needs its
        // eight teeth bolted on as their own instances.
        for (let i = 0; !kit?.gear && i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
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
      case 'floor':
        break;
    }
  }

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) addTile(board.tiles[y][x], x, y);
  }

  for (const w of board.walls) {
    walls.add({
      pos: centre(w.x, w.y, 0.17).addScaledVector(DIR_VEC[w.side], 0.5),
      yaw: DIR_YAW[w.side],
    });
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
  add(
    gearDiscs.build(
      pieceGeom(kit?.gear, () => new THREE.CylinderGeometry(0.38, 0.38, 0.1, 20)),
      kit?.gear?.material ?? gearMat,
      { cast: true, receive: true },
    ),
  );
  if (gearTeeth.count) {
    add(gearTeeth.build(geom(new THREE.BoxGeometry(0.14, 0.09, 0.13)), gearMat, { cast: true }));
  }
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

  function tick(elapsed: number): void {
    for (const { mesh, items } of chevMeshes) {
      items.forEach((c, i) => {
        // Chevrons cycle within their own tile; neighbours share the phase, so
        // the belt reads as continuous across cell boundaries.
        const frac = (((c.offset + elapsed * c.speed) % 1) + 1) % 1;
        p.copy(c.centre).addScaledVector(c.dir, frac - 0.5);
        q.setFromAxisAngle(up, c.yaw);
        mesh.setMatrixAt(i, m4.compose(p, q, one));
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  tick(0);

  return {
    group,
    animated: chevMeshes.length > 0,
    tick,
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
