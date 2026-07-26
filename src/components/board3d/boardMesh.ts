// BoardDef -> three.js geometry. Procedural on purpose: the point of the 3D-1
// spike is to prove the pipeline before anyone models board art (that's 3D-2).
//
// Everything is instanced and shares a handful of materials, so a 12x17
// composed board is ~15 draw calls regardless of how many belts it has.
// The palette is lifted from index.css custom properties so the 3D board reads
// as the same game as the DOM one rather than a different product.

import * as THREE from 'three';
import type { BoardDef, Direction, TileDef } from '../../engine';

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
  dispose(): void;
}

export function buildBoard(board: BoardDef): BoardMeshes {
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

  const centre = (x: number, y: number, h = 0) => new THREE.Vector3(x + 0.5, h, y + 0.5);

  // ---------------------------------------------------------------- batches
  const bodies = new Batch();
  const caps = new Batch();
  const pitFloors = new Batch();
  const pitRims = new Batch();
  const chevrons: Chevron[] = [];
  const gearDiscs = new Batch();
  const gearTeeth = new Batch();
  const gearArrows = new Batch();
  const rings = new Batch();
  const spawnBars = new Batch();
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
    caps.add({
      pos: centre(x, y, -0.015),
      color: def.kind === 'conveyor' ? C.conveyorFloor : C.panel,
    });

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
        for (let i = 0; i < 8; i++) {
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
        rings.add({ pos: centre(x, y, 0.05) });
        addLabel(x, y, def.n, '#6fe3bd', 0.44);
        break;
      case 'spawn':
        for (const d of ['N', 'E', 'S', 'W'] as Direction[]) {
          spawnBars.add({
            pos: centre(x, y, 0.02).addScaledVector(DIR_VEC[d], 0.33),
            yaw: DIR_YAW[d],
          });
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
    // The barrel is mounted on the wall BEHIND the beam, matching the DOM
    // emitter sprite: an emitter facing E sits on its cell's west edge.
    const back = DIR_VEC[l.facing].clone().multiplyScalar(-0.38);
    emitterBodies.add({ pos: centre(l.pos.x, l.pos.y, 0.16).add(back), yaw: DIR_YAW[l.facing] });
    emitterLenses.add({
      pos: centre(l.pos.x, l.pos.y, 0.16).add(back).addScaledVector(DIR_VEC[l.facing], 0.19),
      yaw: DIR_YAW[l.facing],
    });
  }

  // -------------------------------------------------------------- materials
  const slabMat = mat(new THREE.MeshStandardMaterial({ color: C.base, roughness: 0.95 }));
  const capMat = mat(new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.06 }));
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
  add(bodies.build(geom(new THREE.BoxGeometry(1, SLAB, 1)), slabMat, { receive: true }));
  add(caps.build(geom(new THREE.BoxGeometry(0.94, 0.05, 0.94)), capMat, { receive: true }));
  add(pitFloors.build(geom(new THREE.BoxGeometry(1, 0.08, 1)), pitMat, { receive: true }));
  add(
    pitRims.build(
      geom(new THREE.TorusGeometry(0.44, 0.035, 6, 20).rotateX(Math.PI / 2)),
      rimMat,
      { cast: true },
    ),
  );
  add(
    walls.build(geom(new THREE.BoxGeometry(0.98, 0.34, 0.12)), wallMat, {
      cast: true,
      receive: true,
    }),
  );
  add(
    gearDiscs.build(geom(new THREE.CylinderGeometry(0.38, 0.38, 0.1, 20)), gearMat, {
      cast: true,
      receive: true,
    }),
  );
  add(gearTeeth.build(geom(new THREE.BoxGeometry(0.14, 0.09, 0.13)), gearMat, { cast: true }));
  add(
    rings.build(
      geom(new THREE.TorusGeometry(0.33, 0.05, 8, 26).rotateX(Math.PI / 2)),
      checkMat,
      { cast: true },
    ),
  );
  add(spawnBars.build(geom(new THREE.BoxGeometry(0.62, 0.05, 0.07)), lineMat, { receive: true }));
  for (const label of labels) group.add(label);
  add(
    emitterBodies.build(geom(new THREE.BoxGeometry(0.2, 0.16, 0.34)), emitterMat, { cast: true }),
  );
  add(emitterLenses.build(geom(new THREE.SphereGeometry(0.06, 10, 8)), lensMat));

  // Chevrons: one instanced mesh per speed class so express keeps its accent
  // colour, both re-placed every frame by tick().
  const chevGeom = geom(chevronGeometry());
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
